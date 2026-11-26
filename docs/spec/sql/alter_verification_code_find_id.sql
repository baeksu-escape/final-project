-- v0.3.2 (C16) N-03-1 아이디 찾기 휴대폰·이메일 인증(FP-258): 기존 DB의 VERIFICATION_CODE.CK_VCD_PURPOSE에 'FIND_ID'를 추가한다.
--   허용 값: SIGNUP, FIND_PASSWORD, CHANGE_EMAIL, ADMIN_LOGIN, FIND_ID
-- 누가·언제·어디에: PR 작성자가 병합 후 공용 DB에 실행하고 DB 변경 채널에 남긴다(sql README 「공용 DB 적용 규칙」). 로컬 DB는 각자 실행한다.
--   스키마 소유자로 실행한다. 새로 DDL(avenue_ddl.sql)을 실행하는 DB는 필요 없다.
-- 인증 기록(행)은 지우거나 바꾸지 않는다. 제약만 지우고 새 값까지 넣어 다시 만든다. 이미 있는 행은 모두 기존 값이라 그대로 통과한다.
-- 이 제약이 바뀌기 전에는 아이디 찾기 [인증번호 받기]·[인증코드 받기]가 ORA-02290(CHECK 위반)으로 실패한다. 다른 기능은 영향이 없다.
-- 제약이 없어도 넘어가고 같은 이름으로 다시 만들므로 다시 실행해도 된다.
-- Oracle DDL은 실행 전후에 자동 커밋되므로, 커밋하지 않은 작업이 없는 세션에서 실행한다.
-- SQL Developer는 "스크립트 실행"(F5)으로 실행한다.
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE
WHENEVER OSERROR EXIT FAILURE

DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_CONSTRAINTS
     WHERE TABLE_NAME = 'VERIFICATION_CODE' AND CONSTRAINT_NAME = 'CK_VCD_PURPOSE';

    IF v_count > 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE VERIFICATION_CODE DROP CONSTRAINT CK_VCD_PURPOSE';
    END IF;

    EXECUTE IMMEDIATE q'[
        ALTER TABLE VERIFICATION_CODE ADD CONSTRAINT CK_VCD_PURPOSE
            CHECK (PURPOSE_CODE IN ('SIGNUP', 'FIND_PASSWORD', 'CHANGE_EMAIL', 'ADMIN_LOGIN', 'FIND_ID'))]';
END;
/

-- 확인: CK_VCD_PURPOSE, ENABLED와 함께 조건에 'FIND_ID'가 보이면 된다.
SELECT CONSTRAINT_NAME, STATUS, SEARCH_CONDITION
  FROM USER_CONSTRAINTS
 WHERE TABLE_NAME = 'VERIFICATION_CODE' AND CONSTRAINT_NAME = 'CK_VCD_PURPOSE';
