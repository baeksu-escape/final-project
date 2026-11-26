# N-12-2 기존·대안 모델 학습 설정 — 피처 목록, 범주 부호표, 라벨, 고정 하이퍼파라미터.
# 값의 출처: 피처 정의서 v1.0(docs/spec/feature_definition.md) 3장·10장 C8·C9·C13·C19. 이 파일의 값은 임시 베이스라인 기준이다.
# 이상치 상한은 서비스(pipeline/feature_builder.py)와 같은 상수를 그대로 가져와 쓴다(학습과 서비스가 갈라지지 않게).
from pathlib import Path

from pipeline.feature_builder import (  # noqa: F401  (preprocess.py가 이 이름으로 다시 가져간다)
    DEBT_SERVICE_MIN_KRW,
    EXPENSE_AVG_MAX_KRW,
    INCOME_SUM_MAX_KRW,
)

FASTAPI_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = FASTAPI_ROOT / "data" / "training"
DEFAULT_OUT_DIR = FASTAPI_ROOT / "artifacts"
TABLE_RELATIVE_PATH = Path("1_model") / "legacy_model_table.csv"
THINFILE_TABLE_RELATIVE_PATH = Path("1_model") / "thinfile_model_table.csv"
EXPOSURE_COLUMN = "eval_future_credit_exposure"   # 씬파일 표에서 1인 고객만 학습·평가에 쓴다(정의서 5장). 0인 고객은 라벨이 항상 0이라 가짜 패턴을 만든다.

# 기존 모델 18개 = 대안 데이터가 아닌 피처. LRZ021201은 C9(11/16 임시 결정)로 뺐다.
LEGACY_FEATURES = [
    "income_svc_12m_krw", "income_cv_svc_12m", "zero_income_months_svc_12m",
    "expense_avg_month_krw", "debt_service_current_krw", "expense_ratio_svc_12m",
    "dsr_svc_12m", "deficit_months_svc_12m", "worst_month_net_cash_svc_12m_krw",
    "debt_balance_krw", "L00000001", "DQ1200001", "L22000900",
    "LA0099212", "CF1231605", "CL0631905", "segment", "age",
]

# 대안 모델 추가 20개(통신비·공과금·간편결제·국민연금·건강보험).
ALTERNATIVE_EXTRA_FEATURES = [
    "telecom_late_months", "telecom_on_time_streak", "utility_late_months",
    "dp_ever_used", "dp_active_months", "dp_payment_count_12m", "dp_payment_amount_12m_krw",
    "np_coverage_status", "np_payer_type", "np_due_months", "np_on_time_months",
    "np_arrears_months", "np_on_time_rate", "hi_coverage_status", "hi_payer_type",
    "hi_due_months", "hi_on_time_months", "hi_arrears_months", "hi_on_time_rate",
    "si_arrears_any",
]
ALTERNATIVE_FEATURES = LEGACY_FEATURES + ALTERNATIVE_EXTRA_FEATURES

# 입력 열이 이상치·결측이면 같이 결측으로 두는 파생 열(전처리 (나), C19). 서비스 feature_builder와 같은 규칙이다.
DERIVED_FROM_INCOME = ["income_cv_svc_12m", "expense_ratio_svc_12m", "dsr_svc_12m"]
DERIVED_FROM_EXPENSE = ["expense_ratio_svc_12m"]
DERIVED_FROM_DEBT = ["dsr_svc_12m"]
DERIVED_FROM_ANY_INPUT = ["deficit_months_svc_12m", "worst_month_net_cash_svc_12m_krw"]

# 범주형 5개의 고정 부호표. 알파벳 자동 부호(cat.codes)는 학습 데이터가 바뀌면 번호가 달라지므로 쓰지 않는다.
# 서비스(feature_builder.py)가 보내는 소문자 문자열과 같은 값이며, 이 표에 없는 값은 -1(결측)로 둔다.
# TODO(정의서 9장 "학습에 없는 코드값 처리") voluntary·가입 상태 unknown은 학습에 없는 값이라 처리 방식이 미정이다.
CATEGORY_CODES = {
    "segment": ["freelance", "selfemp", "wage"],
    "np_coverage_status": ["covered", "exempt", "not_covered"],
    "np_payer_type": ["regional", "unknown", "workplace"],
    "hi_coverage_status": ["covered", "dependent", "not_covered"],
    "hi_payer_type": ["household", "regional", "unknown", "workplace"],
}
CATEGORICAL_FEATURES = list(CATEGORY_CODES)

