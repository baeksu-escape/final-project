-- N-24 상권 분석을 프론트 정적 JSON으로 전환하여 기존 DB의 상권 전용 표 5개를 제거한다.
-- 대상 Oracle 21c 스키마의 소유자로 단독 실행한다. 이 스크립트는 해당 표의 데이터도 삭제한다.
-- DDL은 자동 커밋되므로 미커밋 업무가 없는 별도 세션에서 실행한다. 파일 배포만으로 DB가 바뀌지는 않는다.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

BEGIN
    -- N-24 자식 표부터 제거하며 이미 없는 표는 건너뛰어 부분 적용 뒤에도 재실행할 수 있다.
    -- CASCADE CONSTRAINTS를 쓰지 않아 다른 표의 예상하지 못한 참조 제약은 자동 제거하지 않는다.
    FOR t IN (
        SELECT 1 AS step_no, 'FACT_DONG_LIVING_POP' AS table_name FROM DUAL
        UNION ALL SELECT 2, 'FACT_DONG_STORE' FROM DUAL
        UNION ALL SELECT 3, 'FACT_DONG_SALES' FROM DUAL
        UNION ALL SELECT 4, 'DIM_SERVICE_CATEGORY' FROM DUAL
        UNION ALL SELECT 5, 'DIM_ADM_DONG' FROM DUAL
        ORDER BY step_no
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE 'DROP TABLE ' || t.table_name;
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE != -942 THEN
                    RAISE;
                END IF;
        END;
    END LOOP;
END;
/

-- N-24 실행 후 0행이어야 한다. 공공통계·회원·평가 테이블은 이 스크립트의 대상이 아니다.
SELECT TABLE_NAME
  FROM USER_TABLES
 WHERE TABLE_NAME IN (
     'DIM_ADM_DONG', 'DIM_SERVICE_CATEGORY',
     'FACT_DONG_SALES', 'FACT_DONG_STORE', 'FACT_DONG_LIVING_POP');
