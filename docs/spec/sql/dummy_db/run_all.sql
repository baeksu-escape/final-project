-- 생성: tools/build_db.py (손으로 고치지 말고 생성기를 고쳐 다시 만든다)
-- 대상: Oracle 21c, UTF-8

-- SQL*Plus / SQL Developer(F5 스크립트 실행)에서 db 폴더 기준으로 실행
-- v2.1: 오류가 나면 그 자리에서 되돌리고 멈춘다(이전에는 계속 진행해 99_check에서야 드러났다)
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

@@00_drop_all.sql
@@01_create_tables.sql
@@02_constraints.sql
@@11_seed_app_member.sql
@@12_seed_member_monthly_input.sql
@@13_seed_loan_product.sql
@@14_seed_loan_product_job_type.sql
@@15_seed_external_api_response.sql
@@16_seed_member_loan.sql
@@17_seed_member_card.sql
@@18_seed_member_card_usage.sql
@@19_seed_member_telecom_bill.sql
@@20_seed_member_payment_monthly.sql
@@21_seed_member_social_insurance.sql
@@22_seed_member_credit_bureau.sql
@@23_seed_member_utility_bill.sql
@@99_check.sql
