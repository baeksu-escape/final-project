-- ====================================================================
-- N-12-2 실제 모델을 LGBM-BASE-0.2에서 0.1로 되돌린다 (FP-237). 0.2 전환 뒤 문제가 생겼을 때 쓴다.
-- ⚠️ DB만 되돌리면 안 된다: 서버 PC의 fastapi_server/artifacts/도 0.1 묶음(avenue_model_files_20261117b.zip)으로 바꾸고 FastAPI를 다시 켠다.
--    /v1/health가 "modelVersion": "LGBM-BASE-0.1"인지 확인한 뒤 이 SQL을 실행한다.
-- 0.2를 RETIRED로 내리고 0.1을 ACTIVE로 올린다. 이미 0.1이 ACTIVE면 아무것도 바꾸지 않는다(다시 실행해도 된다).
-- 이미 저장된 0.2 평가는 지우지 않는다(평가마다 자기 모델 버전이 남는다). Mock(DEV-DUMMY)으로 되돌리려면 rollback_model_to_dev_dummy.sql.
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
SET SERVEROUTPUT ON

DECLARE
    v_cnt    PLS_INTEGER;
    v_active MODEL_REGISTRY.MODEL_VERSION%TYPE;
BEGIN
    SELECT COUNT(*) INTO v_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = 'LGBM-BASE-0.1';
    IF v_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20124, 'LGBM-BASE-0.1 행이 없습니다.');
    END IF;

    SELECT MAX(MODEL_VERSION) INTO v_active FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE';
    IF v_active = 'LGBM-BASE-0.1' THEN
        DBMS_OUTPUT.PUT_LINE('이미 LGBM-BASE-0.1이 ACTIVE입니다. 바꾼 것이 없습니다.');
        RETURN;
    END IF;

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

-- 확인: LGBM-BASE-0.1이 ACTIVE 한 행
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, ACTIVATED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
