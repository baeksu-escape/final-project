-- ====================================================================
-- N-04 등급 구간 — 서비스 등급 구간을 CUT-0.1(665/780)에서 CUT-0.3(0~653 / 654~726 / 727~1000)으로 바꾼다 (FP-248, 정의서 10장 C28, decisions.md D-01)
-- CUT-0.1을 RETIRED로 내리고 CUT-0.3을 ACTIVE로 올리며, 같은 트랜잭션에서 점수대별 금리·한도(SCORE_BAND_OFFER)의 점수 구간과
-- 대출 상품 최소 점수(LOAN_PRODUCT.MIN_ALT_SCORE: 780→727, 665→654)를 새 등급 경계에 맞춘다. 금리·한도 값과 0점 상품은 그대로다.
--
-- ⚠️ 실행 전에 꼭 확인 (순서가 중요하다)
--  1. 이 SQL을 먼저 실행하고, 바로 이어서 FastAPI(feature_catalog.py의 CUTOFF_VERSION·GRADE_BANDS를 CUT-0.3으로 바꾼 버전)를 배포한다.
--     FastAPI가 CUT-0.3을 내보내는데 DB에 CUT-0.3 행이 없으면 저장이 FK 오류로 실패하므로, DB(add_cutoff_cut_0_3.sql 또는 이 파일)가 먼저다.
--     이 SQL만 실행하고 FastAPI를 옛 버전으로 두면 FastAPI가 CUT-0.1로 등급을 매기는 동안 DB의 ACTIVE 구간은 CUT-0.3이라 화면이 어긋난다.
--     두 단계를 연달아 하고, 공용 DB는 사용자가 없는 시간(시연·통합 테스트 중이 아닐 때)에 한다.
--  2. add_cutoff_cut_0_3.sql로 CUT-0.3(DRAFT) 3행이 이미 있어야 한다. 없거나 값이 다르면 아래 사전 확인에서 멈추고 아무것도 바꾸지 않는다.
--  3. 대출 상품 최소 점수·점수대별 금리·한도의 새 값(727·654 등)은 정의서 C28의 제안값이며 팀 확정 전이다(TODO D-01).
--  4. 지금 ACTIVE가 CUT-0.1이어야 한다(되돌리기가 CUT-0.1만 복원한다). 다른 버전이 ACTIVE면 -20154로 멈추고 아무것도 바꾸지 않는다.
--
-- 다시 실행해도 같은 결과다(이미 전환됐으면 바꾸지 않는다). 저장된 평가 행은 건드리지 않는다(평가마다 자기 구간 버전이 남는다).
-- 되돌리기는 rollback_cutoff_cut_0_3_to_0_1.sql(FastAPI도 CUT-0.1 상수로 되돌린다).
-- SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로 실행한다. 공용 DB 실행은 DB 담당이 한다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON

DECLARE
    v_status   SCORE_CUTOFF_VERSION.STATUS_CODE%TYPE;
    v_cnt      PLS_INTEGER;
    v_offer_old PLS_INTEGER;
    v_offer_new PLS_INTEGER;
    v_active   SCORE_CUTOFF_VERSION.CUTOFF_VERSION%TYPE;
