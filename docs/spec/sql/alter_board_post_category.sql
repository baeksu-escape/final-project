-- v0.3.2 (C15) N-06 신용 라운지 글 카테고리(FP-261): 기존 DB의 BOARD_POST에 CATEGORY_CODE 열을 추가한다.
--   코드: CREDIT_SCORE 신용점수, LOAN 대출·상환, CARD 카드·결제, EMPLOYEE 직장인, SELF_EMPLOYED 자영업, FREELANCER 프리랜서, FREE 자유
-- 누가·언제·어디에: 기존 DB(공용 DB는 PR 작성자가 병합 후 실행하고 DB 변경 채널에 남긴다 — sql README 「공용 DB 적용 규칙」, 로컬은 각자)에서 스키마 소유자로 실행한다.
--   새로 DDL(avenue_ddl.sql)을 실행하는 DB는 필요 없다.
-- 글·댓글·신고는 지우거나 바꾸지 않는다. 이미 있는 글은 모두 '자유'(FREE)가 된다.
-- 이 열이 없는 DB에서는 라운지 글 목록·상세·글쓰기가 ORA-00904 오류를 낸다. 열만 먼저 추가해도 이전 코드는 그대로 동작한다.
-- 이미 열이 있으면 건너뛰므로 다시 실행해도 된다.
-- Oracle DDL은 실행 전후에 자동 커밋되므로, 커밋하지 않은 작업이 없는 세션에서 실행한다.
-- SQL Developer는 "스크립트 실행"(F5)으로 실행한다.
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE
WHENEVER OSERROR EXIT FAILURE

DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'BOARD_POST' AND COLUMN_NAME = 'CATEGORY_CODE';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE q'[
            ALTER TABLE BOARD_POST ADD (
                CATEGORY_CODE VARCHAR2(20 CHAR) DEFAULT 'FREE' NOT NULL
                CONSTRAINT CK_BPT_CATEGORY CHECK (CATEGORY_CODE IN ('CREDIT_SCORE', 'LOAN', 'CARD', 'EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER', 'FREE'))
            )]';
    END IF;
END;
/

COMMENT ON COLUMN BOARD_POST.CATEGORY_CODE IS 'v0.3.2 (C15) 글 카테고리 (N-06). CREDIT_SCORE=신용점수, LOAN=대출·상환, CARD=카드·결제, EMPLOYEE=직장인, SELF_EMPLOYED=자영업, FREELANCER=프리랜서, FREE=자유(기본값)';

-- 확인 1: CATEGORY_CODE, VARCHAR2, 20, N이 나오면 된다.
SELECT COLUMN_NAME, DATA_TYPE, CHAR_LENGTH, NULLABLE
  FROM USER_TAB_COLUMNS
 WHERE TABLE_NAME = 'BOARD_POST' AND COLUMN_NAME = 'CATEGORY_CODE';

-- 확인 2: CK_BPT_CATEGORY, ENABLED가 나오면 된다.
SELECT CONSTRAINT_NAME, STATUS FROM USER_CONSTRAINTS WHERE CONSTRAINT_NAME = 'CK_BPT_CATEGORY';

-- 확인 3: 처음 실행한 뒤에는 이미 있던 글이 모두 FREE로 나온다(글이 없으면 결과 없음).
SELECT CATEGORY_CODE, COUNT(*) AS POST_COUNT FROM BOARD_POST GROUP BY CATEGORY_CODE ORDER BY CATEGORY_CODE;
