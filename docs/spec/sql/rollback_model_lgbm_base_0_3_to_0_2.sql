-- ====================================================================
-- N-12-2 실제 모델을 LGBM-BASE-0.3에서 0.2로 되돌린다 (FP-285). 0.3 전환 뒤 문제가 생겼을 때 쓴다.
-- ⚠️ DB만 되돌리면 안 된다: 서버 PC의 fastapi_server/artifacts/도 0.2 묶음(avenue_model_files_20261120_v02.zip)으로 바꾸고 FastAPI를 다시 켠다.
--    /v1/health가 "modelVersion": "LGBM-BASE-0.2"인지 확인한 뒤 이 SQL을 실행하고, 바로 rollback_cutoff_cut_0_4_to_0_3.sql도 실행한다.
-- 0.3을 RETIRED로 내리고 0.2를 ACTIVE로 올린다. 이미 0.2가 ACTIVE면 아무것도 바꾸지 않는다(다시 실행해도 된다).
-- 이미 저장된 0.3 평가는 지우지 않는다(평가마다 자기 모델 버전이 남는다). 0.1까지 되돌리려면 이어서 rollback_model_lgbm_base_0_2_to_0_1.sql.
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON

DECLARE
    v_cnt    PLS_INTEGER;
    v_active MODEL_REGISTRY.MODEL_VERSION%TYPE;
BEGIN
    SELECT COUNT(*) INTO v_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = 'LGBM-BASE-0.2';
    IF v_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20189, 'LGBM-BASE-0.2 행이 없습니다.');
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

-- 확인: LGBM-BASE-0.2가 ACTIVE 한 행
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, ACTIVATED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
