# FP-140 예측 Mock — 실제 모델 아님. 진짜 모델(FP-141)이 오면 이 파일만 바꾼다.
# N-12-2 점수 계산·N-14 항목별 SHAP: 피처마다 고정 가중치로 위험 기여(log-odds)를 만들고 PDO 방식으로 0~1000점으로 바꾼다.
# 같은 입력이면 항상 같은 결과가 나온다(난수 없음). 가중치는 화면 시험용 임의 값이며 학습 결과가 아니다.
import math

from pipeline.feature_catalog import (
    ALTERNATIVE_CODES, FEATURE_BY_CODE, TRADITIONAL_CODES, grade_band,
)

# 점수 변환식 (B팀 명세서 O-3, 11/16 범영 확정): 700점 = 우량:불량 20:1, 40점(PDO)마다 오즈 2배, 범위 0~1000.
# SHAP 점수도 같은 배율(FACTOR)로 환산한다. 진짜 모델(FP-141)도 이 변환식을 그대로 쓴다.
PDO = 40
FACTOR = PDO / math.log(2)                     # ≈ 57.71
OFFSET = 700 - FACTOR * math.log(20)           # ≈ 527.1
BASE_LOG_ODDS = -1.94                          # 기준점 ≈ 639점 (UI 예시 기준점과 맞춘 Mock 값)

# 숫자 피처: (가중치, 기준값, 기여 상한). 기여 = 가중치 × (값 − 기준값), ±상한으로 자른다.
# 가중치가 양수면 값이 클수록 위험(점수 하락)이다.
NUMERIC_WEIGHTS = {
    "income_svc_12m_krw": (-1.5e-8, 37_000_000, 0.30),
    "income_cv_svc_12m": (0.8, 0.0, 0.30),
    "zero_income_months_svc_12m": (0.08, 0, 0.30),
    "expense_avg_month_krw": (5e-8, 1_500_000, 0.20),
    "debt_service_current_krw": (1e-7, 500_000, 0.20),
    "expense_ratio_svc_12m": (0.5, 0.53, 0.30),
    "dsr_svc_12m": (0.8, 0.16, 0.40),
    "deficit_months_svc_12m": (0.05, 0, 0.30),
    "worst_month_net_cash_svc_12m_krw": (-1e-7, 300_000, 0.20),
    "debt_balance_krw": (5e-9, 20_000_000, 0.20),
    "L00000001": (0.04, 3, 0.20),
    "LRZ021201": (5e-9, 6_600_000, 0.15),
    "DQ1200001": (0.30, 0, 0.50),
    "L22000900": (0.10, 0, 0.30),
    "LA0099212": (1e-7, 0, 0.40),
    "CF1231605": (0.05, 1, 0.30),
    "CL0631905": (0.006, 20, 0.40),
    "age": (-0.005, 48, 0.10),
    "telecom_late_months": (0.12, 0, 0.40),
    "telecom_on_time_streak": (-0.04, 6, 0.30),
    "utility_late_months": (0.10, 0, 0.40),
    "dp_ever_used": (-0.10, 0.5, 0.10),
    "dp_active_months": (-0.02, 6, 0.15),
    "dp_payment_count_12m": (-0.0005, 50, 0.15),
    "dp_payment_amount_12m_krw": (-2e-8, 1_600_000, 0.10),
    "np_due_months": (0.0, 0, 0.0),
    "np_on_time_months": (-0.02, 6, 0.15),
    "np_arrears_months": (0.10, 0, 0.30),
    "np_on_time_rate": (-0.40, 0.9, 0.20),
    "hi_due_months": (0.0, 0, 0.0),
    "hi_on_time_months": (-0.02, 6, 0.15),
    "hi_arrears_months": (0.10, 0, 0.30),
    "hi_on_time_rate": (-0.40, 0.9, 0.20),
    "si_arrears_any": (0.15, 0, 0.15),
}

