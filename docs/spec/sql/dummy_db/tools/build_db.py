"""서비스 더미(service_dummy/)를 Oracle 21c용 DDL·시드 SQL로 바꾸고, 같은 명세로 정합성을 검사한다.

사용: python3 -I tools/build_db.py <service_dummy 폴더> <출력 db 폴더>  (데이터 패키지와 별도로 이 DB 묶음에 들어 있다)
테이블 정의(TABLES) 한 곳에서 DDL, 시드, 검사를 모두 만든다.
v2.2: 신용평가사·공과금 응답 정리 테이블, 서비스 등급 결과 틀(MEMBER_CREDIT_GRADE, 시드 없음), 월 입력 6개월.
"""
import csv
import json
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

JOB_MAP = {"wage": "EMPLOYEE", "selfemp": "SELF_EMPLOYED", "freelance": "FREELANCER"}
JOB_CODES = list(JOB_MAP.values())
JOB_COMMENT = "직군 코드 (EMPLOYEE=급여소득자, SELF_EMPLOYED=자영업자, FREELANCER=프리랜서)"
SECTOR_COMMENT = "업권 코드 (0 은행, 1 카드, 2 저축은행, 3 캐피탈, 4 대부, 5 상호금융, 6 보험)"
YN = ["Y", "N"]
MONTH_RE = r"^\d{4}-(0[1-9]|1[0-2])$"


def col(name, typ, comment, null=False, default=None, values=None, regex=None, rng=None, identity=False):
    return dict(name=name, type=typ, comment=comment, null=null, default=default,
                values=values, regex=regex, rng=rng, identity=identity)


AUDIT = [
    col("CREATED_AT", "TIMESTAMP", "생성 일시", default="SYSTIMESTAMP"),
    col("UPDATED_AT", "TIMESTAMP", "수정 일시", null=True),
]