# 정답 라벨: 기존 모델은 연체 경험, 대안 모델은 비금융 효과 라벨(피처 정의서 9장 확정).
MODELS = {
    "legacy": {"features": LEGACY_FEATURES, "label": "label_any_delinquency_12m"},
    "alternative": {"features": ALTERNATIVE_FEATURES, "label": "label_nonfin_effect_12m"},
}

# DB 장부(MODEL_REGISTRY, FEATURE_SET_VERSION)에 등록한 이름. 기존·대안 두 모델이 한 묶음으로 같은 버전을 쓴다.
# 재학습하면 MODEL_VERSION을 0.2, 0.3으로 올리고 DB에 새 행을 넣는다. 피처 목록이 바뀌면 FS-V2를 새로 만든다.
# tests/test_fs_v1_seed.py가 이 값이 avenue_ddl.sql 기준 데이터와 같은지 검사한다.
MODEL_VERSION = "LGBM-BASE-0.1"
FEATURE_SET_VERSION = "FS-V1"
ALGORITHM_NAME = "LightGBM"

SPLIT_COLUMN = "data_split"
TRAIN_SPLIT = "TRAIN"
VALID_SPLIT = "VALID"          # TEST는 최종 평가 때만 쓰며, 이 스크립트는 읽은 뒤 바로 버린다.

SEEDS = [11, 22, 33, 44, 55]   # 시드 5개 평균·표준편차로 성능을 본다. 저장하는 모델은 첫 시드 것이다.
LGBM_PARAMS = {                # 튜닝하지 않은 고정 설정
    "n_estimators": 300,
    "learning_rate": 0.05,
    "num_leaves": 31,
    "colsample_bytree": 0.8,
    "verbose": -1,
}

# 단조 제약(후보 B = 모델 0.2, 11/20 범영 점검 사례 반영, --monotone 옵션으로만 켠다). 불량(양성) 확률의 방향이다: +1이면 값이 클수록 불량 확률이 높아지고(점수는 낮아짐), -1이면 낮아진다.
# 방향이 분명한 피처에만 건다(위 6개). 소득·지출 금액(아래 2개)은 학습 데이터가 소득↑ 연체↑ 방향이고 둘의 상관이 0.88이라 처음에는 뺐지만,
# 시험(11/20)에서 걸어도 AUC가 0.1 수준 이상이고 범영 님 사례의 반대 방향이 모두 사라져서 넣었다. 부채 금액까지 거는 것은 반응이 과해져 뺐다.
MONOTONE_CONSTRAINTS = {
    "expense_ratio_svc_12m": 1,
    "dsr_svc_12m": 1,
    "deficit_months_svc_12m": 1,
    "worst_month_net_cash_svc_12m_krw": -1,
    "DQ1200001": 1,
    "CL0631905": 1,
    "income_svc_12m_krw": -1,
    "expense_avg_month_krw": 1,
}

# 모델 0.3의 단조 제약(정의서 C33·C36, 데이터 v3.7.0). 0.2의 8개에, 새 연체 라벨에 효과를 넣은 방향(모두 +1) 7개를 더한다(C33).
# C36(11/26)에서 시뮬레이터가 상식과 반대로 움직이지 않게 대안 모델에만 있는 4개(아래 마지막 4줄)를 더해 19개가 됐다.
# 간편결제 건수는 라벨에 방향을 설계하지 않은 정책 결정이다. --monotone-set v03 옵션으로만 켠다. 0.2를 다시 만들 수 있게 위 목록은 바꾸지 않는다.
MONOTONE_CONSTRAINTS_V03 = {
    **MONOTONE_CONSTRAINTS,
    "debt_balance_krw": 1,
    "debt_service_current_krw": 1,
    "L00000001": 1,
    "L22000900": 1,
    "LA0099212": 1,
    "CF1231605": 1,
    "zero_income_months_svc_12m": 1,
    "telecom_late_months": 1,
    "telecom_on_time_streak": -1,
    "utility_late_months": 1,
    "dp_payment_count_12m": -1,
}
MONOTONE_SETS = {"v02": MONOTONE_CONSTRAINTS, "v03": MONOTONE_CONSTRAINTS_V03}
