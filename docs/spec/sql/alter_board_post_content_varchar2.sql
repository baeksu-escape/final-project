-- N-06 기존 DB의 BOARD_POST.CONTENT를 CLOB에서 VARCHAR2(1300 CHAR)로 바꾼다 (DDL v0.3.2 C9, 2026-11-17).
-- Oracle은 CLOB 열을 VARCHAR2로 바로 MODIFY할 수 없어(ORA-22859) 새 열 추가 → 복사 → 기존 열 삭제 → 이름 변경 순서로 바꾼다.
-- 1300자를 넘는 글이 있으면 자르지 않고 오류로 멈춘다. 그 글을 먼저 확인한 뒤 다시 실행한다.
-- 바꾼 뒤 CONTENT는 표의 맨 뒤 열이 된다. Spring 매퍼는 열 이름으로 읽으므로 동작은 같다.
-- SQL*Plus/SQLcl/SQL Developer(F5)에서 대상 스키마 소유자로 단독 실행한다. 이미 바뀐 DB에서 다시 실행하면 아무것도 하지 않는다.
-- Oracle DDL은 실행 전후 자동 커밋되므로 미커밋 업무가 없는 별도 세션을 사용한다. 중간에 멈추면 원인을 고친 뒤 같은 파일을 다시 실행한다.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

DECLARE
    v_content_type VARCHAR2(128);
    v_new_count NUMBER;
    v_too_long NUMBER;
BEGIN
    SELECT MAX(DATA_TYPE) INTO v_content_type
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'BOARD_POST' AND COLUMN_NAME = 'CONTENT';
    SELECT COUNT(*) INTO v_new_count
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'BOARD_POST' AND COLUMN_NAME = 'CONTENT_NEW';

    -- 이미 바뀐 DB는 건너뛴다.
    IF v_content_type = 'VARCHAR2' AND v_new_count = 0 THEN
        RETURN;
    END IF;

    IF v_content_type = 'CLOB' THEN
        -- 1300자를 넘는 글은 잘라서 옮기지 않는다.
        EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM BOARD_POST WHERE DBMS_LOB.GETLENGTH(CONTENT) > 1300' INTO v_too_long;
        IF v_too_long > 0 THEN
            RAISE_APPLICATION_ERROR(-20001, '본문이 1300자를 넘는 글이 ' || v_too_long || '건 있습니다. 먼저 확인해 주세요');
        END IF;

        IF v_new_count = 0 THEN
            EXECUTE IMMEDIATE 'ALTER TABLE BOARD_POST ADD (CONTENT_NEW VARCHAR2(1300 CHAR))';
        END IF;
        EXECUTE IMMEDIATE 'UPDATE BOARD_POST SET CONTENT_NEW = DBMS_LOB.SUBSTR(CONTENT, 1300, 1)';
        COMMIT;
        EXECUTE IMMEDIATE 'ALTER TABLE BOARD_POST DROP COLUMN CONTENT';
    ELSIF v_content_type IS NOT NULL THEN
        RAISE_APPLICATION_ERROR(-20002, 'BOARD_POST.CONTENT 타입이 ' || v_content_type || '입니다. 자동 변경하지 않습니다');
    ELSIF v_new_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'BOARD_POST에 CONTENT·CONTENT_NEW 열이 모두 없습니다');
    END IF;

    -- 앞 단계가 끝났거나, 지난 실행이 기존 열 삭제 뒤에 멈춘 경우
    EXECUTE IMMEDIATE 'ALTER TABLE BOARD_POST RENAME COLUMN CONTENT_NEW TO CONTENT';
    EXECUTE IMMEDIATE 'ALTER TABLE BOARD_POST MODIFY (CONTENT NOT NULL)';
END;
/

COMMENT ON COLUMN BOARD_POST.CONTENT IS 'v0.3.2 (C9) 본문. 1300자까지 (Spring @Size와 같은 값)';

-- N-06 실행 후 타입·길이·NULL 허용을 확인한다. VARCHAR2, 1300, N이면 된다.
SELECT COLUMN_NAME, DATA_TYPE, CHAR_LENGTH, CHAR_USED, NULLABLE
  FROM USER_TAB_COLUMNS
 WHERE TABLE_NAME = 'BOARD_POST' AND COLUMN_NAME IN ('CONTENT', 'CONTENT_NEW');
