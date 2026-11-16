# FP-140 예측 Mock — 실제 모델 아님.
# N-12-2·N-14 피처 사전(DIM_FEATURE FS-DRAFT 39개)과 버전·등급 구간 상수.
# 값의 출처: docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql (피처 정의서 v1.0 11장).
# 시드 SQL이 바뀌면 이 목록도 같이 고친다. tests/test_mock_scorer.py가 두 목록이 같은지 검사한다.
from dataclasses import dataclass

# DB 기준 데이터와 글자까지 같아야 Spring 저장이 FK 오류 없이 된다 (DDL MODEL_REGISTRY·FEATURE_SET_VERSION·SCORE_CUTOFF_VERSION).
MODEL_VERSION = "DEV-DUMMY"
FEATURE_SET_VERSION = "FS-DRAFT"
CUTOFF_VERSION = "CUT-0.1"

# 등급 구간 CUT-0.1 (decisions.md D-01 임시값: 0~664 / 665~779 / 780~1000).
GRADE_BANDS = [
    {"gradeBandCode": "CAUTION", "minScore": 0, "maxScore": 664},
    {"gradeBandCode": "STANDARD", "minScore": 665, "maxScore": 779},
    {"gradeBandCode": "GOOD", "minScore": 780, "maxScore": 1000},
]


@dataclass(frozen=True)
class Feature:
    """피처 사전 한 줄 — DIM_FEATURE 열과 같은 뜻이다."""
    display_order: int
    code: str
    name: str
    unit: str | None
    alternative_yn: str   # Y = 대안 데이터 피처(대안 모델에만 쓰임)
    simulatable_yn: str   # Y = 시뮬레이터에서 바꿀 수 있음 (N-18-8)


FEATURES = [
    Feature( 1, "income_svc_12m_krw", "최근 12개월 소득 합계", "원", "N", "N"),
    Feature( 2, "income_cv_svc_12m", "월 소득 변동 정도", "비율", "N", "N"),
    Feature( 3, "zero_income_months_svc_12m", "소득이 없었던 달", "개월", "N", "N"),
    Feature( 4, "expense_avg_month_krw", "평균 월 지출", "원", "N", "N"),
    Feature( 5, "debt_service_current_krw", "현재 월 상환액", "원", "N", "N"),
    Feature( 6, "expense_ratio_svc_12m", "소득 대비 지출 비율", "비율", "N", "N"),
    Feature( 7, "dsr_svc_12m", "소득 대비 상환 부담률", "비율", "N", "N"),
    Feature( 8, "deficit_months_svc_12m", "적자였던 달", "개월", "N", "N"),
    Feature( 9, "worst_month_net_cash_svc_12m_krw", "가장 어려웠던 달의 남은 돈", "원", "N", "N"),
    Feature(10, "debt_balance_krw", "대출 잔액", "원", "N", "Y"),
    Feature(11, "L00000001", "대출 건수", "건", "N", "N"),
    Feature(12, "LRZ021201", "연간 원리금 상환액", "원", "N", "N"),
    Feature(13, "DQ1200001", "최근 1년 30일 이상 연체 횟수", "건", "N", "Y"),
    Feature(14, "L22000900", "최근 3개월 신규 대출(상환 중)", "건", "N", "Y"),
    Feature(15, "LA0099212", "대부업 대출 잔액", "원", "N", "Y"),
    Feature(16, "CF1231605", "현금서비스 이용 기간", "개월", "N", "Y"),
    Feature(17, "CL0631905", "카드 한도 사용률", "%", "N", "Y"),
    Feature(18, "segment", "직군", "코드", "N", "N"),
    Feature(19, "age", "나이", "세", "N", "N"),
    Feature(20, "telecom_late_months", "통신비 미납 개월", "개월", "Y", "N"),
    Feature(21, "telecom_on_time_streak", "통신비 정시 납부 기간", "개월", "Y", "Y"),
    Feature(22, "utility_late_months", "공과금 미납 개월", "개월", "Y", "Y"),
    Feature(23, "dp_ever_used", "간편결제 사용 여부", "0/1", "Y", "N"),
    Feature(24, "dp_active_months", "간편결제 이용 개월", "개월", "Y", "N"),
    Feature(25, "dp_payment_count_12m", "간편결제 이용 건수(12개월)", "건", "Y", "Y"),
    Feature(26, "dp_payment_amount_12m_krw", "간편결제 이용 금액(12개월)", "원", "Y", "N"),
    Feature(27, "np_coverage_status", "국민연금 가입 상태", "코드", "Y", "N"),
    Feature(28, "np_payer_type", "국민연금 가입 유형", "코드", "Y", "N"),
    Feature(29, "np_due_months", "국민연금 납부 대상 개월", "개월", "Y", "N"),
    Feature(30, "np_on_time_months", "국민연금 정시 납부 개월", "개월", "Y", "N"),
    Feature(31, "np_arrears_months", "국민연금 미납·지연 개월", "개월", "Y", "N"),
    Feature(32, "np_on_time_rate", "국민연금 정시 납부율", "비율", "Y", "N"),
    Feature(33, "hi_coverage_status", "건강보험 가입 상태", "코드", "Y", "N"),
    Feature(34, "hi_payer_type", "건강보험 가입 유형", "코드", "Y", "N"),
    Feature(35, "hi_due_months", "건강보험 납부 대상 개월", "개월", "Y", "N"),
    Feature(36, "hi_on_time_months", "건강보험 정시 납부 개월", "개월", "Y", "N"),
    Feature(37, "hi_arrears_months", "건강보험 미납·지연 개월", "개월", "Y", "N"),
    Feature(38, "hi_on_time_rate", "건강보험 정시 납부율", "비율", "Y", "N"),
    Feature(39, "si_arrears_any", "국민연금·건강보험 미납 경험", "0/1", "Y", "N"),
]

FEATURE_BY_CODE = {f.code: f for f in FEATURES}

# 기존 모델 19개 = 대안 데이터가 아닌 피처, 대안 모델 39개 = 전부 (피처 정의서 1장, D-29).
TRADITIONAL_CODES = [f.code for f in FEATURES if f.alternative_yn == "N"]
ALTERNATIVE_CODES = [f.code for f in FEATURES]


def grade_band(score: int) -> str:
    """점수를 CUT-0.1 등급 코드로 바꾼다."""
    for band in GRADE_BANDS:
        if band["minScore"] <= score <= band["maxScore"]:
            return band["gradeBandCode"]
    raise ValueError(f"점수 범위 밖: {score}")
