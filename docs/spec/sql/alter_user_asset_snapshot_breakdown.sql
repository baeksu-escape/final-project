-- v0.3.2 (C11) N-05-4 기존 DB의 USER_ASSET_SNAPSHOT에 자산 4종 열과 음수 방지 CHECK 4개를 추가한다.
--   예금·적금 DEPOSIT_AMT, 투자 INVESTMENT_AMT, 부동산·보증금 REAL_ESTATE_AMT, 기타 자산 OTHER_ASSET_AMT (모두 NUMBER(15), NULL 허용)
-- 누가·언제·어디에: 기존 DB(공용 DB는 DB 담당, 로컬은 각자)에서 스키마 소유자로 한 번 실행한다. 새로 DDL(avenue_ddl.sql)을 실행하는 DB는 필요 없다.
-- 기존 행의 값은 바꾸지 않는다. 새 4개 열은 NULL로 남고 총자산(TOTAL_ASSET_AMT)은 그대로다.
--   서버는 4종이 모두 NULL인 옛 행(C11 전에 저장)을 화면에 돌려줄 때 기타 자산 칸에 총자산을 넣는다.
-- 이미 열이 있으면 ALTER가 오류(ORA-01430)를 내고 여기서 멈춘다. 다시 실행하지 않는다.
-- Oracle DDL은 실행 전후에 자동 커밋되므로, 커밋하지 않은 작업이 없는 세션에서 실행한다.
-- SQL Developer는 "스크립트 실행"(F5)으로 실행한다.
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE
WHENEVER OSERROR EXIT FAILURE

-- 열 4개와 CHECK 4개를 한 문장으로 추가한다(하나라도 실패하면 아무것도 추가되지 않는다). 이름은 avenue_ddl.sql과 같다.
ALTER TABLE USER_ASSET_SNAPSHOT ADD (
    DEPOSIT_AMT     NUMBER(15) CONSTRAINT CK_UAS_DEPOSIT_AMT CHECK (DEPOSIT_AMT >= 0),
    INVESTMENT_AMT  NUMBER(15) CONSTRAINT CK_UAS_INVESTMENT_AMT CHECK (INVESTMENT_AMT >= 0),
    REAL_ESTATE_AMT NUMBER(15) CONSTRAINT CK_UAS_REAL_ESTATE_AMT CHECK (REAL_ESTATE_AMT >= 0),
    OTHER_ASSET_AMT NUMBER(15) CONSTRAINT CK_UAS_OTHER_ASSET_AMT CHECK (OTHER_ASSET_AMT >= 0)
);

-- 열 주석 — avenue_ddl.sql과 같은 문구다.
COMMENT ON COLUMN USER_ASSET_SNAPSHOT.DEPOSIT_AMT IS 'v0.3.2 (C11) 예금·적금 (N-05-4). NULL은 미입력, 0은 없음. 합계는 TOTAL_ASSET_AMT';
COMMENT ON COLUMN USER_ASSET_SNAPSHOT.INVESTMENT_AMT IS 'v0.3.2 (C11) 투자(주식·펀드 등) (N-05-4). NULL은 미입력, 0은 없음. 합계는 TOTAL_ASSET_AMT';
COMMENT ON COLUMN USER_ASSET_SNAPSHOT.REAL_ESTATE_AMT IS 'v0.3.2 (C11) 부동산·보증금 (N-05-4). NULL은 미입력, 0은 없음. 합계는 TOTAL_ASSET_AMT';
COMMENT ON COLUMN USER_ASSET_SNAPSHOT.OTHER_ASSET_AMT IS 'v0.3.2 (C11) 기타 자산 (N-05-4). NULL은 미입력, 0은 없음. 합계는 TOTAL_ASSET_AMT';
COMMENT ON COLUMN USER_ASSET_SNAPSHOT.TOTAL_ASSET_AMT IS '총자산 (N-05-4·N-05-8). NULL은 미입력, 0은 자산 없음. v0.3.2 (C11) 4종 합계(C11부터). C11 전에 저장한 행은 합계만 있다';

-- 확인: 새 열 4개(DEPOSIT_AMT·INVESTMENT_AMT·REAL_ESTATE_AMT·OTHER_ASSET_AMT)가 TOTAL_ASSET_AMT 앞뒤 어딘가에 보이면 된다(기존 DB에서는 표의 끝에 붙는다).
SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'USER_ASSET_SNAPSHOT' ORDER BY COLUMN_ID;