BEGIN
    -- 사전 확인 1: CUT-0.3 버전 행이 있고 DRAFT 또는 이미 ACTIVE여야 한다
    BEGIN
        SELECT STATUS_CODE INTO v_status FROM SCORE_CUTOFF_VERSION WHERE CUTOFF_VERSION = 'CUT-0.3';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20151, 'CUT-0.3 행이 없습니다. add_cutoff_cut_0_3.sql을 먼저 실행하세요');
    END;
    IF v_status NOT IN ('DRAFT', 'ACTIVE') THEN
        RAISE_APPLICATION_ERROR(-20151, 'CUT-0.3의 상태가 ' || v_status || '입니다(DRAFT 또는 ACTIVE만 가능). 값을 확인한 뒤 DB 담당과 정하세요');
    END IF;

    -- 사전 확인 2: CUT-0.3 구간 3행이 이 파일의 값과 같아야 한다(add_cutoff_cut_0_3.sql과 같은 값)
    SELECT COUNT(*) INTO v_cnt FROM SCORE_GRADE_BAND
     WHERE CUTOFF_VERSION = 'CUT-0.3'
       AND ((GRADE_BAND_CODE = 'CAUTION'  AND MIN_SCORE = 0   AND MAX_SCORE = 653  AND DISPLAY_ORDER = 1)
         OR (GRADE_BAND_CODE = 'STANDARD' AND MIN_SCORE = 654 AND MAX_SCORE = 726  AND DISPLAY_ORDER = 2)
         OR (GRADE_BAND_CODE = 'GOOD'     AND MIN_SCORE = 727 AND MAX_SCORE = 1000 AND DISPLAY_ORDER = 3));
    IF v_cnt <> 3 THEN
        RAISE_APPLICATION_ERROR(-20152, 'CUT-0.3 구간이 0~653 / 654~726 / 727~1000 3행과 다릅니다. add_cutoff_cut_0_3.sql을 확인하세요');
    END IF;

    -- 사전 확인 3: 점수대별 금리·한도 3행이 옛 구간이거나 이미 새 구간이어야 한다
    SELECT COUNT(*) INTO v_offer_old FROM SCORE_BAND_OFFER
     WHERE (MIN_SCORE = 0 AND MAX_SCORE = 664) OR (MIN_SCORE = 665 AND MAX_SCORE = 779) OR (MIN_SCORE = 780 AND MAX_SCORE = 1000);
    SELECT COUNT(*) INTO v_offer_new FROM SCORE_BAND_OFFER
     WHERE (MIN_SCORE = 0 AND MAX_SCORE = 653) OR (MIN_SCORE = 654 AND MAX_SCORE = 726) OR (MIN_SCORE = 727 AND MAX_SCORE = 1000);
    SELECT COUNT(*) INTO v_cnt FROM SCORE_BAND_OFFER;
    IF v_cnt <> 3 OR (v_offer_old <> 3 AND v_offer_new <> 3) THEN
        RAISE_APPLICATION_ERROR(-20153, 'SCORE_BAND_OFFER가 옛 구간(0~664 / 665~779 / 780~1000)도 새 구간(0~653 / 654~726 / 727~1000)도 아닙니다. 값을 확인하세요');
    END IF;

    -- 사전 확인 4: 지금 ACTIVE가 CUT-0.1(되돌리기가 복원하는 버전)이거나 이미 CUT-0.3이어야 한다. 다른 버전이 ACTIVE면 되돌릴 수 없으므로 아무것도 바꾸기 전에 멈춘다
    SELECT MAX(CUTOFF_VERSION) INTO v_active FROM SCORE_CUTOFF_VERSION WHERE STATUS_CODE = 'ACTIVE';
    IF v_active IS NULL OR v_active NOT IN ('CUT-0.1', 'CUT-0.3') THEN
        RAISE_APPLICATION_ERROR(-20154, '지금 ACTIVE가 ' || NVL(v_active, '(없음)') || '입니다. CUT-0.1(또는 이미 CUT-0.3)일 때만 전환할 수 있습니다. 되돌리기가 CUT-0.1만 복원하므로 DB 담당과 정하세요');
    END IF;

    -- 점수대별 금리·한도: 옛 구간이면 새 구간으로 옮긴다(금리·한도 값은 그대로)
    IF v_offer_old = 3 THEN
        UPDATE SCORE_BAND_OFFER SET MAX_SCORE = 653 WHERE MIN_SCORE = 0   AND MAX_SCORE = 664;
        UPDATE SCORE_BAND_OFFER SET MIN_SCORE = 654, MAX_SCORE = 726 WHERE MIN_SCORE = 665 AND MAX_SCORE = 779;
        UPDATE SCORE_BAND_OFFER SET MIN_SCORE = 727 WHERE MIN_SCORE = 780 AND MAX_SCORE = 1000;
    END IF;

    -- 대출 상품 최소 점수: 옛 우수 경계(780)는 727로, 옛 보통 경계(665)는 654로. 다른 값(0 등)은 건드리지 않는다
    UPDATE LOAN_PRODUCT SET MIN_ALT_SCORE = 727 WHERE MIN_ALT_SCORE = 780;
    UPDATE LOAN_PRODUCT SET MIN_ALT_SCORE = 654 WHERE MIN_ALT_SCORE = 665;

    -- 등급 구간 전환: 지금 ACTIVE(위 사전 확인 4로 CUT-0.1)를 RETIRED로 내린 뒤 CUT-0.3을 ACTIVE로 올린다(ACTIVE는 한 행만 허용, UX_SCV_ACTIVE)
    IF v_active = 'CUT-0.3' THEN
        DBMS_OUTPUT.PUT_LINE('이미 CUT-0.3이 ACTIVE입니다. 등급 구간은 바꾸지 않았습니다(금리·한도·상품 최소 점수는 위에서 맞췄습니다).');
    ELSE
        UPDATE SCORE_CUTOFF_VERSION SET STATUS_CODE = 'RETIRED' WHERE STATUS_CODE = 'ACTIVE';
        UPDATE SCORE_CUTOFF_VERSION SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE CUTOFF_VERSION = 'CUT-0.3';
        DBMS_OUTPUT.PUT_LINE('ACTIVE: ' || NVL(v_active, '(없음)') || ' → CUT-0.3');
    END IF;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

-- 확인: CUT-0.3 ACTIVE 1행, CUT-0.1은 RETIRED, CUT-0.2는 DRAFT / 금리·한도 구간 0~653, 654~726, 727~1000 / 상품 최소 점수는 727·654·0만 남아야 한다.
SELECT CUTOFF_VERSION, STATUS_CODE FROM SCORE_CUTOFF_VERSION ORDER BY CUTOFF_VERSION;
SELECT MIN_SCORE, MAX_SCORE, RATE_MIN_PCT, RATE_MAX_PCT, LIMIT_AMT FROM SCORE_BAND_OFFER ORDER BY MIN_SCORE;
SELECT MIN_ALT_SCORE, COUNT(*) AS PRODUCT_COUNT FROM LOAN_PRODUCT GROUP BY MIN_ALT_SCORE ORDER BY MIN_ALT_SCORE;
