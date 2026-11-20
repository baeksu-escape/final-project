-- ====================================================================
-- N-12-2 서비스 모델을 실제 모델(LGBM-BASE-0.1)에서 Mock(DEV-DUMMY)으로 되돌린다 (FP-141, activate_model_lgbm_base_0_1.sql의 반대)
-- 실제 모델 전환 뒤 문제가 생겼을 때(모델 파일 없음·503 반복·점수 이상 등) 바로 Mock으로 돌아가는 비상용이다.
--
-- - 이미 저장된 평가는 지우지 않는다. 평가마다 자기 MODEL_VERSION·FEATURE_SET_VERSION이 남아 있어 리포트는 그대로 보인다.
-- - 순서가 중요하다: ACTIVE는 한 행만 허용(UX_MRG_ACTIVE)이라 지금 ACTIVE를 먼저 RETIRED로 바꾼 뒤 DEV-DUMMY를 ACTIVE로 바꾼다.
-- - 이미 DEV-DUMMY가 ACTIVE면 아무것도 바꾸지 않으므로 다시 실행해도 된다.
-- - 공용 DB는 전환 PR 작성자가 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」). SQL*Plus/SQLcl/SQL Developer(F5)에서 대상 스키마 소유자로 실행한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE
SET SERVEROUTPUT ON

DECLARE
    v_dummy_cnt PLS_INTEGER;
    v_active    MODEL_REGISTRY.MODEL_VERSION%TYPE;
BEGIN
    SELECT COUNT(*) INTO v_dummy_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = 'DEV-DUMMY';
    IF v_dummy_cnt <> 1 THEN
        RAISE_APPLICATION_ERROR(-20103, 'DEV-DUMMY 행이 없습니다. avenue_ddl.sql 기준 데이터를 확인하세요');
    END IF;

    SELECT MAX(MODEL_VERSION) INTO v_active FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE';
    IF v_active = 'DEV-DUMMY' THEN
        DBMS_OUTPUT.PUT_LINE('이미 DEV-DUMMY가 ACTIVE입니다. 바꾼 것이 없습니다.');
        RETURN;
    END IF;

    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'RETIRED' WHERE STATUS_CODE = 'ACTIVE';
    UPDATE MODEL_REGISTRY SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE MODEL_VERSION = 'DEV-DUMMY';
    DBMS_OUTPUT.PUT_LINE('ACTIVE: ' || NVL(v_active, '(없음)') || ' → DEV-DUMMY');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

COMMIT;

-- 확인: DEV-DUMMY가 ACTIVE 한 행. 점수 산출 → 리포트 modelVersion DEV-DUMMY, SHAP 39개(Mock).
SELECT MODEL_VERSION, FEATURE_SET_VERSION, STATUS_CODE, ACTIVATED_AT FROM MODEL_REGISTRY ORDER BY MODEL_VERSION;
