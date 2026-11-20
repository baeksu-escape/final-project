-- ====================================================================
-- N-12-2 기존·대안 점수 계산·저장 — 서비스 모델을 LGBM-BASE-0.1에서 0.2(단조 제약 재학습, 재욱 11/20)로 바꾼다 (FP-237)
-- FastAPI는 Spring이 보내는 ACTIVE 모델 버전과 불러온 모델 묶음의 버전(meta.json)이 같을 때만 실제 모델로 계산한다.
--
-- ⚠️ 실행 전에 꼭 확인 (순서가 중요하다)
--  1. 서버 PC의 fastapi_server/artifacts/를 0.2 묶음(avenue_model_files_20261120_v02.zip, 5개 파일)으로 바꾸고 FastAPI를 다시 켠다.
--     /v1/health가 "modelVersion": "LGBM-BASE-0.2", "modelLoaded": true 인지 본다.
--     파일을 바꾸지 않고 이 SQL만 실행하면 모든 점수 요청이 409(VERSION_MISMATCH) → MODEL_ERROR로 저장된다.
--     반대로 파일만 바꾸고 이 SQL을 늦게 실행해도, 그 사이 점수 요청이 모두 같은 409다. 1을 마치면 바로 이 SQL을 실행하고,
--     공용 DB는 사용자가 없는 시간(시연·통합 테스트 중이 아닐 때)에 한다.
--  2. register_model_lgbm_base_0_2.sql로 0.2 모델 행이 이미 있어야 한다. 없으면 아래 사전 확인에서 멈추고 아무것도 바꾸지 않는다.
--  3. 공용 DB는 DB 담당이 실행하고, 끝나면 DB 변경 채널에 알린다(팀원은 로컬 DB로 작업하므로 따로 합의하지 않는다, 11/20).
--     공용 DB로 점수를 내는 PC는 0.2 묶음이어야 한다. 되돌리기는 rollback_model_lgbm_base_0_2_to_0_1.sql(파일도 0.1 묶음으로 되돌린다).
--
-- 지금 ACTIVE(보통 0.1)를 RETIRED로 내린 뒤 0.2를 ACTIVE로 올린다(ACTIVE는 한 행만 허용, UX_MRG_ACTIVE).
-- 이미 0.2가 ACTIVE면 아무것도 바꾸지 않으므로 다시 실행해도 된다. 저장된 평가 행은 건드리지 않는다(평가마다 자기 모델 버전이 남는다).
-- 전환 뒤 0.1로 낸 평가에서 시뮬레이터(SIM-02)를 쓰면 409 "점수를 다시 산출" 안내가 나온다(정상, 다시 산출하면 0.2 평가가 생김).
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON

DECLARE
    v_model_cnt    PLS_INTEGER;
    v_feature_cnt  PLS_INTEGER;
    v_artifact_cnt PLS_INTEGER;
    v_active       MODEL_REGISTRY.MODEL_VERSION%TYPE;
BEGIN
    -- 사전 확인 1: 0.2 모델 행이 FS-V1 피처 세트로 등록돼 있어야 한다
    SELECT COUNT(*) INTO v_model_cnt
      FROM MODEL_REGISTRY
     WHERE MODEL_VERSION = 'LGBM-BASE-0.2' AND FEATURE_SET_VERSION = 'FS-V1';
    IF v_model_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20121, 'LGBM-BASE-0.2(FS-V1) 행이 없습니다. register_model_lgbm_base_0_2.sql을 먼저 실행하세요');
    END IF;

    -- 사전 확인 2: SHAP 요인 저장(FK)에 필요한 FS-V1 피처 38행
    SELECT COUNT(*) INTO v_feature_cnt FROM DIM_FEATURE WHERE FEATURE_SET_VERSION = 'FS-V1';
    IF v_feature_cnt <> 38 THEN
        RAISE_APPLICATION_ERROR(-20122, 'FS-V1 피처가 38행이 아닙니다(' || v_feature_cnt || '행). seed/avenue_seed_dim_feature_fs_v1.sql을 확인하세요');
    END IF;

    -- 사전 확인 3: 모델 파일 기록 2행(기존·대안) — 어떤 파일로 계산하는지 근거가 남아 있어야 한다
    SELECT COUNT(*) INTO v_artifact_cnt FROM MODEL_ARTIFACT WHERE MODEL_VERSION = 'LGBM-BASE-0.2';
    IF v_artifact_cnt <> 2 THEN
        RAISE_APPLICATION_ERROR(-20123, 'LGBM-BASE-0.2 모델 파일 기록이 2행이 아닙니다(' || v_artifact_cnt || '행). register_model_lgbm_base_0_2.sql을 확인하세요');
    END IF;

    SELECT MAX(MODEL_VERSION) INTO v_active FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE';
    IF v_active = 'LGBM-BASE-0.2' THEN
        DBMS_OUTPUT.PUT_LINE('이미 LGBM-BASE-0.2가 ACTIVE입니다. 바꾼 것이 없습니다.');
        RETURN;
    END IF;

    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'RETIRED' WHERE STATUS_CODE = 'ACTIVE';
    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE MODEL_VERSION = 'LGBM-BASE-0.2';
    DBMS_OUTPUT.PUT_LINE('ACTIVE: ' || NVL(v_active, '(없음)') || ' → LGBM-BASE-0.2');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: LGBM-BASE-0.2가 ACTIVE 한 행, 0.1은 RETIRED. 그다음 시연 계정으로 점수 산출 → 리포트 modelVersion LGBM-BASE-0.2, SHAP 38개.
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, ACTIVATED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
