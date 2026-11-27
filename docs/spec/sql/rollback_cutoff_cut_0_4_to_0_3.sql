-- ====================================================================
-- N-04 등급 구간 — CUT-0.4 전환(activate_cutoff_cut_0_4.sql)을 되돌린다 (FP-285, 정의서 10장 C40)
-- CUT-0.4를 DRAFT로 내리고 CUT-0.3(653/727)을 ACTIVE로 올리며, 점수대별 금리·한도 구간과 대출 상품 최소 점수(712→727, 645→654)도 되돌린다.
--
-- ⚠️ 실행 순서: 서버 PC의 모델 파일을 0.2 묶음으로 되돌려 /v1/health를 확인한 뒤, rollback_model_lgbm_base_0_3_to_0_2.sql과 이 SQL을 연달아 실행한다.
--    FastAPI는 불러온 모델 버전으로 등급 구간을 고르므로(0.2 → CUT-0.3) 따로 바꿀 상수가 없다.
-- CUT-0.4가 ACTIVE이고 CUT-0.3이 RETIRED가 아니면 아무것도 바꾸지 않고 멈춘다. 이미 CUT-0.3이 ACTIVE면 바꾸지 않으므로 다시 실행해도 된다.
-- 상품 최소 점수는 값(712→727, 645→654) 기준으로 되돌린다. 전환 뒤 712·645를 쓰는 상품이 새로 생겼다면 함께 되돌려지므로 실행 전에 확인한다.
-- 전환 SQL(activate_cutoff_cut_0_4.sql)은 전환 전 ACTIVE가 CUT-0.3일 때만 실행되므로, 이 되돌리기는 항상 CUT-0.3으로 복원한다.
-- 되돌리는 동안 CUT-0.4로 저장된 평가 행은 건드리지 않는다(평가마다 자기 구간 버전이 남고, CUT-0.4 행도 DRAFT로 남아 FK가 유지된다).
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다. 공용 DB 실행은 DB 담당과 정해 한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON

DECLARE
    v_active SCORE_CUTOFF_VERSION.CUTOFF_VERSION%TYPE;
    v_status SCORE_CUTOFF_VERSION.STATUS_CODE%TYPE;
    v_cnt    PLS_INTEGER;
BEGIN
    SELECT MAX(CUTOFF_VERSION) INTO v_active FROM SCORE_CUTOFF_VERSION WHERE STATUS_CODE = 'ACTIVE';
    IF v_active = 'CUT-0.3' THEN
        DBMS_OUTPUT.PUT_LINE('이미 CUT-0.3이 ACTIVE입니다. 바꾼 것이 없습니다.');
        RETURN;
    END IF;
    IF v_active IS NULL OR v_active <> 'CUT-0.4' THEN
        RAISE_APPLICATION_ERROR(-20178, '지금 ACTIVE가 ' || NVL(v_active, '(없음)') || '입니다. CUT-0.4 전환 직후에만 되돌릴 수 있습니다');
    END IF;
    BEGIN
        SELECT STATUS_CODE INTO v_status FROM SCORE_CUTOFF_VERSION WHERE CUTOFF_VERSION = 'CUT-0.3';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20179, 'CUT-0.3 행이 없습니다');
    END;
    IF v_status <> 'RETIRED' THEN
        RAISE_APPLICATION_ERROR(-20179, 'CUT-0.3의 상태가 ' || v_status || '입니다(RETIRED만 가능)');
    END IF;
    SELECT COUNT(*) INTO v_cnt FROM SCORE_BAND_OFFER
     WHERE (MIN_SCORE = 0 AND MAX_SCORE = 644) OR (MIN_SCORE = 645 AND MAX_SCORE = 711) OR (MIN_SCORE = 712 AND MAX_SCORE = 1000);
    IF v_cnt <> 3 THEN
        RAISE_APPLICATION_ERROR(-20180, 'SCORE_BAND_OFFER가 새 구간(0~644 / 645~711 / 712~1000)이 아닙니다. 값을 확인하세요');
    END IF;

    UPDATE SCORE_BAND_OFFER SET MAX_SCORE = 653 WHERE MIN_SCORE = 0   AND MAX_SCORE = 644;
    UPDATE SCORE_BAND_OFFER SET MIN_SCORE = 654, MAX_SCORE = 726 WHERE MIN_SCORE = 645 AND MAX_SCORE = 711;
    UPDATE SCORE_BAND_OFFER SET MIN_SCORE = 727 WHERE MIN_SCORE = 712 AND MAX_SCORE = 1000;
    UPDATE LOAN_PRODUCT SET MIN_ALT_SCORE = 727 WHERE MIN_ALT_SCORE = 712;
    UPDATE LOAN_PRODUCT SET MIN_ALT_SCORE = 654 WHERE MIN_ALT_SCORE = 645;

    UPDATE SCORE_CUTOFF_VERSION SET STATUS_CODE = 'DRAFT', ACTIVATED_AT = NULL WHERE CUTOFF_VERSION = 'CUT-0.4';
    UPDATE SCORE_CUTOFF_VERSION SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = NVL(ACTIVATED_AT, SYSTIMESTAMP) WHERE CUTOFF_VERSION = 'CUT-0.3';
    DBMS_OUTPUT.PUT_LINE('ACTIVE: CUT-0.4 → CUT-0.3');
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

-- 확인: CUT-0.3 ACTIVE, CUT-0.4 DRAFT / 금리·한도 구간 0~653, 654~726, 727~1000 / 상품 최소 점수는 727·654·0만 남아야 한다.
SELECT CUTOFF_VERSION, STATUS_CODE FROM SCORE_CUTOFF_VERSION ORDER BY CUTOFF_VERSION;
SELECT MIN_SCORE, MAX_SCORE FROM SCORE_BAND_OFFER ORDER BY MIN_SCORE;
SELECT MIN_ALT_SCORE, COUNT(*) AS PRODUCT_COUNT FROM LOAN_PRODUCT GROUP BY MIN_ALT_SCORE ORDER BY MIN_ALT_SCORE;
