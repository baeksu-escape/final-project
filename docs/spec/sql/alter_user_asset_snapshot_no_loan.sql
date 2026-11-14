-- N-05-3·N-05-4·N-05-8 기존 DB의 자산 NULL 허용과 대출 입력 확인 상태를 추가한다.
-- 기존 행의 NO_LOAN_YN은 NULL로 유지한다. 대출 행이 없어도 Y로 추정하지 않는다.
-- SQL*Plus/SQLcl에서 대상 스키마 소유자로 단독 실행한다. 동시 스키마 변경은 피한다.
-- Oracle DDL은 실행 전후 자동 커밋되므로 미커밋 업무가 없는 별도 세션을 사용한다.
-- 중간 실패 시 앞선 DDL은 유지된다. 원인을 확인한 뒤 같은 파일을 재실행한다.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

DECLARE
    v_nullable VARCHAR2(1);
    v_count NUMBER;
    v_data_type VARCHAR2(128);
    v_char_length NUMBER;
    v_default_length NUMBER;
    v_table_name VARCHAR2(128);
    v_constraint_type VARCHAR2(1);
    v_condition VARCHAR2(4000);
BEGIN
    -- N-05-4·N-05-8 이미 NULL을 허용하면 MODIFY를 생략해 재실행 오류를 피한다.
    SELECT NULLABLE INTO v_nullable
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'USER_ASSET_SNAPSHOT' AND COLUMN_NAME = 'TOTAL_ASSET_AMT';
    IF v_nullable = 'N' THEN
        EXECUTE IMMEDIATE 'ALTER TABLE USER_ASSET_SNAPSHOT MODIFY (TOTAL_ASSET_AMT NULL)';
    END IF;

    -- N-05-3·N-05-8 부분 적용으로 열만 존재하면 정의를 확인하고 CHECK 추가로 이어간다.
    SELECT COUNT(*) INTO v_count FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'USER_ASSET_SNAPSHOT' AND COLUMN_NAME = 'NO_LOAN_YN';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE USER_ASSET_SNAPSHOT ADD (NO_LOAN_YN CHAR(1))';
    ELSE
        SELECT DATA_TYPE, CHAR_LENGTH, NULLABLE, DEFAULT_LENGTH
          INTO v_data_type, v_char_length, v_nullable, v_default_length
          FROM USER_TAB_COLUMNS
         WHERE TABLE_NAME = 'USER_ASSET_SNAPSHOT' AND COLUMN_NAME = 'NO_LOAN_YN';
        IF v_data_type <> 'CHAR' OR v_char_length <> 1 OR v_nullable <> 'Y'
           OR NVL(v_default_length, 0) <> 0 THEN
            RAISE_APPLICATION_ERROR(-20001, 'NO_LOAN_YN 정의 불일치: nullable CHAR(1), 기본값 없음이 필요합니다');
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_count FROM USER_CONSTRAINTS
     WHERE CONSTRAINT_NAME = 'CK_UAS_NO_LOAN';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE USER_ASSET_SNAPSHOT ADD CONSTRAINT CK_UAS_NO_LOAN CHECK (NO_LOAN_YN IN (''Y'', ''N''))';
    ELSE
        SELECT TABLE_NAME, CONSTRAINT_TYPE, SEARCH_CONDITION_VC
          INTO v_table_name, v_constraint_type, v_condition
          FROM USER_CONSTRAINTS WHERE CONSTRAINT_NAME = 'CK_UAS_NO_LOAN';
        IF v_table_name <> 'USER_ASSET_SNAPSHOT' OR v_constraint_type <> 'C'
           OR NVL(REGEXP_REPLACE(v_condition, '[[:space:]"()]', ''), '?') <> 'NO_LOAN_YNIN''Y'',''N''' THEN
            RAISE_APPLICATION_ERROR(-20002, 'CK_UAS_NO_LOAN 정의 불일치: 자동 변경하지 않습니다');
        END IF;
        EXECUTE IMMEDIATE 'ALTER TABLE USER_ASSET_SNAPSHOT ENABLE VALIDATE CONSTRAINT CK_UAS_NO_LOAN';
    END IF;
END;
/

COMMENT ON COLUMN USER_ASSET_SNAPSHOT.TOTAL_ASSET_AMT IS '총자산 (N-05-4·N-05-8). NULL은 미입력, 0은 자산 없음';
COMMENT ON COLUMN USER_ASSET_SNAPSHOT.NO_LOAN_YN IS '대출 입력 확인 상태 (N-05-3·N-05-8). NULL은 미입력/미확인, Y는 대출 없음 선택, N은 대출 있음';

-- N-05-3·N-05-4·N-05-8 실행 후 두 열의 NULL 허용·타입·기본값을 확인한다.
SELECT COLUMN_NAME, DATA_TYPE, DATA_PRECISION, CHAR_LENGTH, NULLABLE, DATA_DEFAULT
  FROM USER_TAB_COLUMNS
 WHERE TABLE_NAME = 'USER_ASSET_SNAPSHOT'
   AND COLUMN_NAME IN ('TOTAL_ASSET_AMT', 'NO_LOAN_YN')
 ORDER BY COLUMN_ID;

-- N-05-3·N-05-4·N-05-8 기존 음수 방지와 Y/N CHECK의 활성화·검증 상태를 확인한다.
SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, STATUS, VALIDATED, SEARCH_CONDITION_VC
  FROM USER_CONSTRAINTS
 WHERE TABLE_NAME = 'USER_ASSET_SNAPSHOT'
   AND CONSTRAINT_NAME IN ('CK_UAS_AMT', 'CK_UAS_NO_LOAN')
 ORDER BY CONSTRAINT_NAME;