TABLES = [
    dict(name="APP_MEMBER", comment="회원 기본 정보 (더미 회원 400명 포함)", cols=[
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_CODE", "VARCHAR2(20 CHAR)", "회원 코드 (더미는 MEM+6자리, 외부 API 응답·원장과 연결하는 키)"),
        col("EMAIL", "VARCHAR2(100 CHAR)", "로그인 이메일 (더미는 example.com)"),
        col("PASSWORD_HASH", "VARCHAR2(100 CHAR)", "BCrypt 해시 비밀번호 (더미 회원은 NULL)", null=True),
        col("NICKNAME", "VARCHAR2(30 CHAR)", "닉네임"),
        col("BIRTH_YEAR", "NUMBER(4)", "출생연도 (연령대는 이 값으로 계산)", rng=(1900, 2026)),
        col("JOB_TYPE_CODE", "VARCHAR2(20 CHAR)", JOB_COMMENT, values=JOB_CODES),
        col("ROLE_CODE", "VARCHAR2(20 CHAR)", "권한 (ROLE_USER, ROLE_ADMIN)", default="'ROLE_USER'",
            values=["ROLE_USER", "ROLE_ADMIN"]),
        col("EXTERNAL_CONSENT_YN", "CHAR(1)", "외부 금융·통신 데이터 조회 동의 여부 (Y/N)", default="'N'", values=YN),
        col("SIGNUP_DATE", "DATE", "가입일"),
        col("DUMMY_YN", "CHAR(1)", "더미 데이터 여부 (Y/N)", default="'N'", values=YN),
    ] + AUDIT, pk=["MEMBER_ID"], uks=[["MEMBER_CODE"], ["EMAIL"]], fks=[]),

    dict(name="MEMBER_MONTHLY_INPUT", comment="회원이 입력한 월별 소득·지출·상환액 (최근 완결 6개월, v2.2)", cols=[
        col("INPUT_ID", "NUMBER(19)", "월별 입력 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("BASE_MONTH", "VARCHAR2(7 CHAR)", "입력 대상 월 (YYYY-MM)", regex=MONTH_RE),
        col("INCOME_AMT", "NUMBER(15)", "월 소득 (원)", rng=(0, None)),
        col("EXPENSE_AMT", "NUMBER(15)", "월 생활지출 (원)", rng=(0, None)),
        col("DEBT_SERVICE_AMT", "NUMBER(15)", "월 대출 상환액 (원)", rng=(0, None)),
        col("INPUT_DATE", "DATE", "회원이 값을 입력한 날짜"),
    ] + AUDIT, pk=["INPUT_ID"], uks=[["MEMBER_ID", "BASE_MONTH"]], fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID")]),

    dict(name="LOAN_PRODUCT", comment="더미 대출상품 (가상 기관, 상품 권유 아님)", cols=[
        col("PRODUCT_ID", "NUMBER(19)", "상품 ID (PK, 자동 증가)", identity=True),
        col("PRODUCT_CODE", "VARCHAR2(20 CHAR)", "상품 코드 (LP001~)"),
        col("PROVIDER_NAME", "VARCHAR2(50 CHAR)", "가상 금융기관명 (실제 기관명 사용 금지)"),
        col("SECTOR_CODE", "NUMBER(2)", SECTOR_COMMENT, rng=(0, 6)),
        col("SECTOR_NAME", "VARCHAR2(20 CHAR)", "업권명"),
        col("PRODUCT_TYPE_NAME", "VARCHAR2(50 CHAR)", "상품 유형 (일반 신용대출, 카드론 등)"),
        col("RATE_MIN_PCT", "NUMBER(5,2)", "최저 금리 (연 %)", rng=(0, 20)),
        col("RATE_MAX_PCT", "NUMBER(5,2)", "최고 금리 (연 %, 법정 최고금리 20% 이하)", rng=(0, 20)),
        col("RATE_ANCHOR_PCT", "NUMBER(5,2)", "금리 기준점 (연 %, 업권 평균금리)", rng=(0, 20)),
        col("RATE_ANCHOR_BASIS", "VARCHAR2(20 CHAR)", "기준점 근거 (statistic=통계, assumption=가정)",
            values=["statistic", "assumption"]),
        col("RATE_ANCHOR_MONTH", "VARCHAR2(7 CHAR)", "기준점 시점 (YYYY-MM, 가정이면 NULL)", null=True, regex=MONTH_RE),
        col("LIMIT_MIN_AMT", "NUMBER(15)", "최소 한도 (원)", rng=(0, None)),
        col("LIMIT_MAX_AMT", "NUMBER(15)", "최대 한도 (원)", rng=(0, None)),
        col("TERM_MIN_MONTHS", "NUMBER(4)", "최단 기간 (개월)", rng=(1, None)),
        col("TERM_MAX_MONTHS", "NUMBER(4)", "최장 기간 (개월)", rng=(1, None)),
        col("INCOME_MULTIPLE_CAP", "NUMBER(5,2)", "연소득 대비 한도 배수 상한 (가정, NULL이면 상한 없음)", null=True),
        col("BASIS_NOTE", "VARCHAR2(200 CHAR)", "상품 값의 근거 설명", null=True),
        col("BASE_DATE", "DATE", "기준일"),
        col("DUMMY_YN", "CHAR(1)", "더미 데이터 여부 (Y/N)", default="'Y'", values=YN),
    ] + AUDIT, pk=["PRODUCT_ID"], uks=[["PRODUCT_CODE"]], fks=[],
        checks=[("RATE", "RATE_MIN_PCT <= RATE_ANCHOR_PCT AND RATE_ANCHOR_PCT <= RATE_MAX_PCT"),
                ("LIMIT", "LIMIT_MIN_AMT <= LIMIT_MAX_AMT"), ("TERM", "TERM_MIN_MONTHS <= TERM_MAX_MONTHS")]),

    dict(name="LOAN_PRODUCT_JOB_TYPE", comment="대출상품별 대상 직군 (상품 1개에 여러 직군)", cols=[
        col("PRODUCT_ID", "NUMBER(19)", "상품 ID (FK → LOAN_PRODUCT)"),
        col("JOB_TYPE_CODE", "VARCHAR2(20 CHAR)", JOB_COMMENT, values=JOB_CODES),
    ], pk=["PRODUCT_ID", "JOB_TYPE_CODE"], uks=[], fks=[("PRODUCT_ID", "LOAN_PRODUCT", "PRODUCT_ID")]),

    dict(name="EXTERNAL_API_RESPONSE", comment="외부 금융·통신·간편결제·공공보험·신용평가사·공과금 API 응답 원문 (모의 연동, JSON 그대로 저장)", cols=[
        col("RESPONSE_ID", "NUMBER(19)", "응답 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("PROVIDER_TYPE_CODE", "VARCHAR2(20 CHAR)", "응답 기관 구분 (FINANCIAL=금융, TELECOM=통신, PAYMENT=간편결제, PUBLIC_INSURANCE=국민연금·건강보험, CREDIT_BUREAU=신용평가사, UTILITY=공과금)",
            values=["FINANCIAL", "TELECOM", "PAYMENT", "PUBLIC_INSURANCE", "CREDIT_BUREAU", "UTILITY"]),
        col("PROVIDER_NAME", "VARCHAR2(50 CHAR)", "응답 출처 (dummy_financial_api, dummy_telecom_api, dummy_payment_api, dummy_public_insurance_api, dummy_credit_bureau_api, dummy_utility_api)"),
        col("STATUS_CODE", "VARCHAR2(30 CHAR)", "응답 상태 (OK, CONSENT_REQUIRED=동의 없음)",
            values=["OK", "CONSENT_REQUIRED"]),
        col("BASE_DATE", "DATE", "응답 기준일 (통신 응답은 NULL)", null=True),
        col("RESPONSE_JSON", "CLOB", "응답 원문 JSON"),
        col("RECEIVED_AT", "TIMESTAMP", "응답 수신 일시", default="SYSTIMESTAMP"),
        col("DUMMY_YN", "CHAR(1)", "더미 데이터 여부 (Y/N)", default="'Y'", values=YN),
    ] + AUDIT, pk=["RESPONSE_ID"], uks=[], fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID")],
        checks=[("JSON", "RESPONSE_JSON IS JSON")]),

    dict(name="MEMBER_LOAN", comment="외부 금융 응답에서 정리한 회원 대출 계좌 (동의 회원만)", cols=[
        col("LOAN_ID", "NUMBER(19)", "대출 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("ACCOUNT_CODE", "VARCHAR2(30 CHAR)", "대출 계좌 코드 (회원코드_L순번)"),
        col("SECTOR_CODE", "NUMBER(2)", SECTOR_COMMENT, rng=(0, 6)),
        col("LOAN_KIND_CODE", "NUMBER(2)", "상품 종류 코드 (0~8, 원본 생성기 코드, 의미 미확정)", rng=(0, 8)),
        col("INSTITUTION_ID", "NUMBER(5)", "가상 기관 ID (업권×100 + 1~15)", rng=(0, None)),
        col("BALANCE_AMT", "NUMBER(15)", "현재 잔액 (원)", rng=(0, None)),
        col("ANNUAL_RATE", "NUMBER(7,6)", "연 금리 (소수, 0.072 = 7.2%)", rng=(0, 1)),
        col("REMAINING_MONTHS", "NUMBER(4)", "잔여 개월 수", rng=(0, None)),
        col("OPENED_DATE", "DATE", "개설일"),
        col("ANNUAL_SERVICE_AMT", "NUMBER(15)", "연간 상환 근사액 (원, DSR 계산용)", rng=(0, None)),
        col("BASE_DATE", "DATE", "기준일"),
    ] + AUDIT, pk=["LOAN_ID"], uks=[["ACCOUNT_CODE"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")]),

    dict(name="MEMBER_CARD", comment="외부 금융 응답에서 정리한 회원 카드 계좌 (동의 회원만)", cols=[
        col("CARD_ID", "NUMBER(19)", "카드 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("ACCOUNT_CODE", "VARCHAR2(30 CHAR)", "카드 계좌 코드 (회원코드_C순번)"),
        col("INSTITUTION_ID", "NUMBER(5)", "가상 카드 기관 ID (1~8)", rng=(0, None)),
        col("OPENED_DATE", "DATE", "개설일"),
        col("ACTIVE_YN", "CHAR(1)", "미해지 여부 (Y/N)", values=YN),
        col("BASE_DATE", "DATE", "기준일"),
    ] + AUDIT, pk=["CARD_ID"], uks=[["ACCOUNT_CODE"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")]),

    dict(name="MEMBER_CARD_USAGE", comment="외부 금융 응답에서 정리한 카드 30일 구간별 이용액 (동의 회원만)", cols=[
        col("USAGE_ID", "NUMBER(19)", "이용액 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("PERIOD_OFFSET", "NUMBER(2)", "30일 구간 번호 (0=가장 최근, 11=가장 오래됨)", rng=(0, 99)),
        col("PERIOD_START_DATE", "DATE", "구간 시작일"),
        col("PERIOD_END_DATE", "DATE", "구간 종료일"),
        col("CREDIT_SPEND_AMT", "NUMBER(15)", "신용카드 총사용액 (원, 일시불+할부+현금서비스)", rng=(0, None)),
        col("CASH_ADVANCE_AMT", "NUMBER(15)", "현금서비스 사용액 (원)", rng=(0, None)),
        col("DEBIT_SPEND_AMT", "NUMBER(15)", "체크카드 사용액 (원)", rng=(0, None)),
        col("BASE_DATE", "DATE", "기준일"),
    ] + AUDIT, pk=["USAGE_ID"], uks=[["MEMBER_ID", "PERIOD_START_DATE"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")],
        checks=[("PERIOD", "PERIOD_START_DATE <= PERIOD_END_DATE")]),

    dict(name="MEMBER_TELECOM_BILL", comment="외부 통신 응답에서 정리한 월별 통신요금 청구·납부 (동의 회원만)", cols=[
        col("BILL_ID", "NUMBER(19)", "청구 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("BILL_MONTH", "VARCHAR2(7 CHAR)", "청구월 (YYYY-MM)", regex=MONTH_RE),
        col("BILLED_AMT", "NUMBER(15)", "청구액 (원)", rng=(0, None)),
        col("DUE_DATE", "DATE", "납부기한"),
        col("PAID_DATE", "DATE", "납부일 (기준일까지 미납이면 NULL)", null=True),
        col("PAYMENT_STATUS_CODE", "VARCHAR2(10 CHAR)", "납부 상태 (ON_TIME=정시, LATE=연체)", values=["ON_TIME", "LATE"]),
    ] + AUDIT, pk=["BILL_ID"], uks=[["MEMBER_ID", "BILL_MONTH"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")]),

    dict(name="MEMBER_PAYMENT_MONTHLY", comment="외부 간편결제 응답에서 정리한 월별 결제 이용 (동의 회원만, v2 추가)", cols=[
        col("PAYMENT_ID", "NUMBER(19)", "결제 월 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("BASE_MONTH", "VARCHAR2(7 CHAR)", "이용 월 (YYYY-MM)", regex=MONTH_RE),
        col("PROVIDER_SCOPE", "VARCHAR2(30 CHAR)", "결제 서비스 범위 (npay_synthetic=가상 간편결제, 실제 거래 아님)"),
        col("OBSERVATION_STATUS_CODE", "VARCHAR2(20 CHAR)", "관측 상태 (OBSERVED=이용 있음, NO_ACTIVITY=이용 0회, MISSING=미수집)",
            values=["OBSERVED", "NO_ACTIVITY", "MISSING"]),
        col("PAYMENT_COUNT", "NUMBER(6)", "월 결제 건수", rng=(0, None)),
        col("PAYMENT_AMT", "NUMBER(15)", "월 결제 금액 (원, 생활지출의 일부)", rng=(0, None)),
        col("ACTIVE_DAYS", "NUMBER(2)", "월 결제일 수", rng=(0, 31)),
    ] + AUDIT, pk=["PAYMENT_ID"], uks=[["MEMBER_ID", "BASE_MONTH"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")],
        checks=[("ZERO", "(PAYMENT_COUNT = 0 AND PAYMENT_AMT = 0 AND ACTIVE_DAYS = 0) OR (PAYMENT_COUNT > 0 AND PAYMENT_AMT > 0 AND ACTIVE_DAYS BETWEEN 1 AND PAYMENT_COUNT)")]),

    dict(name="MEMBER_SOCIAL_INSURANCE", comment="외부 공공보험 응답에서 정리한 국민연금·건강보험 월별 고지·납부 (동의 회원만, v2 추가)", cols=[
        col("SI_ID", "NUMBER(19)", "보험 월 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("INSURANCE_TYPE_CODE", "VARCHAR2(20 CHAR)", "보험 종류 (NATIONAL_PENSION=국민연금, HEALTH_INSURANCE=건강보험)",
            values=["NATIONAL_PENSION", "HEALTH_INSURANCE"]),
        col("BASE_MONTH", "VARCHAR2(7 CHAR)", "고지 월 (YYYY-MM)", regex=MONTH_RE),
        col("COVERAGE_STATUS_CODE", "VARCHAR2(20 CHAR)", "적용 상태 (COVERED=납부 대상, EXEMPT=납부예외, DEPENDENT=피부양자, NOT_COVERED=미적용, UNKNOWN=미확인)",
            values=["COVERED", "EXEMPT", "DEPENDENT", "NOT_COVERED", "UNKNOWN"]),
        col("PAYER_TYPE_CODE", "VARCHAR2(20 CHAR)", "가입 유형 (WORKPLACE=사업장·직장, REGIONAL=지역, VOLUNTARY=임의, HOUSEHOLD=세대·피부양, UNKNOWN=미확인)",
            values=["WORKPLACE", "REGIONAL", "VOLUNTARY", "HOUSEHOLD", "UNKNOWN"]),
        col("BILLED_AMT", "NUMBER(15)", "고지된 총 보험료 (원, 사업장은 사용자분 포함)", rng=(0, None)),
        col("INDIVIDUAL_AMT", "NUMBER(15)", "본인 부담 보험료 (원)", rng=(0, None)),
        col("PAID_AMT", "NUMBER(15)", "본인 부담분 중 납부액 (원)", rng=(0, None)),
        col("DUE_DATE", "DATE", "납부기한 (다음 달 10일, 납부 의무 없으면 NULL)", null=True),
        col("PAID_DATE", "DATE", "납부일 (내지 않았으면 NULL)", null=True),
        col("PAYMENT_STATUS_CODE", "VARCHAR2(20 CHAR)", "납부 상태 (ON_TIME=기한 내, LATE=기한 후 완납, PARTIAL=일부 납부, UNPAID=미납, NOT_DUE=기한 전, NOT_APPLICABLE=의무 없음, UNKNOWN=미확인)",
            values=["ON_TIME", "LATE", "PARTIAL", "UNPAID", "NOT_DUE", "NOT_APPLICABLE", "UNKNOWN"]),
    ] + AUDIT, pk=["SI_ID"], uks=[["MEMBER_ID", "INSURANCE_TYPE_CODE", "BASE_MONTH"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")],
        checks=[("AMT", "PAID_AMT <= INDIVIDUAL_AMT AND INDIVIDUAL_AMT <= BILLED_AMT")]),

    # v2.2: 아래 세 테이블은 뒤에 붙여 기존 시드 파일 번호와 응답 ID가 바뀌지 않게 한다
    dict(name="MEMBER_CREDIT_BUREAU", comment="외부 신용평가사 응답에서 정리한 주요 신용정보 (동의 회원만, v2.2 추가. 207열 전체는 응답 원문에만 있다)", cols=[
        col("BUREAU_ID", "NUMBER(19)", "신용정보 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("CB_GRADE", "NUMBER(2)", "교육용 신용등급 CB (1 우량~10 고위험, 공식 점수 아님, 서비스 3등급과 별개. 산출 불가면 NULL)", null=True, rng=(1, 10)),
        col("CB_AVAILABLE_YN", "CHAR(1)", "교육용 등급 산출 여부 (Y/N, N이면 CB_GRADE NULL)", values=YN),
        col("RECENT_DELINQ_YN", "CHAR(1)", "최근 1년 30일 이상 연체 경험 (SP, Y/N, 신용이력 없으면 NULL)", null=True, values=YN),
        col("DELINQ_COUNT_12M", "NUMBER(4)", "12개월 내 30일 이상 연체 건수 (DQ1200001, 신용이력 없으면 NULL)", null=True, rng=(0, None)),
        col("MAX_DELINQ_DAYS_3M", "NUMBER(5)", "최근 3개월 내 최장 연체일수 (KC5000016, 신용이력 없으면 NULL)", null=True, rng=(0, None)),
        col("LOAN_COUNT", "NUMBER(4)", "미상환 대출 건수 (L00000001)", rng=(0, None)),
        col("LOAN_BALANCE_AMT", "NUMBER(15)", "미상환 대출 총액 (원, L00000002 천원 × 1000)", rng=(0, None)),
        col("CARD_UTIL_PCT", "NUMBER(7,2)", "주사용 신용카드 최근 6개월 평균 한도소진율 (%, CL0631905, 최근 이용 없으면 NULL)", null=True, rng=(0, None)),
        col("CREDIT_HISTORY_DAYS", "NUMBER(6)", "신용이력 길이 (일)", rng=(0, None)),
        col("BASE_DATE", "DATE", "기준일"),
    ] + AUDIT, pk=["BUREAU_ID"], uks=[["MEMBER_ID"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")],
        checks=[("CB", "(CB_AVAILABLE_YN = 'Y' AND CB_GRADE IS NOT NULL) OR (CB_AVAILABLE_YN = 'N' AND CB_GRADE IS NULL)")]),

    dict(name="MEMBER_UTILITY_BILL", comment="외부 공과금 응답에서 정리한 월별 공과금(전기·가스·수도 합산) 청구·납부 (동의 회원만, v2.2 추가)", cols=[
        col("BILL_ID", "NUMBER(19)", "청구 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("SOURCE_RESPONSE_ID", "NUMBER(19)", "근거 응답 ID (FK → EXTERNAL_API_RESPONSE)", null=True),
        col("BILL_MONTH", "VARCHAR2(7 CHAR)", "청구월 (YYYY-MM)", regex=MONTH_RE),
        col("BILLED_AMT", "NUMBER(15)", "청구액 (원)", rng=(0, None)),
        col("DUE_DATE", "DATE", "납부기한"),
        col("PAID_DATE", "DATE", "납부일 (기준일까지 미납이면 NULL)", null=True),
        col("PAYMENT_STATUS_CODE", "VARCHAR2(10 CHAR)", "납부 상태 (ON_TIME=정시, LATE=연체)", values=["ON_TIME", "LATE"]),
    ] + AUDIT, pk=["BILL_ID"], uks=[["MEMBER_ID", "BILL_MONTH"]],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID"), ("SOURCE_RESPONSE_ID", "EXTERNAL_API_RESPONSE", "RESPONSE_ID")]),

    dict(name="MEMBER_CREDIT_GRADE", seed=False,
         comment="서비스 신용 등급 산정 결과 (v2.2 틀만 생성, 시드 없음. 점수 산식과 등급 구간은 모델 팀이 정한다. 산정할 때마다 한 행)", cols=[
        col("GRADE_ID", "NUMBER(19)", "등급 산정 ID (PK, 자동 증가)", identity=True),
        col("MEMBER_ID", "NUMBER(19)", "회원 ID (FK → APP_MEMBER)"),
        col("GRADE_STATUS_CODE", "VARCHAR2(20 CHAR)", "산정 상태 (SCORED=산정됨, NOT_SCORABLE=산정 불가: 점수 계산에 필요한 정보 없음, INSUFFICIENT_INPUT=입력 부족: 6개월 월 입력 미완료. 입력 부족을 먼저 판정)",
            values=["SCORED", "NOT_SCORABLE", "INSUFFICIENT_INPUT"]),
        col("GRADE_BAND_CODE", "VARCHAR2(10 CHAR)", "서비스 등급 (GOOD, STANDARD, CAUTION. SCORED일 때만 값이 있음. 교육용 CB 등급과 별개)", null=True,
            values=["GOOD", "STANDARD", "CAUTION"]),
        col("SCORE", "NUMBER(12,6)", "모델 점수 (산식·범위는 모델 팀이 정함, SCORED일 때만 값이 있음)", null=True),
        col("MODEL_VERSION", "VARCHAR2(30 CHAR)", "점수를 낸 모델 버전 (SCORED일 때만)", null=True),
        col("SCORED_AT", "TIMESTAMP", "산정 일시", default="SYSTIMESTAMP"),
    ] + AUDIT, pk=["GRADE_ID"], uks=[],
        fks=[("MEMBER_ID", "APP_MEMBER", "MEMBER_ID")],
        checks=[("BAND", "(GRADE_STATUS_CODE = 'SCORED' AND GRADE_BAND_CODE IS NOT NULL AND SCORE IS NOT NULL) OR "
                         "(GRADE_STATUS_CODE <> 'SCORED' AND GRADE_BAND_CODE IS NULL AND SCORE IS NULL)")]),
]
TBL = {t["name"]: t for t in TABLES}
# 제약조건·인덱스 이름용 약어 (Oracle 이름 30자 제한)
ABBR = {"APP_MEMBER": "MBR", "MEMBER_MONTHLY_INPUT": "MMI", "LOAN_PRODUCT": "LPRD", "LOAN_PRODUCT_JOB_TYPE": "LPJT",
        "EXTERNAL_API_RESPONSE": "EAR", "MEMBER_LOAN": "MLN", "MEMBER_CARD": "MCD", "MEMBER_CARD_USAGE": "MCU",
        "MEMBER_TELECOM_BILL": "MTB", "MEMBER_PAYMENT_MONTHLY": "MPM", "MEMBER_SOCIAL_INSURANCE": "MSI",
        "MEMBER_CREDIT_BUREAU": "MCB", "MEMBER_UTILITY_BILL": "MUB", "MEMBER_CREDIT_GRADE": "MCG"}


# ---------- 원천 읽기와 변환 ----------
def read_csv(p):
    with open(p, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def yn(v):
    return "Y" if str(v).strip() in ("1", "True", "true") else "N"


members = read_csv(SRC / "members/members.csv")
code2id = {}
rows = {t["name"]: [] for t in TABLES}
for m in members:
    mid = int(m["member_id"][3:])
    code2id[m["member_id"]] = mid
    rows["APP_MEMBER"].append(dict(
        MEMBER_ID=mid, MEMBER_CODE=m["member_id"], EMAIL=m["email"], PASSWORD_HASH=None,
        NICKNAME=m["nickname"], BIRTH_YEAR=int(m["birth_year"]), JOB_TYPE_CODE=JOB_MAP[m["segment"]],
        ROLE_CODE="ROLE_USER", EXTERNAL_CONSENT_YN=yn(m["external_data_consent"]),
        SIGNUP_DATE=("DATE", m["signup_date"]), DUMMY_YN="Y"))

for i, r in enumerate(read_csv(SRC / "members/member_monthly_inputs.csv"), 1):
    rows["MEMBER_MONTHLY_INPUT"].append(dict(
        INPUT_ID=i, MEMBER_ID=code2id[r["member_id"]], BASE_MONTH=r["month"],
        INCOME_AMT=int(r["income_krw"]), EXPENSE_AMT=int(r["expense_total_krw"]),
        DEBT_SERVICE_AMT=int(r["debt_service_krw"]), INPUT_DATE=("DATE", r["input_date"])))

for i, p in enumerate(read_csv(SRC / "loan_products.csv"), 1):
    rows["LOAN_PRODUCT"].append(dict(
        PRODUCT_ID=i, PRODUCT_CODE=p["product_id"], PROVIDER_NAME=p["provider_name"], SECTOR_CODE=int(p["sector"]),
        SECTOR_NAME=p["sector_name"], PRODUCT_TYPE_NAME=p["product_type"],
        RATE_MIN_PCT=float(p["rate_min_pct"]), RATE_MAX_PCT=float(p["rate_max_pct"]),
        RATE_ANCHOR_PCT=float(p["rate_anchor_pct"]), RATE_ANCHOR_BASIS=p["rate_anchor_basis"],
        RATE_ANCHOR_MONTH=p["rate_anchor_as_of"] or None,
        LIMIT_MIN_AMT=int(p["limit_min_krw"]), LIMIT_MAX_AMT=int(p["limit_max_krw"]),
        TERM_MIN_MONTHS=int(p["term_min_months"]), TERM_MAX_MONTHS=int(p["term_max_months"]),
        INCOME_MULTIPLE_CAP=float(p["income_multiple_cap"]) if p["income_multiple_cap"] else None,
        BASIS_NOTE=p["basis"] or None, BASE_DATE=("DATE", p["as_of_date"]), DUMMY_YN="Y"))
    for seg in p["eligible_segments"].split("|"):
        rows["LOAN_PRODUCT_JOB_TYPE"].append(dict(PRODUCT_ID=i, JOB_TYPE_CODE=JOB_MAP[seg]))

rid = 0
ids = {"MEMBER_LOAN": 0, "MEMBER_CARD": 0, "MEMBER_CARD_USAGE": 0, "MEMBER_TELECOM_BILL": 0,
       "MEMBER_PAYMENT_MONTHLY": 0, "MEMBER_SOCIAL_INSURANCE": 0, "MEMBER_CREDIT_BUREAU": 0, "MEMBER_UTILITY_BILL": 0}


def nid(t):
    ids[t] += 1
    return ids[t]


for kind, fn in (("FINANCIAL", "financial_responses.jsonl"), ("TELECOM", "telecom_responses.jsonl"),
                 ("PAYMENT", "payment_responses.jsonl"), ("PUBLIC_INSURANCE", "public_insurance_responses.jsonl"),
                 ("CREDIT_BUREAU", "credit_bureau_responses.jsonl"), ("UTILITY", "utility_responses.jsonl")):
    for line in (SRC / "external_api" / fn).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        js = json.loads(line)
        rid += 1
        mid = code2id[js["member_id"]]
        base = js.get("as_of_date")
        rows["EXTERNAL_API_RESPONSE"].append(dict(
            RESPONSE_ID=rid, MEMBER_ID=mid, PROVIDER_TYPE_CODE=kind, PROVIDER_NAME=js["provider"],
            STATUS_CODE=js["status"], BASE_DATE=("DATE", base) if base else None,
            RESPONSE_JSON=("CLOB", line), DUMMY_YN="Y"))
        if js["status"] != "OK":
            continue  # 동의하지 않은 회원은 정리 테이블에 넣지 않는다
        for ln in js.get("loans", []):
            rows["MEMBER_LOAN"].append(dict(
                LOAN_ID=nid("MEMBER_LOAN"), MEMBER_ID=mid, SOURCE_RESPONSE_ID=rid, ACCOUNT_CODE=ln["account_id"],
                SECTOR_CODE=int(ln["sector"]), LOAN_KIND_CODE=int(ln["kind"]), INSTITUTION_ID=int(ln["institution_id"]),
                BALANCE_AMT=int(ln["balance_krw"]), ANNUAL_RATE=round(float(ln["annual_rate"]), 6),
                REMAINING_MONTHS=int(ln["remaining_months"]), OPENED_DATE=("DATE", ln["opened_date"]),
                ANNUAL_SERVICE_AMT=int(ln["annual_service_krw"]), BASE_DATE=("DATE", base)))
        for c in js.get("cards", []):
            rows["MEMBER_CARD"].append(dict(
                CARD_ID=nid("MEMBER_CARD"), MEMBER_ID=mid, SOURCE_RESPONSE_ID=rid, ACCOUNT_CODE=c["account_id"],
                INSTITUTION_ID=int(c["institution_id"]), OPENED_DATE=("DATE", c["opened_date"]),
                ACTIVE_YN=yn(c["active"]), BASE_DATE=("DATE", base)))
        for u in js.get("card_usage", []):
            rows["MEMBER_CARD_USAGE"].append(dict(
                USAGE_ID=nid("MEMBER_CARD_USAGE"), MEMBER_ID=mid, SOURCE_RESPONSE_ID=rid,
                PERIOD_OFFSET=int(u["period_offset"]), PERIOD_START_DATE=("DATE", u["period_start"]),
                PERIOD_END_DATE=("DATE", u["period_end"]), CREDIT_SPEND_AMT=int(u["spend_krw"]),
                CASH_ADVANCE_AMT=int(u["cash_advance_krw"]), DEBIT_SPEND_AMT=int(u["debit_krw"]),
                BASE_DATE=("DATE", base)))
        bill_tbl = "MEMBER_UTILITY_BILL" if kind == "UTILITY" else "MEMBER_TELECOM_BILL"
        for b in js.get("bills", []):
            rows[bill_tbl].append(dict(
                BILL_ID=nid(bill_tbl), MEMBER_ID=mid, SOURCE_RESPONSE_ID=rid, BILL_MONTH=b["bill_month"],
                BILLED_AMT=int(b["billed_amount_krw"]), DUE_DATE=("DATE", b["due_date"]),
                PAID_DATE=("DATE", b["paid_date"]) if b["paid_date"] else None,
                PAYMENT_STATUS_CODE=b["payment_status"].upper()))
        for x in js.get("months", []):
            rows["MEMBER_PAYMENT_MONTHLY"].append(dict(
                PAYMENT_ID=nid("MEMBER_PAYMENT_MONTHLY"), MEMBER_ID=mid, SOURCE_RESPONSE_ID=rid, BASE_MONTH=x["month"],
                PROVIDER_SCOPE=js["provider_scope"], OBSERVATION_STATUS_CODE=x["observation_status"].upper(),
                PAYMENT_COUNT=int(x["payment_count"]), PAYMENT_AMT=int(x["payment_amount_krw"]), ACTIVE_DAYS=int(x["active_days"])))
        if kind == "CREDIT_BUREAU":
            ci = js["credit_info"]
            opt_yn = lambda v: None if v is None else yn(int(v))
            rows["MEMBER_CREDIT_BUREAU"].append(dict(
                BUREAU_ID=nid("MEMBER_CREDIT_BUREAU"), MEMBER_ID=mid, SOURCE_RESPONSE_ID=rid,
                CB_GRADE=None if ci["CB"] is None else int(ci["CB"]), CB_AVAILABLE_YN=yn(ci["cb_available"]),
                RECENT_DELINQ_YN=opt_yn(ci["SP"]), DELINQ_COUNT_12M=ci["DQ1200001"], MAX_DELINQ_DAYS_3M=ci["KC5000016"],
                LOAN_COUNT=int(ci["L00000001"]), LOAN_BALANCE_AMT=int(ci["L00000002"]) * 1000,
                CARD_UTIL_PCT=None if ci["CL0631905"] is None else round(float(ci["CL0631905"]), 2),
                CREDIT_HISTORY_DAYS=int(ci["credit_history_days"]), BASE_DATE=("DATE", base)))
        for x in js.get("records", []):
            rows["MEMBER_SOCIAL_INSURANCE"].append(dict(
                SI_ID=nid("MEMBER_SOCIAL_INSURANCE"), MEMBER_ID=mid, SOURCE_RESPONSE_ID=rid,
                INSURANCE_TYPE_CODE=x["insurance_type"].upper(), BASE_MONTH=x["month"],
                COVERAGE_STATUS_CODE=x["coverage_status"].upper(), PAYER_TYPE_CODE=x["payer_type"].upper(),
                BILLED_AMT=int(x["billed_amount_krw"]), INDIVIDUAL_AMT=int(x["individual_responsibility_krw"]),
                PAID_AMT=int(x["paid_amount_krw"]), DUE_DATE=("DATE", x["due_date"]) if x["due_date"] else None,
                PAID_DATE=("DATE", x["paid_date"]) if x["paid_date"] else None, PAYMENT_STATUS_CODE=x["payment_status"].upper()))


# ---------- 정합성 검사 (Oracle 없이 명세 기준으로) ----------
errors = []


def raw(v):
    return v[1] if isinstance(v, tuple) else v


def check_value(t, c, v):
    n, typ = c["name"], c["type"]
    if v is None:
        if not c["null"] and not c["identity"] and c["default"] is None:
            errors.append(f"{t}.{n}: NULL 불가")
        return
    x = raw(v)
    m = re.match(r"VARCHAR2\((\d+) CHAR\)|CHAR\((\d+)\)", typ)
    if m:
        lim = int(m.group(1) or m.group(2))
        if len(str(x)) > lim:
            errors.append(f"{t}.{n}: 길이 {len(str(x))} > {lim}: {x}")
    m = re.match(r"NUMBER\((\d+)(?:,(\d+))?\)", typ)
    if m:
        p, s = int(m.group(1)), int(m.group(2) or 0)
        if abs(float(x)) >= 10 ** (p - s):
            errors.append(f"{t}.{n}: 자릿수 초과 NUMBER({p},{s}): {x}")
        if s == 0 and float(x) != int(float(x)):
            errors.append(f"{t}.{n}: 정수 아님: {x}")
    if typ == "DATE" and not re.match(r"^\d{4}-\d{2}-\d{2}$", x):
        errors.append(f"{t}.{n}: 날짜 형식: {x}")
    if typ == "CLOB" and n == "RESPONSE_JSON":
        try:
            json.loads(x)
        except Exception:
            errors.append(f"{t}.{n}: JSON 아님")
    if c["values"] and x not in c["values"]:
        errors.append(f"{t}.{n}: 허용값 밖: {x}")
    if c["regex"] and not re.match(c["regex"], str(x)):
        errors.append(f"{t}.{n}: 형식 불일치: {x}")
    if c["rng"]:
        lo, hi = c["rng"]
        if (lo is not None and float(x) < lo) or (hi is not None and float(x) > hi):
            errors.append(f"{t}.{n}: 범위 밖 {c['rng']}: {x}")


for t in TABLES:
    names = [c["name"] for c in t["cols"]]
    for r in rows[t["name"]]:
        extra = set(r) - set(names)
        if extra:
            errors.append(f"{t['name']}: 정의에 없는 컬럼 {extra}")
        for c in t["cols"]:
            check_value(t["name"], c, r.get(c["name"]))
    for key in [t["pk"]] + t["uks"]:
        vals = [tuple(raw(r[k]) for k in key) for r in rows[t["name"]]]
        if len(vals) != len(set(vals)):
            errors.append(f"{t['name']}: {key} 중복")
    for fc, pt, pc in t["fks"]:
        parent = {raw(r[pc]) for r in rows[pt]}
        for r in rows[t["name"]]:
            if r.get(fc) is not None and raw(r[fc]) not in parent:
                errors.append(f"{t['name']}.{fc} → {pt}: 없는 값 {r[fc]}")
                break

for r in rows["LOAN_PRODUCT"]:
    if not (r["RATE_MIN_PCT"] <= r["RATE_ANCHOR_PCT"] <= r["RATE_MAX_PCT"] <= 20):
        errors.append(f"LOAN_PRODUCT 금리 순서: {r['PRODUCT_CODE']}")
for r in rows["MEMBER_TELECOM_BILL"] + rows["MEMBER_UTILITY_BILL"]:
    if r["PAYMENT_STATUS_CODE"] == "ON_TIME" and (r["PAID_DATE"] is None or raw(r["PAID_DATE"]) > raw(r["DUE_DATE"])):
        errors.append(f"정시 납부인데 납부일이 기한 뒤이거나 없음: bill {r['BILL_ID']}")

# 원장과 대조: 동의 회원의 대출 잔액 합·통신 연체 = 원장
consent = {r["MEMBER_ID"] for r in rows["APP_MEMBER"] if r["EXTERNAL_CONSENT_YN"] == "Y"}
led = {}
for r in read_csv(SRC / "members/ledgers/loans.csv"):
    m = code2id[r["member_id"]]
    if m in consent:
        led[m] = led.get(m, 0) + int(r["balance_thousand"]) * 1000
got = {}
for r in rows["MEMBER_LOAN"]:
    got[r["MEMBER_ID"]] = got.get(r["MEMBER_ID"], 0) + r["BALANCE_AMT"]
if led != got:
    errors.append("MEMBER_LOAN 잔액 합이 원장과 다름")
for tbl, fn, colname, label in (("MEMBER_TELECOM_BILL", "telecom_monthly.csv", "telecom_late", "통신"),
                                ("MEMBER_UTILITY_BILL", "utility_monthly.csv", "utility_late", "공과금")):
    late = {(code2id[r["member_id"]], r["month"]): r[colname] == "1" for r in read_csv(SRC / "members/ledgers" / fn)}
    for r in rows[tbl]:
        if late[(r["MEMBER_ID"], r["BILL_MONTH"])] != (r["PAYMENT_STATUS_CODE"] == "LATE"):
            errors.append(f"{label} 연체 상태가 원장과 다름")
            break
    n_consent_rows = sum(1 for r in read_csv(SRC / "members/ledgers" / fn) if code2id[r["member_id"]] in consent)
    if n_consent_rows != len(rows[tbl]):
        errors.append(f"{tbl} 행 수가 원장(동의 회원)과 다름")
# v2.2: 신용평가사 정리 테이블 = 원장의 같은 열 (동의 회원 1행씩)
bureau_led = {code2id[r["member_id"]]: r for r in read_csv(SRC / "members/ledgers/credit_bureau.csv")}
if {r["MEMBER_ID"] for r in rows["MEMBER_CREDIT_BUREAU"]} != consent:
    errors.append("MEMBER_CREDIT_BUREAU 회원이 동의 회원과 다름")
num = lambda v: None if v == "" else float(v)
for r in rows["MEMBER_CREDIT_BUREAU"]:
    b = bureau_led[r["MEMBER_ID"]]
    want = (num(b["CB"]), num(b["DQ1200001"]), num(b["KC5000016"]), num(b["L00000002"]) * 1000, num(b["CL0631905"]))
    got3 = (r["CB_GRADE"], r["DELINQ_COUNT_12M"], r["MAX_DELINQ_DAYS_3M"], r["LOAN_BALANCE_AMT"], r["CARD_UTIL_PCT"])
    if any((w is None) != (g is None) or (w is not None and abs(w - g) > 0.005) for w, g in zip(want, got3)):
        errors.append(f"MEMBER_CREDIT_BUREAU 값이 원장과 다름: {r['MEMBER_ID']}"); break
if "결과값(연체회차)" in (read_csv(SRC / "members/ledgers/credit_bureau.csv") or [{}])[0]:
    errors.append("신용평가사 원장에 라벨 원천 열(결과값(연체회차))이 있음")
N_API = 6
resp_members = {(r["MEMBER_ID"], r["PROVIDER_TYPE_CODE"]) for r in rows["EXTERNAL_API_RESPONSE"]}
if len(resp_members) != N_API * len(members) or len(rows["EXTERNAL_API_RESPONSE"]) != N_API * len(members):
    errors.append("회원별 금융·통신·간편결제·공공보험·신용평가사·공과금 응답이 1건씩이 아님")
# v2.2: 회원 월 입력은 회원마다 같은 6개월
months_by = {}
for r in rows["MEMBER_MONTHLY_INPUT"]:
    months_by.setdefault(r["MEMBER_ID"], set()).add(r["BASE_MONTH"])
if len(months_by) != len(members) or any(len(v) != 6 or v != next(iter(months_by.values())) for v in months_by.values()):
    errors.append("MEMBER_MONTHLY_INPUT이 회원마다 같은 6개월이 아님")
for tbl, fn, src_col, dst_col in (("MEMBER_PAYMENT_MONTHLY", "digital_payment_monthly.csv", "payment_amount_krw", "PAYMENT_AMT"),
                                  ("MEMBER_SOCIAL_INSURANCE", "social_insurance_monthly.csv", "paid_amount_krw", "PAID_AMT")):
    want, got2, cnt_w, cnt_g = {}, {}, {}, {}
    for r in read_csv(SRC / "members/ledgers" / fn):
        m = code2id[r["member_id"]]
        if m in consent:
            want[m] = want.get(m, 0) + int(r[src_col]); cnt_w[m] = cnt_w.get(m, 0) + 1
    for r in rows[tbl]:
        got2[r["MEMBER_ID"]] = got2.get(r["MEMBER_ID"], 0) + r[dst_col]; cnt_g[r["MEMBER_ID"]] = cnt_g.get(r["MEMBER_ID"], 0) + 1
    if want != got2 or cnt_w != cnt_g:
        errors.append(f"{tbl} 금액·행 수가 원장과 다름")
for r in rows["MEMBER_SOCIAL_INSURANCE"]:
    st = r["PAYMENT_STATUS_CODE"]
    if (r["PAID_DATE"] is None) != (st not in ("ON_TIME", "LATE", "PARTIAL")):
        errors.append(f"MEMBER_SOCIAL_INSURANCE 납부일·상태 불일치: {r['SI_ID']}"); break
    if st in ("ON_TIME", "LATE") and r["PAID_AMT"] != r["INDIVIDUAL_AMT"]:
        errors.append(f"MEMBER_SOCIAL_INSURANCE 완납 금액 불일치: {r['SI_ID']}"); break
for r in rows["EXTERNAL_API_RESPONSE"]:
    if (r["STATUS_CODE"] == "OK") != (r["MEMBER_ID"] in consent):
        errors.append("동의 여부와 응답 상태 불일치")
        break

if errors:
    print("FAIL", len(errors))
    print("\n".join(errors[:30]))
    sys.exit(1)


# ---------- SQL 출력 ----------
HEADER = "-- 생성: tools/build_db.py (손으로 고치지 말고 생성기를 고쳐 다시 만든다)\n-- 대상: Oracle 21c, UTF-8\n"


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, tuple):
        kind, x = v
        if kind == "DATE":
            return f"DATE '{x}'"
        # 1,000자 조각을 한 줄씩 이어 붙인다. SQL 문자 상수 4,000바이트 제한과 SQL*Plus 한 줄 2,499자 제한을 모두 피한다.
        parts = [x[i:i + 1000].replace("'", "''") for i in range(0, len(x), 1000)] or [""]
        return "\n    " + "\n    || ".join(f"TO_CLOB('{p}')" for p in parts)
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def ddl_table(t):
    lines = []
    for c in t["cols"]:
        s = f"    {c['name']:<22} {c['type']:<20}"
        if c["identity"]:
            s += " GENERATED BY DEFAULT ON NULL AS IDENTITY"
        if c["default"]:
            s += f" DEFAULT {c['default']}"
        s += "" if c["null"] or c["identity"] else " NOT NULL"  # IDENTITY 컬럼은 자동으로 NOT NULL
        lines.append(s.rstrip())
    lines.append(f"    CONSTRAINT PK_{t['name']} PRIMARY KEY ({', '.join(t['pk'])})")
    for i, uk in enumerate(t["uks"], 1):
        lines.append(f"    CONSTRAINT UK_{ABBR[t['name']]}_{i} UNIQUE ({', '.join(uk)})")
    for c in t["cols"]:
        if c["values"]:
            vs = ", ".join(f"'{v}'" for v in c["values"])
            lines.append(f"    CONSTRAINT CK_{ABBR[t['name']]}_{c['name']} CHECK ({c['name']} IN ({vs}))")
        if c["regex"]:
            lines.append(f"    CONSTRAINT CK_{ABBR[t['name']]}_{c['name']} CHECK (REGEXP_LIKE({c['name']}, '{c['regex']}'))")
        if c["rng"]:
            # v2.1: 시드 검사에만 쓰던 범위를 DDL에도 건다. 서비스가 직접 넣는 행(회원가입·관리자 입력)도 같은 규칙을 따른다
            lo, hi = c["rng"]
            expr = (f"{c['name']} BETWEEN {lo} AND {hi}" if lo is not None and hi is not None
                    else f"{c['name']} >= {lo}" if lo is not None else f"{c['name']} <= {hi}")
            sfx = "_RNG" if c["values"] or c["regex"] else ""
            lines.append(f"    CONSTRAINT CK_{ABBR[t['name']]}_{c['name']}{sfx} CHECK ({expr})")
    for nm, expr in t.get("checks", []):
        lines.append(f"    CONSTRAINT CK_{ABBR[t['name']]}_{nm} CHECK ({expr})")
    out = f"CREATE TABLE {t['name']} (\n" + ",\n".join(lines) + "\n);\n"
    out += f"COMMENT ON TABLE  {t['name']} IS '{t['comment']}';\n"
    for c in t["cols"]:
        out += f"COMMENT ON COLUMN {t['name']}.{c['name']} IS '{c['comment']}';\n"
    return out


def ident_check(sql):
    # Oracle 식별자는 30바이트 이하(21c는 128바이트까지 허용하지만 안전하게 30)
    for name in re.findall(r"CONSTRAINT (\w+)", sql):
        if len(name) > 30:
            errors.append(f"제약조건 이름 30자 초과: {name}")


ddl = HEADER + "\n-- 테이블, PK·UNIQUE·CHECK, COMMENT\n\n" + "\n".join(ddl_table(t) for t in TABLES)
fk = HEADER + "\n-- 외래키와 조회용 인덱스\n\n"
for t in TABLES:
    for fc, pt, pc in t["fks"]:
        nm = f"FK_{ABBR[t['name']]}_{fc}".replace("SOURCE_RESPONSE_ID", "RESP")
        fk += f"ALTER TABLE {t['name']} ADD CONSTRAINT {nm} FOREIGN KEY ({fc}) REFERENCES {pt} ({pc});\n"
        # FK 컬럼 조회용 인덱스. PK·UNIQUE 앞 컬럼이면 이미 인덱스가 있고, EAR은 아래 복합 인덱스가 대신한다
        if [fc] != t["pk"][:1] and not any(uk[0] == fc for uk in t["uks"]) and t["name"] != "EXTERNAL_API_RESPONSE":
            iname = f"IDX_{ABBR[t['name']]}_{fc}".replace("SOURCE_RESPONSE_ID", "RESP")
            fk += f"CREATE INDEX {iname} ON {t['name']} ({fc});\n"
fk += "CREATE INDEX IDX_EAR_MEMBER_PROVIDER ON EXTERNAL_API_RESPONSE (MEMBER_ID, PROVIDER_TYPE_CODE);\n"
ident_check(ddl + fk)
for name in re.findall(r"(?:INDEX|CONSTRAINT) (\w+)", fk):
    if len(name) > 30:
        errors.append(f"이름 30자 초과: {name}")
if errors:
    print("FAIL", errors)
    sys.exit(1)

drop = HEADER + "\n-- 전체 삭제 (개발 DB 초기화용, 자식 테이블부터)\n\n"
for t in reversed(TABLES):
    drop += f"BEGIN EXECUTE IMMEDIATE 'DROP TABLE {t['name']} CASCADE CONSTRAINTS PURGE'; " \
            f"EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;\n/\n"

(OUT / "01_create_tables.sql").write_text(ddl, encoding="utf-8")
(OUT / "02_constraints.sql").write_text(fk, encoding="utf-8")
(OUT / "00_drop_all.sql").write_text(drop, encoding="utf-8")

seed_files = []
no_seed = []
for n, t in enumerate(TABLES, 1):
    if t.get("seed", True) is False:
        no_seed.append(t["name"])  # v2.2: 틀만 만드는 테이블. 시드 파일 없이 99_check에서 0행을 기대한다
        continue
    names = [c["name"] for c in t["cols"] if c["name"] not in ("CREATED_AT", "UPDATED_AT", "RECEIVED_AT")]
    body = [HEADER, f"-- {t['name']}: {len(rows[t['name']])}행\n", "SET DEFINE OFF\n\n"]
    for i, r in enumerate(rows[t["name"]], 1):
        body.append(f"INSERT INTO {t['name']} ({', '.join(names)}) VALUES ({', '.join(lit(r.get(k)) for k in names)});\n")
        if i % 500 == 0:
            body.append("COMMIT;\n")
    body.append("COMMIT;\n")
    idc = [c["name"] for c in t["cols"] if c["identity"]]
    if idc:
        body.append(f"-- 시드에서 ID를 직접 넣었으므로 자동 증가 시작값을 현재 최댓값 다음으로 맞춘다\n"
                    f"ALTER TABLE {t['name']} MODIFY ({idc[0]} GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE));\n")
    fn = f"{10 + n:02d}_seed_{t['name'].lower()}.sql"
    (OUT / fn).write_text("".join(body), encoding="utf-8")
    seed_files.append((fn, t["name"], len(rows[t["name"]])))

check = HEADER + "\n-- 적재 후 확인: 기대 행 수와 실제 행 수를 비교하고, COMMENT 누락을 찾는다\n\n"
check += "\nUNION ALL\n".join(
    f"SELECT '{tn}' AS TABLE_NAME, {cnt} AS EXPECTED, (SELECT COUNT(*) FROM {tn}) AS ACTUAL FROM DUAL"
    for _, tn, cnt in seed_files + [(None, tn, 0) for tn in no_seed]) + ";\n\n"
check += ("SELECT TABLE_NAME, COLUMN_NAME FROM USER_COL_COMMENTS\n WHERE COMMENTS IS NULL\n   AND TABLE_NAME IN ("
          + ", ".join(f"'{t['name']}'" for t in TABLES) + ")\n ORDER BY TABLE_NAME, COLUMN_NAME;\n")
(OUT / "99_check.sql").write_text(check, encoding="utf-8")

run_all = HEADER + "\n-- SQL*Plus / SQL Developer(F5 스크립트 실행)에서 db 폴더 기준으로 실행\n" \
    "-- v2.1: 오류가 나면 그 자리에서 되돌리고 멈춘다(이전에는 계속 진행해 99_check에서야 드러났다)\n" \
    "WHENEVER SQLERROR EXIT FAILURE ROLLBACK\n\n" + "".join(
    f"@@{f}\n" for f in ["00_drop_all.sql", "01_create_tables.sql", "02_constraints.sql"] + [s[0] for s in seed_files]
    + ["99_check.sql"])
(OUT / "run_all.sql").write_text(run_all, encoding="utf-8")

# SQL*Plus는 한 줄이 2,499자를 넘으면 실행하지 않는다 (SP2-0027). 모든 출력 줄을 확인한다.
long_lines = [(f.name, i) for f in sorted(OUT.glob("*.sql")) for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1) if len(line) > 2499]
if long_lines:
    print("FAIL 2,499자 넘는 줄", long_lines[:5])
    sys.exit(1)

print("PASS")
for fn, tn, cnt in seed_files:
    print(f"{tn:<24} {cnt:>6}행  {fn}")
