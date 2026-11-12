-- N-05·N-37 서비스 DB 합성 시드 (DDL: docs/spec/sql/avenue_ddl.sql). 별도 개발 스키마 권장.
SET DEFINE OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
WHENEVER OSERROR EXIT FAILURE ROLLBACK
@@00_drop_all.sql
@@01_create_tables.sql
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
