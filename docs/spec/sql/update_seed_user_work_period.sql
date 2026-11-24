-- ====================================================================
-- N-05 데이터 입력 — 시드 회원 400명의 근무기간(APP_USER.WORK_PERIOD_MONTHS)을 회원마다 다른 값으로 채운다
-- 이유: 근무기간은 데이터 입력의 필수값(최대 600개월)인데 시드 회원은 모두 NULL이었다. 직군별 고정값(24/36/24)으로 채운 DB도 이 값으로 덮어쓴다.
-- 값은 합성 예시이며 실제 근무 이력이 아니다. 점수 모델 입력이 아니므로 점수·비교 분석 숫자는 바뀌지 않는다.
--
-- 계산식(같은 회원은 언제 실행해도 같은 값 — 다시 실행해도 결과가 같다):
--   상한 = 6 ~ 600 사이로 자른 (2026 - 출생연도 - 20) × 12   … 20세부터 일했다고 볼 때의 최대 개월
--   r    = MOD(USER_ID × 7919 + 출생연도 × 31, 1000) / 1000   … 회원마다 다른 0~0.999
--   근무기간 = TRUNC(상한 × (a + b × r)), 최소 급여소득자 3개월·자영업자·프리랜서 12개월
--     (자영업자·프리랜서 시드는 월 소득 12개월치가 있어 그보다 짧지 않게 — 동주 11/24. 그래서 2006년생 두 직군은 19세 시작이 된다)
--     급여소득자 a=0.15 b=0.70 / 자영업자 a=0.05 b=0.90(넓게) / 프리랜서 a=0.05 b=0.45(짧게)
--   미리 본 분포(중앙값): 급여소득자 약 40개월, 자영업자 47, 프리랜서 22, 최대 371
--
-- 대상: DUMMY_YN='Y' AND ROLE_CODE='ROLE_USER' 이고 직군이 있는 시드 회원(데모 계정 3개 포함, 400명). 직접 가입한 회원·관리자는 건드리지 않는다.
-- ⚠️ 데모 계정(demo_employee·demo_self·demo_free)에 화면에서 입력한 근무기간이 있으면 이 값으로 바뀐다.
-- 대상이 400명이 아니면 바꾸지 않고 멈춘다.
-- 실행: SQL*Plus/SQLcl/SQL Developer(F5 스크립트 실행)에서 대상 스키마 소유자로. 11/20 규칙대로 작성자가 로컬·공용 DB에 적용하고 DB 변경 채널에 남긴다.
-- 새로 만드는 DB는 시드(10_seed_app_user.sql, 생성기 build_db.py의 work_period_months)에 같은 값이 이미 들어 있다.
-- ====================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON

DECLARE
    v_cnt PLS_INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_cnt FROM APP_USER
     WHERE DUMMY_YN = 'Y' AND ROLE_CODE = 'ROLE_USER'
       AND WORKER_TYPE_CODE IN ('EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER') AND BIRTH_YEAR IS NOT NULL;
    IF v_cnt <> 400 THEN
        RAISE_APPLICATION_ERROR(-20001, '시드 회원이 400명이 아닙니다(' || v_cnt || '명). 바꾸지 않고 멈춥니다.');
    END IF;

    UPDATE APP_USER
       SET WORK_PERIOD_MONTHS = GREATEST(CASE WHEN WORKER_TYPE_CODE = 'EMPLOYEE' THEN 3 ELSE 12 END, TRUNC(
               GREATEST(6, LEAST(600, (2026 - BIRTH_YEAR - 20) * 12))
             * CASE WORKER_TYPE_CODE
                 WHEN 'EMPLOYEE'      THEN 0.15 + 0.70 * MOD(USER_ID * 7919 + BIRTH_YEAR * 31, 1000) / 1000
                 WHEN 'SELF_EMPLOYED' THEN 0.05 + 0.90 * MOD(USER_ID * 7919 + BIRTH_YEAR * 31, 1000) / 1000
                 WHEN 'FREELANCER'    THEN 0.05 + 0.45 * MOD(USER_ID * 7919 + BIRTH_YEAR * 31, 1000) / 1000
               END))
     WHERE DUMMY_YN = 'Y' AND ROLE_CODE = 'ROLE_USER'
       AND WORKER_TYPE_CODE IN ('EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER') AND BIRTH_YEAR IS NOT NULL;

    DBMS_OUTPUT.PUT_LINE('근무기간을 채운 시드 회원: ' || SQL%ROWCOUNT || '명');
    COMMIT;
END;
/

-- 확인(이 값과 같으면 정상): EMPLOYEE 136명·비어있음 0·서로다른값 89·최소 3·중앙 39.5·최대 371
--                          FREELANCER 132·0·55·12·21.5·212 / SELF_EMPLOYED 132·0·76·12·47·329
SELECT WORKER_TYPE_CODE, COUNT(*) AS 회원, COUNT(*) - COUNT(WORK_PERIOD_MONTHS) AS 비어있음,
       COUNT(DISTINCT WORK_PERIOD_MONTHS) AS 서로다른값, MIN(WORK_PERIOD_MONTHS) AS 최소,
       MEDIAN(WORK_PERIOD_MONTHS) AS 중앙, MAX(WORK_PERIOD_MONTHS) AS 최대
  FROM APP_USER
 WHERE DUMMY_YN = 'Y' AND ROLE_CODE = 'ROLE_USER'
 GROUP BY WORKER_TYPE_CODE
 ORDER BY WORKER_TYPE_CODE;
