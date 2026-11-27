-- v0.3.2 (C17) N-01-3 로그인 5분 제한(FP-258): 기존 DB의 APP_USER에 마지막 로그인 실패 시각 LAST_LOGIN_FAIL_AT 열을 추가한다.
--   5회 실패 뒤 5분 제한을 UPDATED_AT 대신 이 시각으로 잰다. 닉네임·이메일 변경 같은 다른 수정이 제한을 늘리지 않게 하려는 것이다.
-- 누가·언제·어디에: PR 작성자가 병합 후 공용 DB에 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」). 로컬 DB는 각자 실행한다.
--   스키마 소유자로 실행한다. 새로 DDL(avenue_ddl.sql)을 실행하는 DB는 필요 없다.
-- 회원 행은 지우거나 바꾸지 않는다. 이미 있는 행의 새 열은 NULL(실패 기록 없음)이라, 지금 5회 실패 상태인 계정도 제한 없이 로그인을 다시 시도할 수 있다.
-- 이 열이 없는 DB에서는 새 코드의 로그인·회원 조회가 ORA-00904 오류를 낸다. 새 코드를 띄우기 전에 실행한다(열만 먼저 추가해도 이전 코드는 그대로 동작한다).
-- LOGIN_FAIL_COUNT 열 주석도 지금 동작(5회째 5분 제한, 누적 10회 잠금)으로 고친다(주석만 바뀌고 데이터는 그대로다).
-- 이미 열이 있으면 건너뛰고 주석은 같은 값으로 다시 쓰므로 다시 실행해도 된다.
-- Oracle DDL은 실행 전후에 자동 커밋되므로, 커밋하지 않은 작업이 없는 세션에서 실행한다.
-- SQL Developer는 "스크립트 실행"(F5)으로 실행한다.
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE
WHENEVER OSERROR EXIT FAILURE

DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'APP_USER' AND COLUMN_NAME = 'LAST_LOGIN_FAIL_AT';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE APP_USER ADD (LAST_LOGIN_FAIL_AT TIMESTAMP)';
    END IF;
END;
/

COMMENT ON COLUMN APP_USER.LAST_LOGIN_FAIL_AT IS 'v0.3.2 (C17) 마지막 로그인 실패 시각 (N-01-3). 실패할 때마다 기록하고, 실패 횟수를 0으로 돌릴 때(로그인 성공·잠금 해제·비밀번호 재설정) 함께 비운다. 5회 실패 뒤 5분 제한은 이 시각부터 잰다';

-- 확인: LAST_LOGIN_FAIL_AT, TIMESTAMP(6), Y가 나오면 된다.
SELECT COLUMN_NAME, DATA_TYPE, NULLABLE
  FROM USER_TAB_COLUMNS
 WHERE TABLE_NAME = 'APP_USER' AND COLUMN_NAME = 'LAST_LOGIN_FAIL_AT';

-- C17 LOGIN_FAIL_COUNT 열 주석을 지금 동작으로 맞춘다(주석만 바뀐다).
COMMENT ON COLUMN APP_USER.LOGIN_FAIL_COUNT IS 'v0.3.2 (C17) 연속 로그인 실패 횟수 (5회째 5분 제한, 누적 10회 잠금, 재설정으로 해제)';
