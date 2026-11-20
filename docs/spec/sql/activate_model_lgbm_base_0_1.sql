-- ====================================================================
-- N-12-2 기존·대안 점수 계산·저장 — 서비스 모델을 Mock(DEV-DUMMY)에서 실제 모델(LGBM-BASE-0.1)로 바꾼다 (FP-141)
-- FastAPI는 Spring이 보내는 ACTIVE 모델 버전으로 계산기를 고르므로, 이 SQL이 곧 "실제 모델 켜기" 스위치다.
--
-- ⚠️ 실행 전에 꼭 확인 (fastapi_server/README.md 「공용 DB를 실제 모델로 전환하는 절차」)
--  1. 서버 PC의 fastapi_server/artifacts/에 모델 묶음이 있고, FastAPI /v1/health가 "modelLoaded": true 인지 본다.
--     모델 파일 없이 바꾸면 모든 점수 요청이 503(MODEL_NOT_READY) → MODEL_ERROR로 저장된다.
--  2. 이 DB에 FS-V1 기준 데이터가 있어야 한다(add_fs_v1_feature_set.sql + seed/avenue_seed_dim_feature_fs_v1.sql).
--     아래 사전 확인이 없으면 멈추고 아무것도 바꾸지 않는다.
--  3. 공용 DB는 전환 PR 작성자가 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」). 되돌리기는 rollback_model_to_dev_dummy.sql.
--
-- 순서가 중요하다: ACTIVE는 한 행만 허용(UX_MRG_ACTIVE)이라 DEV-DUMMY를 먼저 RETIRED로 바꾼 뒤 LGBM-BASE-0.1을 ACTIVE로 바꾼다.
-- 이미 LGBM-BASE-0.1이 ACTIVE면 아무것도 바꾸지 않으므로 다시 실행해도 된다. 저장된 평가 행은 건드리지 않는다.
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
SET SERVEROUTPUT ON

DECLARE
    v_model_cnt   PLS_INTEGER;
    v_feature_cnt PLS_INTEGER;
    v_active      MODEL_REGISTRY.MODEL_VERSION%TYPE;
BEGIN
    -- 사전 확인 1: 실제 모델 행이 FS-V1 피처 세트로 등록돼 있어야 한다(PR #72)
    SELECT COUNT(*) INTO v_model_cnt
      FROM MODEL_REGISTRY
     WHERE MODEL_VERSION = 'LGBM-BASE-0.1' AND FEATURE_SET_VERSION = 'FS-V1';
    IF v_model_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20101, 'LGBM-BASE-0.1(FS-V1) 행이 없습니다. add_fs_v1_feature_set.sql을 먼저 실행하세요');
    END IF;

    -- 사전 확인 2: SHAP 요인 저장(FK)에 필요한 FS-V1 피처 38행
    SELECT COUNT(*) INTO v_feature_cnt FROM DIM_FEATURE WHERE FEATURE_SET_VERSION = 'FS-V1';
    IF v_feature_cnt <> 38 THEN
        RAISE_APPLICATION_ERROR(-20102, 'FS-V1 피처가 38행이 아닙니다(' || v_feature_cnt || '행). seed/avenue_seed_dim_feature_fs_v1.sql을 확인하세요');
    END IF;

    SELECT MAX(MODEL_VERSION) INTO v_active FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE';
    IF v_active = 'LGBM-BASE-0.1' THEN
        DBMS_OUTPUT.PUT_LINE('이미 LGBM-BASE-0.1이 ACTIVE입니다. 바꾼 것이 없습니다.');
        RETURN;
    END IF;

    -- 지금 ACTIVE(보통 DEV-DUMMY)를 먼저 내리고 실제 모델을 올린다
    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'RETIRED' WHERE STATUS_CODE = 'ACTIVE';
    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE MODEL_VERSION = 'LGBM-BASE-0.1';
    DBMS_OUTPUT.PUT_LINE('ACTIVE: ' || NVL(v_active, '(없음)') || ' → LGBM-BASE-0.1');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: LGBM-BASE-0.1이 ACTIVE 한 행, DEV-DUMMY는 RETIRED. 그다음 시연 계정으로 점수 산출 → 리포트 modelVersion LGBM-BASE-0.1, SHAP 38개.
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, ACTIVATED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