# 코드형 피처: 값 → 기여. 표에 없는 값은 0.
CODE_WEIGHTS = {
    "segment": {"wage": -0.05, "selfemp": 0.08, "freelance": 0.10},
    "np_coverage_status": {"covered": 0.0, "not_covered": 0.15, "exempt": 0.10, "unknown": 0.05},
    "hi_coverage_status": {"covered": 0.0, "not_covered": 0.15, "dependent": 0.0, "unknown": 0.05},
    "np_payer_type": {"workplace": -0.05, "regional": 0.05, "unknown": 0.05},
    "hi_payer_type": {"workplace": -0.05, "regional": 0.05, "unknown": 0.05},
}


def contribution(code: str, value) -> float:
    """피처 하나의 위험 기여(log-odds). 값이 없으면(None) 0 — 결측을 0값으로 바꾸는 것이 아니라 영향 없음으로 둔다."""
    if value is None:
        return 0.0
    if code in CODE_WEIGHTS:
        return CODE_WEIGHTS[code].get(value, 0.0)
    weight, reference, cap = NUMERIC_WEIGHTS[code]
    raw = weight * (value - reference)
    return max(-cap, min(cap, raw))


def to_score(log_odds: float) -> int:
    """위험 log-odds → 0~1000점 (높을수록 좋음)."""
    return max(0, min(1000, round(OFFSET - FACTOR * log_odds)))


def _score_one(features: dict, codes: list[str]) -> dict:
    """한 모델(기존 또는 대안)의 점수·등급·부도 확률."""
    log_odds = BASE_LOG_ODDS + sum(contribution(c, features.get(c)) for c in codes)
    score = to_score(log_odds)
    return {
        "scorableYn": "Y",
        "score": score,
        "gradeBandCode": grade_band(score),
        "defaultProb": round(1 / (1 + math.exp(-log_odds)), 6),
    }


def _shap_scores(raw_scores: dict, target: int) -> dict:
    """반올림 차이를 |점수|가 큰 항목부터 1점씩 나눠, 합이 target과 정확히 같게 한다(최대 잉여 방식)."""
    rounded = {c: round(v) for c, v in raw_scores.items()}
    diff = target - sum(rounded.values())
    order = sorted(raw_scores, key=lambda c: (-abs(raw_scores[c]), FEATURE_BY_CODE[c].name))
    step = 1 if diff > 0 else -1
    for i in range(abs(diff)):
        rounded[order[i % len(order)]] += step
    return rounded


def _feature_value_text(value) -> str | None:
    """ASSESSMENT_FACTOR.FEATURE_VALUE(문자 100자)에 넣을 글자."""
    return None if value is None else str(value)


def score_features(features: dict) -> dict:
    """피처 39개 → 기존·대안 점수와 SHAP. 점수 합 규칙: baseScore + Σ shapScore = alternative.score."""
    traditional = _score_one(features, TRADITIONAL_CODES)
    alternative = _score_one(features, ALTERNATIVE_CODES)
    base_score = to_score(BASE_LOG_ODDS)

    shap_values = {c: contribution(c, features.get(c)) for c in ALTERNATIVE_CODES}
    raw_scores = {c: -FACTOR * v for c, v in shap_values.items()}
    shap_scores = _shap_scores(raw_scores, alternative["score"] - base_score)

    # rank: |shapScore| 큰 순서, 같으면 항목 이름 가나다순 (DDL FEATURE_RANK 주석, 11/13 범영 확정)
    ordered = sorted(ALTERNATIVE_CODES, key=lambda c: (-abs(shap_scores[c]), FEATURE_BY_CODE[c].name))
    factors = [
        {
            "rank": i + 1,
            "featureCode": c,
            "featureValue": _feature_value_text(features.get(c)),
            "shapValue": round(shap_values[c], 6),
            "shapScore": shap_scores[c],
        }
        for i, c in enumerate(ordered)
    ]
    return {
        "traditional": traditional,
        "alternative": alternative,
        "shap": {"baseScore": base_score, "factors": factors},
    }
