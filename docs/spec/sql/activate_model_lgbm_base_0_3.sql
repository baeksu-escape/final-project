-- ====================================================================
-- N-12-2 기존·대안 점수 계산·저장 — 서비스 모델을 LGBM-BASE-0.2에서 0.3(데이터 v3.7.0, 연체 라벨 재설계)으로 바꾼다 (FP-285)
-- FastAPI는 Spring이 보내는 ACTIVE 모델 버전과 불러온 모델 묶음의 버전(meta.json)이 같을 때만 실제 모델로 계산한다.
--
-- ⚠️ 실행 전에 꼭 확인 (순서가 중요하다)
--  1. 서버 PC의 fastapi_server/artifacts/를 0.3 묶음(avenue_model_files_20261127_v03.zip, 5개 파일)으로 바꾸고 FastAPI를 다시 켠다.
--     /v1/health가 "modelVersion": "LGBM-BASE-0.3", "modelLoaded": true 인지 본다. 기존 0.2 묶음은 되돌리기용으로 따로 보관한다.
--     파일을 바꾸지 않고 이 SQL만 실행하면 모든 점수 요청이 409(VERSION_MISMATCH) → MODEL_ERROR로 저장된다.
--     반대로 파일만 바꾸고 이 SQL을 늦게 실행해도, 그 사이 점수 요청이 모두 같은 409다. 1을 마치면 바로 이 SQL을 실행하고,
--     공용 DB는 사용자가 없는 시간(시연·통합 테스트 중이 아닐 때)에 한다.
--  2. register_model_lgbm_base_0_3.sql과 add_cutoff_cut_0_4.sql이 먼저 실행돼 있어야 한다. FastAPI 0.3은 등급 구간 CUT-0.4로 답하므로
--     CUT-0.4 행이 없으면 점수 저장이 FK 오류가 된다. 없으면 아래 사전 확인에서 멈추고 아무것도 바꾸지 않는다.
--  3. 이 SQL을 마치면 바로 activate_cutoff_cut_0_4.sql(금리·한도·상품 최소 점수)을 실행하고, 시드 평가(load_seed_assessment_lgbm_base_0_3.sql)를 넣는다.
--     0.3 평가가 없는 동안 비교 분석 화면은 비어 보인다.
--  4. 공용 DB는 전환 PR 작성자가 실행하고, 끝나면 DB 변경 채널에 남긴다. 공용 DB로 점수를 내는 PC는 0.3 묶음이어야 한다.
--     되돌리기는 rollback_model_lgbm_base_0_3_to_0_2.sql과 rollback_cutoff_cut_0_4_to_0_3.sql(파일도 0.2 묶음으로 되돌린다).
--
-- 지금 ACTIVE(보통 0.2)를 RETIRED로 내린 뒤 0.3을 ACTIVE로 올린다(ACTIVE는 한 행만 허용, UX_MRG_ACTIVE).
-- 이미 0.3이 ACTIVE면 아무것도 바꾸지 않으므로 다시 실행해도 된다. 저장된 평가 행은 건드리지 않는다(평가마다 자기 모델 버전이 남는다).
-- 전환 뒤 0.2로 낸 평가에서 시뮬레이터(SIM-02)를 쓰면 409 "점수를 다시 산출" 안내가 나온다(정상, 다시 산출하면 0.3 평가가 생김).
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON

DECLARE
    v_model_cnt    PLS_INTEGER;
    v_feature_cnt  PLS_INTEGER;
    v_artifact_cnt PLS_INTEGER;
    v_band_cnt     PLS_INTEGER;
    v_active       MODEL_REGISTRY.MODEL_VERSION%TYPE;
BEGIN
    -- 사전 확인 1: 0.3 모델 행이 FS-V1 피처 세트로 등록돼 있어야 한다
    SELECT COUNT(*) INTO v_model_cnt
      FROM MODEL_REGISTRY
     WHERE MODEL_VERSION = 'LGBM-BASE-0.3' AND FEATURE_SET_VERSION = 'FS-V1';
    IF v_model_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20185, 'LGBM-BASE-0.3(FS-V1) 행이 없습니다. register_model_lgbm_base_0_3.sql을 먼저 실행하세요');
    END IF;

    -- 사전 확인 2: SHAP 요인 저장(FK)에 필요한 FS-V1 피처 38행
    SELECT COUNT(*) INTO v_feature_cnt FROM DIM_FEATURE WHERE FEATURE_SET_VERSION = 'FS-V1';
    IF v_feature_cnt <> 38 THEN
        RAISE_APPLICATION_ERROR(-20186, 'FS-V1 피처가 38행이 아닙니다(' || v_feature_cnt || '행). seed/avenue_seed_dim_feature_fs_v1.sql을 확인하세요');
    END IF;

    -- 사전 확인 3: 모델 파일 기록 2행(기존·대안) — 어떤 파일로 계산하는지 근거가 남아 있어야 한다
    SELECT COUNT(*) INTO v_artifact_cnt FROM MODEL_ARTIFACT WHERE MODEL_VERSION = 'LGBM-BASE-0.3';
    IF v_artifact_cnt <> 2 THEN
        RAISE_APPLICATION_ERROR(-20187, 'LGBM-BASE-0.3 모델 파일 기록이 2행이 아닙니다(' || v_artifact_cnt || '행). register_model_lgbm_base_0_3.sql을 확인하세요');
    END IF;

    -- 사전 확인 4: FastAPI 0.3이 저장할 등급 구간 CUT-0.4 3행(FK)
    SELECT COUNT(*) INTO v_band_cnt FROM SCORE_GRADE_BAND WHERE CUTOFF_VERSION = 'CUT-0.4';
    IF v_band_cnt <> 3 THEN
        RAISE_APPLICATION_ERROR(-20188, 'CUT-0.4 구간이 3행이 아닙니다(' || v_band_cnt || '행). add_cutoff_cut_0_4.sql을 먼저 실행하세요');
    END IF;

    SELECT MAX(MODEL_VERSION) INTO v_active FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE';
    IF v_active = 'LGBM-BASE-0.3' THEN
        DBMS_OUTPUT.PUT_LINE('이미 LGBM-BASE-0.3이 ACTIVE입니다. 바꾼 것이 없습니다.');
        RETURN;
    END IF;

    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'RETIRED' WHERE STATUS_CODE = 'ACTIVE';
    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE MODEL_VERSION = 'LGBM-BASE-0.3';
    DBMS_OUTPUT.PUT_LINE('ACTIVE: ' || NVL(v_active, '(없음)') || ' → LGBM-BASE-0.3');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: LGBM-BASE-0.3이 ACTIVE 한 행, 0.2는 RETIRED. 그다음 activate_cutoff_cut_0_4.sql → 시연 계정으로 점수 산출 → 리포트 modelVersion LGBM-BASE-0.3, SHAP 38개.
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, ACTIVATED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
