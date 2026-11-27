-- ====================================================================
-- RPT-05 비교 분석용 — 로컬 DB에서 일괄 산출한 시드 회원 평가(ASSESSMENT·ASSESSMENT_FACTOR)를 "적재 SQL 파일"로 뽑아낸다
-- 왜: 시드에는 평가 행이 없어 비교 분석이 비어 있다. 점수는 모델(FastAPI)이 내야 하므로 한 사람이 로컬에서 일괄 산출하고,
--     그 결과를 SQL로 뽑아 공용 DB·팀원 DB에 같은 평가 행을 넣는다(팀원은 일괄 산출을 돌리지 않아도 된다).
--
-- 실행 전: ① update_seed_user_work_period.sql ② 로컬 일괄 산출(STS --local.score-batch=true, limit 9999)로 시드 회원 점수 저장
-- 실행: SQL Developer에서 이 파일을 열고 F5(스크립트 실행). 아래 SPOOL 경로에 적재 SQL이 만들어진다(폴더가 있어야 한다).
-- 읽기만 한다(DB를 바꾸지 않는다). 대상: 시드 회원(DUMMY_YN='Y', ROLE_USER)의 ACTIVE 모델 SCORED 평가 중 회원별 최신 1건.
-- 만들어진 파일은 저장소 docs/spec/sql/load_seed_assessment_<모델>.sql로 옮겨 PR로 올린다. 모델이 바뀌면 다시 뽑는다.
-- 조회 결과 한 행이 파일 한 줄이다(DBMS_OUTPUT은 SQL Developer에서 약 1MB에서 끊겨 쓰지 않는다 — 11/24 첫 시도 52명에서 멈춤).
-- 만들어진 적재 SQL은 ① DB의 ACTIVE 모델이 같은 버전이고 ② 대상 회원의 USER_ID와 LOGIN_ID가 모두 맞을 때만 넣으며,
-- 끝에 예상한 회원에게 들어갔는지 확인하는 조회를 실행한다(FP-285, 11/27). 0.2 파일은 이 검사가 생기기 전에 만든 것이다.
-- ====================================================================
SET FEEDBACK OFF
SET ECHO OFF
SET VERIFY OFF
SET HEADING OFF
SET PAGESIZE 0
SET LINESIZE 32767
SET TRIMSPOOL ON
SET TERMOUT OFF
SET DEFINE OFF
SPOOL C:\temp\load_seed_assessment.sql

