# FP-140 예측 Mock의 피처 사전과 버전·등급 구간 상수. 실제 모델(FP-141) 버전 상수도 여기에 둔다.
# N-12-2·N-14 피처 사전(DIM_FEATURE FS-DRAFT 39개). 실제 모델의 38개 순서는 training/config.py가 기준이다.
# 값의 출처: docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql (피처 정의서 v1.0 11장).
# 시드 SQL이 바뀌면 이 목록도 같이 고친다. tests/test_mock_scorer.py가 두 목록이 같은지 검사한다.
from dataclasses import dataclass

# DB 기준 데이터와 글자까지 같아야 Spring 저장이 FK 오류 없이 된다 (DDL MODEL_REGISTRY·FEATURE_SET_VERSION·SCORE_CUTOFF_VERSION).
MODEL_VERSION = "DEV-DUMMY"
FEATURE_SET_VERSION = "FS-DRAFT"
CUTOFF_VERSION = "CUT-0.3"   # 11/23 CUT-0.1(665/780)에서 전환(FP-248). DB의 ACTIVE 구간 버전과 같아야 한다

# FP-141 실제 모델(LightGBM 임시 베이스라인, 11/17 범영·재욱 합의). DB의 ACTIVE 모델이 이 값이면 실제 모델로 계산한다.
# 값은 학습 코드(training/config.py)를 그대로 가져온다. 그쪽 시험(test_fs_v1_seed)이 DDL 기준 데이터와 같은지 검사하므로 세 곳이 어긋나지 않는다.
from training.config import FEATURE_SET_VERSION as REAL_FEATURE_SET_VERSION  # noqa: E402  "FS-V1"
from training.config import MODEL_VERSION as REAL_MODEL_VERSION  # noqa: E402  "LGBM-BASE-0.1"

# FP-237 실제 모델 버전은 서버가 불러온 모델 묶음의 meta.json(model_version)에서 정한다(11/20 범영 결정).
# 그래서 0.1 묶음을 넣으면 0.1, 0.2 묶음을 넣으면 0.2로 동작하고, 코드를 먼저 병합해도 이미 0.1을 쓰는 서버가 깨지지 않는다.
# REAL_MODEL_VERSION은 meta.json에 버전이 적혀 있지 않은 옛 묶음을 위한 기본값이다. 버전 이름은 아래 모양만 받는다.
import re  # noqa: E402

REAL_MODEL_VERSION_PATTERN = re.compile(r"LGBM-BASE-\d+\.\d+")


def is_real_model_version(version: str | None) -> bool:
    """실제 모델 버전 이름 모양(LGBM-BASE-숫자.숫자)인지. Mock(DEV-DUMMY)·알 수 없는 이름과 구분할 때 쓴다."""
    return version is not None and REAL_MODEL_VERSION_PATTERN.fullmatch(version) is not None

# 등급 구간 CUT-0.3 (decisions.md D-01, 모델 0.2 점수 분포 25/50/25: 0~653 / 654~726 / 727~1000). 이전 CUT-0.1은 665·780.
GRADE_BANDS = [
    {"gradeBandCode": "CAUTION", "minScore": 0, "maxScore": 653},
    {"gradeBandCode": "STANDARD", "minScore": 654, "maxScore": 726},
    {"gradeBandCode": "GOOD", "minScore": 727, "maxScore": 1000},
]

# FP-285 등급 구간은 불러온 모델 묶음의 버전에 따라 고른다(11/27). 그래서 코드를 먼저 병합해도 0.2 묶음의 서버는 CUT-0.3 그대로이고,
# 0.3 묶음으로 바꾸면 CUT-0.4가 된다. Mock과 표에 없는 버전은 CUT-0.3(위 CUTOFF_VERSION·GRADE_BANDS)이다.
# CUT-0.4 = 모델 0.3 대안 점수 VALID 25·75%(정의서 C37): 0~644 / 645~711 / 712~1000. DB의 ACTIVE 구간 버전과 같아야 한다.
GRADE_BANDS_BY_CUTOFF = {
    CUTOFF_VERSION: GRADE_BANDS,
    "CUT-0.4": [
        {"gradeBandCode": "CAUTION", "minScore": 0, "maxScore": 644},
        {"gradeBandCode": "STANDARD", "minScore": 645, "maxScore": 711},
        {"gradeBandCode": "GOOD", "minScore": 712, "maxScore": 1000},
    ],
}
CUTOFF_BY_MODEL_VERSION = {"LGBM-BASE-0.3": "CUT-0.4"}


def cutoff_for(model_version: str | None) -> str:
    """모델 버전에 맞는 등급 구간 버전. 표에 없으면(Mock·0.1·0.2) CUT-0.3이다."""
    return CUTOFF_BY_MODEL_VERSION.get(model_version, CUTOFF_VERSION)


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


def grade_band(score: int, cutoff_version: str = CUTOFF_VERSION) -> str:
    """점수를 지정한 등급 구간(기본 CUT-0.3)의 등급 코드로 바꾼다."""
    for band in GRADE_BANDS_BY_CUTOFF[cutoff_version]:
        if band["minScore"] <= score <= band["maxScore"]:
            return band["gradeBandCode"]
    raise ValueError(f"점수 범위 밖: {score}")
