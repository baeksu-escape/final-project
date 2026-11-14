-- N-05·N-37 서비스 DB 합성 시드 (DDL: docs/spec/sql/avenue_ddl.sql). 별도 개발 스키마 권장.
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
-- N-05 확정 DDL 실행 후 빈 시드 대상 표에만 최초 적재한다.
DECLARE
  table_count PLS_INTEGER;
  row_count PLS_INTEGER;
BEGIN
  FOR t IN (SELECT COLUMN_VALUE AS table_name FROM TABLE(SYS.ODCIVARCHAR2LIST('APP_USER', 'USER_CONSENT', 'USER_INCOME_MONTH', 'USER_LOAN', 'USER_ASSET_SNAPSHOT', 'USER_EXPENSE_ITEM', 'USER_TELECOM_PAYMENT', 'USER_UTILITY_PAYMENT', 'USER_EASYPAY_USAGE', 'USER_SOCIAL_INSURANCE_PAYMENT', 'USER_CREDIT_PROFILE', 'SCORE_BAND_OFFER', 'LOAN_PRODUCT', 'LOAN_PRODUCT_WORKER_TYPE', 'LOAN_PRODUCT_FEATURE'))) LOOP
    SELECT COUNT(*) INTO table_count FROM USER_TABLES WHERE TABLE_NAME = t.table_name;
    IF table_count != 1 THEN RAISE_APPLICATION_ERROR(-20002, '시드 대상 테이블이 없습니다: ' || t.table_name); END IF;
    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM ' || t.table_name || ' WHERE ROWNUM = 1' INTO row_count;
    IF row_count != 0 THEN RAISE_APPLICATION_ERROR(-20003, '시드 대상 테이블이 비어 있지 않습니다: ' || t.table_name); END IF;
  END LOOP;
END;
/
@@10_seed_app_user.sql
@@11_seed_user_consent.sql
@@12_seed_user_income_month.sql
@@13_seed_user_loan.sql
@@14_seed_user_asset_snapshot.sql
@@15_seed_user_expense_item.sql
@@16_seed_user_telecom_payment.sql
@@17_seed_user_utility_payment.sql
@@18_seed_user_easypay_usage.sql
@@19_seed_user_social_insurance_payment.sql
@@20_seed_user_credit_profile.sql
@@21_seed_score_band_offer.sql
@@22_seed_loan_product.sql
@@23_seed_loan_product_worker_type.sql
@@24_seed_loan_product_feature.sql
@@99_check.sql