WITH model AS (
    SELECT MAX(MODEL_VERSION) AS V FROM MODEL_REGISTRY WHERE STATUS_CODE = 'ACTIVE'
), picked AS (
    SELECT * FROM (
        SELECT A.*, U.LOGIN_ID, ROW_NUMBER() OVER (PARTITION BY A.USER_ID ORDER BY A.ASSESSED_AT DESC, A.ASSESSMENT_ID DESC) AS RN
          FROM ASSESSMENT A JOIN APP_USER U ON U.USER_ID = A.USER_ID JOIN model M ON A.MODEL_VERSION = M.V
         WHERE A.DATASET_CODE = 'SERVICE' AND A.GRADE_STATUS_CODE = 'SCORED'
           AND U.DUMMY_YN = 'Y' AND U.ROLE_CODE = 'ROLE_USER')
     WHERE RN = 1
), counts AS (
    SELECT (SELECT COUNT(*) FROM picked) AS ROWS_CNT,
           (SELECT COUNT(*) FROM ASSESSMENT_FACTOR F JOIN picked P ON P.ASSESSMENT_ID = F.ASSESSMENT_ID) AS FACTS_CNT FROM DUAL
), members AS (
    -- 적재 대상 회원 목록(대조·확인 조회에 쓴다)
    SELECT USER_ID, LOGIN_ID, REQUEST_ID, ROW_NUMBER() OVER (ORDER BY USER_ID) AS NO FROM picked
), chunks AS (
    SELECT LEVEL AS C FROM DUAL CONNECT BY LEVEL <= 200
), lines AS (
    -- 머리말(K1 = 0)
    SELECT 0 AS K1, 1 AS K2, 0 AS K3, '-- ====================================================================' AS TXT FROM DUAL
    UNION ALL SELECT 0, 2, 0, '-- RPT-05 비교 분석용 시드 회원 평가 적재 — 모델 ' || M.V || ' (export_seed_assessment.sql로 ' || TO_CHAR(SYSDATE, 'YYYY-MM-DD') || ' 생성)' FROM model M
    UNION ALL SELECT 0, 3, 0, '-- 시드 회원 ' || C.ROWS_CNT || '명 · 항목 ' || C.FACTS_CNT || '행. 같은 REQUEST_ID가 있거나 그 회원에게 이미 이 모델의 SCORED 평가가 있으면 건너뛴다(다시 실행해도 중복 없음).' FROM counts C
    UNION ALL SELECT 0, 4, 0, '-- 실행 전: update_seed_user_work_period.sql, 같은 모델의 등록·전환 SQL. SQL Developer F5로 대상 스키마 소유자가 실행한다.' FROM DUAL
    UNION ALL SELECT 0, 5, 0, '-- 실행 시점: DB의 ACTIVE 모델이 ' || M.V || '일 때만 넣는다. 공용 DB는 전환 직후에 실행하며, 전환 일정이 정해지기 전에는 실행하지 않는다.' FROM model M
    UNION ALL SELECT 0, 6, 0, '-- 대상 확인: 아래 회원의 USER_ID와 LOGIN_ID가 모두 맞아야 넣는다. 하나라도 다르면 아무것도 넣지 않고 멈춘다.' FROM DUAL
    UNION ALL SELECT 0, 7, 0, '-- ====================================================================' FROM DUAL
    UNION ALL SELECT 0, 8, 0, 'SET DEFINE OFF' FROM DUAL
    UNION ALL SELECT 0, 9, 0, 'WHENEVER SQLERROR EXIT FAILURE ROLLBACK' FROM DUAL
    UNION ALL SELECT 0, 10, 0, 'DECLARE v_cnt PLS_INTEGER; BEGIN' FROM DUAL
    UNION ALL SELECT 0, 11, 0, '    SELECT COUNT(*) INTO v_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = ''' || M.V || ''';' FROM model M
    UNION ALL SELECT 0, 12, 0, '    IF v_cnt <> 1 THEN RAISE_APPLICATION_ERROR(-20202, ''MODEL_REGISTRY에 ' || M.V || ' 행이 없습니다.''); END IF;' FROM model M
    UNION ALL SELECT 0, 13, 0, '    SELECT COUNT(*) INTO v_cnt FROM MODEL_REGISTRY WHERE MODEL_VERSION = ''' || M.V || ''' AND STATUS_CODE = ''ACTIVE'';' FROM model M
    UNION ALL SELECT 0, 14, 0, '    IF v_cnt <> 1 THEN RAISE_APPLICATION_ERROR(-20204, ''ACTIVE 모델이 ' || M.V || '이 아닙니다. 모델 전환 뒤에 실행하세요.''); END IF;' FROM model M
    UNION ALL SELECT 0, 15, 0, '    SELECT COUNT(*) INTO v_cnt FROM APP_USER WHERE DUMMY_YN = ''Y'' AND ROLE_CODE = ''ROLE_USER'' AND WORK_PERIOD_MONTHS IS NOT NULL;' FROM DUAL
    UNION ALL SELECT 0, 16, 0, '    IF v_cnt <> 400 THEN RAISE_APPLICATION_ERROR(-20203, ''시드 회원 400명이 아니거나 근무기간이 비어 있습니다. update_seed_user_work_period.sql을 먼저 실행하세요.''); END IF;' FROM DUAL
    UNION ALL SELECT 0, 17, 0, '    SELECT COUNT(*) INTO v_cnt FROM APP_USER U JOIN (' FROM DUAL
    UNION ALL SELECT 0, 18, R.NO, CASE WHEN R.NO = 1 THEN '        SELECT ' ELSE '        UNION ALL SELECT ' END
        || R.USER_ID || ' AS USER_ID, ''' || REPLACE(R.LOGIN_ID, '''', '''''') || ''' AS LOGIN_ID FROM DUAL' FROM members R
    UNION ALL SELECT 0, 19, 0, '    ) E ON E.USER_ID = U.USER_ID AND E.LOGIN_ID = U.LOGIN_ID WHERE U.DUMMY_YN = ''Y'' AND U.ROLE_CODE = ''ROLE_USER'';' FROM DUAL
    UNION ALL SELECT 0, 20, 0, '    IF v_cnt <> ' || C.ROWS_CNT || ' THEN RAISE_APPLICATION_ERROR(-20205, ''USER_ID와 LOGIN_ID가 맞는 대상 회원이 ' || C.ROWS_CNT
        || '명 중 '' || v_cnt || ''명입니다. 다른 회원에게 들어갈 수 있어 멈춥니다.''); END IF;' FROM counts C
    UNION ALL SELECT 0, 21, 0, 'END;' FROM DUAL
    UNION ALL SELECT 0, 22, 0, '/' FROM DUAL
    -- 회원별 평가(K1 = USER_ID): 1 INSERT 머리 · 2 값 · 3 JSON 조각 · 4 나머지 값 · 5 건너뛰기 조건 · 6 항목
    UNION ALL SELECT P.USER_ID, 1, 0, 'INSERT INTO ASSESSMENT (REQUEST_ID, USER_ID, DATASET_CODE, WORKER_TYPE_CODE, AGE_BAND_CODE, INPUT_BASE_MONTH, MODEL_VERSION,'
        || ' FEATURE_SET_VERSION, CUTOFF_VERSION, GRADE_STATUS_CODE, NOT_SCORABLE_REASON_CODE, TRAD_SCORABLE_YN, TRAD_SCORE, TRAD_GRADE_BAND_CODE,'
        || ' TRAD_DEFAULT_PROB, ALT_SCORABLE_YN, ALT_SCORE, ALT_GRADE_BAND_CODE, ALT_DEFAULT_PROB, SHAP_BASE_SCORE, FEATURE_SNAPSHOT, EVAL_ELIGIBLE_YN,'
        || ' AI_SUMMARY, ASSESSED_AT, CREATED_AT)' FROM picked P
    UNION ALL SELECT P.USER_ID, 2, 0, 'SELECT ''' || P.REQUEST_ID || ''', ' || P.USER_ID || ', ''' || P.DATASET_CODE || ''', ''' || P.WORKER_TYPE_CODE || ''', '''
        || P.AGE_BAND_CODE || ''', ''' || P.INPUT_BASE_MONTH || ''', ''' || P.MODEL_VERSION || ''', ''' || P.FEATURE_SET_VERSION || ''', '
        || NVL2(P.CUTOFF_VERSION, '''' || P.CUTOFF_VERSION || '''', 'NULL') || ', ''' || P.GRADE_STATUS_CODE || ''', NULL, ''' || P.TRAD_SCORABLE_YN || ''', '
        || NVL2(P.TRAD_SCORE, TO_CHAR(P.TRAD_SCORE), 'NULL') || ', ' || NVL2(P.TRAD_GRADE_BAND_CODE, '''' || P.TRAD_GRADE_BAND_CODE || '''', 'NULL') || ', '
        || NVL2(P.TRAD_DEFAULT_PROB, TO_CHAR(P.TRAD_DEFAULT_PROB, 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,'''), 'NULL') || ', ''' || P.ALT_SCORABLE_YN || ''', '
        || TO_CHAR(P.ALT_SCORE) || ', ''' || P.ALT_GRADE_BAND_CODE || ''', ' || TO_CHAR(P.ALT_DEFAULT_PROB, 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,''') || ', '
        || NVL2(P.SHAP_BASE_SCORE, TO_CHAR(P.SHAP_BASE_SCORE), 'NULL') || ',' FROM picked P
    UNION ALL SELECT P.USER_ID, 3, CH.C, '    TO_CLOB(''' || REPLACE(DBMS_LOB.SUBSTR(P.FEATURE_SNAPSHOT, 1000, (CH.C - 1) * 1000 + 1), '''', '''''') || ''')'
        || CASE WHEN CH.C * 1000 < DBMS_LOB.GETLENGTH(P.FEATURE_SNAPSHOT) THEN ' ||' ELSE ',' END
      FROM picked P JOIN chunks CH ON (CH.C - 1) * 1000 < DBMS_LOB.GETLENGTH(P.FEATURE_SNAPSHOT)
    UNION ALL SELECT P.USER_ID, 4, 0, '    ''' || P.EVAL_ELIGIBLE_YN || ''', ' || NVL2(P.AI_SUMMARY, '''' || REPLACE(P.AI_SUMMARY, '''', '''''') || '''', 'NULL') || ', '
        || 'TIMESTAMP ''' || TO_CHAR(P.ASSESSED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6') || ''', TIMESTAMP ''' || TO_CHAR(P.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6') || ''' FROM DUAL' FROM picked P
    UNION ALL SELECT P.USER_ID, 5, 0, ' WHERE NOT EXISTS (SELECT 1 FROM ASSESSMENT X WHERE X.REQUEST_ID = ''' || P.REQUEST_ID || ''')'
        || ' AND NOT EXISTS (SELECT 1 FROM ASSESSMENT X WHERE X.USER_ID = ' || P.USER_ID || ' AND X.DATASET_CODE = ''SERVICE'''
        || ' AND X.MODEL_VERSION = ''' || P.MODEL_VERSION || ''' AND X.GRADE_STATUS_CODE = ''SCORED'');' FROM picked P
    UNION ALL SELECT P.USER_ID, 6, F.FEATURE_RANK, 'INSERT INTO ASSESSMENT_FACTOR (ASSESSMENT_ID, FEATURE_SET_VERSION, FEATURE_RANK, FEATURE_CODE, FEATURE_VALUE, SHAP_VALUE, SHAP_SCORE, CREATED_AT)'
        || ' SELECT A.ASSESSMENT_ID, ''' || F.FEATURE_SET_VERSION || ''', ' || F.FEATURE_RANK || ', ''' || F.FEATURE_CODE || ''', '
        || NVL2(F.FEATURE_VALUE, '''' || REPLACE(F.FEATURE_VALUE, '''', '''''') || '''', 'NULL') || ', '
        || NVL2(F.SHAP_VALUE, TO_CHAR(F.SHAP_VALUE, 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,'''), 'NULL') || ', ' || F.SHAP_SCORE || ', '
        || 'TIMESTAMP ''' || TO_CHAR(F.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS.FF6') || ''''
        || ' FROM ASSESSMENT A WHERE A.REQUEST_ID = ''' || P.REQUEST_ID || ''''
        || ' AND NOT EXISTS (SELECT 1 FROM ASSESSMENT_FACTOR X WHERE X.ASSESSMENT_ID = A.ASSESSMENT_ID AND X.FEATURE_RANK = ' || F.FEATURE_RANK || ');'
      FROM picked P JOIN ASSESSMENT_FACTOR F ON F.ASSESSMENT_ID = P.ASSESSMENT_ID
    -- 맺음(K1 = 큰 수)
    UNION ALL SELECT 999999999999, 1, 0, 'COMMIT;' FROM DUAL
    UNION ALL SELECT 999999999999, 2, 0, '-- 확인: 직군별 회원 수 합이 위 머리말의 회원 수와 같으면 정상' FROM DUAL
    UNION ALL SELECT 999999999999, 3, 0, 'SELECT A.WORKER_TYPE_CODE, COUNT(DISTINCT A.USER_ID) AS 회원 FROM ASSESSMENT A JOIN APP_USER U ON U.USER_ID = A.USER_ID'
        || ' WHERE U.DUMMY_YN = ''Y'' AND A.MODEL_VERSION = ''' || M.V || ''' AND A.GRADE_STATUS_CODE = ''SCORED'' GROUP BY A.WORKER_TYPE_CODE ORDER BY 1;' FROM model M
    UNION ALL SELECT 999999999999, 4, 0, '-- 확인: 예상한 회원에게 들어갔는지. 다른_회원은 0이어야 한다. 건너뜀은 이미 같은 모델 점수가 있던 회원 수다.' FROM DUAL
    UNION ALL SELECT 999999999999, 5, 0, 'WITH E AS (' FROM DUAL
    UNION ALL SELECT 999999999999, 6, R.NO, CASE WHEN R.NO = 1 THEN '    SELECT ''' ELSE '    UNION ALL SELECT ''' END
        || REPLACE(R.LOGIN_ID, '''', '''''') || ''' AS LOGIN_ID, ''' || R.REQUEST_ID || ''' AS REQUEST_ID FROM DUAL' FROM members R
    UNION ALL SELECT 999999999999, 7, 0, ') SELECT COUNT(*) AS 대상, COUNT(CASE WHEN A.USER_ID = U.USER_ID THEN 1 END) AS 이_파일_평가,' FROM DUAL
    UNION ALL SELECT 999999999999, 8, 0, '         COUNT(CASE WHEN A.USER_ID IS NULL THEN 1 END) AS 건너뜀, COUNT(CASE WHEN A.USER_ID <> U.USER_ID THEN 1 END) AS 다른_회원' FROM DUAL
    UNION ALL SELECT 999999999999, 9, 0, '    FROM E JOIN APP_USER U ON U.LOGIN_ID = E.LOGIN_ID LEFT JOIN ASSESSMENT A ON A.REQUEST_ID = E.REQUEST_ID;' FROM DUAL
    UNION ALL SELECT 999999999999, 10, 0, '-- 끝' FROM DUAL
)
SELECT TXT FROM lines ORDER BY K1, K2, K3;

SPOOL OFF
SET TERMOUT ON
