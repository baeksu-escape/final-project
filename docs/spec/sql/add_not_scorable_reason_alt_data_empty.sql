-- 산출 불가 사유 코드 ALT_DATA_EMPTY(통신비·공과금 기관 기록 없음)를 이미 만들어진 DB에 추가한다.
-- 피처 정의서 8-5 (다) 1차 확정: 통신비 또는 공과금이 빈 목록이면 점수를 내지 않는다.
-- 새로 DDL을 실행하는 DB는 avenue_ddl.sql에 이미 들어 있으므로 이 파일이 필요 없다.
-- 이미 같은 코드가 있으면 넣지 않으므로 다시 실행해도 된다.
-- SQL*Plus/SQLcl에서 대상 스키마 소유자로 실행한다.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

MERGE INTO DIM_NOT_SCORABLE_REASON t
USING (SELECT 'ALT_DATA_EMPTY' AS REASON_CODE,
              '통신비·공과금 기관 기록 없음' AS REASON_NAME,
              5 AS DISPLAY_ORDER
         FROM DUAL) s
   ON (t.REASON_CODE = s.REASON_CODE)
 WHEN NOT MATCHED THEN
      INSERT (REASON_CODE, REASON_NAME, DISPLAY_ORDER)
      VALUES (s.REASON_CODE, s.REASON_NAME, s.DISPLAY_ORDER);

COMMENT ON TABLE DIM_NOT_SCORABLE_REASON IS '산출 불가 사유 코드 (CONSENT_REQUIRED=동의 없음, INPUT_INCOMPLETE=필수 입력 부족, STALE_INPUT=입력 기준월이 오래됨, MODEL_ERROR=모델 서버 오류, ALT_DATA_EMPTY=통신비·공과금 기관 기록 없음)';

COMMIT;
