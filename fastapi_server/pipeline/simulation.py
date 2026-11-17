# FP-140 예측 Mock — 실제 모델 아님.
# N-18 신용케어 시뮬레이터: 저장된 평가의 피처값에서 출발해, 화면에서 바꾼 값만 덮어쓰고 다시 계산한다.
# 결과는 저장하지 않는다(O-9, 11/16 확정).
# 화면 입력 → 피처 대응은 피처 정의서 8-2와 B팀 명세서 4-4 "키 ↔ 피처" 표를 따른다.
from pipeline.feature_builder import round_half_up
from pipeline.feature_catalog import FEATURE_BY_CODE
from pipeline.mock_scorer import score_features

# 화면 입력 키 → 피처 코드 (그대로 넣는 것). 카드 한도·사용액, 간편결제 월 건수는 아래에서 따로 바꾼다.
DIRECT_CHANGES = {
    "TELECOM_ON_TIME_MONTHS": "telecom_on_time_streak",
    "DELINQ_COUNT_12M": "DQ1200001",
    "CASH_ADVANCE_MONTHS": "CF1231605",
    "NEW_LOAN_COUNT_3M": "L22000900",
    "LOAN_BALANCE_AMT": "debt_balance_krw",
    "PRIVATE_LENDER_LOAN_BALANCE_AMT": "LA0099212",
    "UTILITY_LATE_MONTHS": "utility_late_months",  # 10번째 입력 확정 (11/17, 정의서 C21)
}

# O-14 회복 점수(11/16 범영 확정): 그 항목을 시뮬레이터 범위 안 가장 좋은 값으로 바꿨을 때의 점수 차이.
# 아래는 그 "가장 좋은 값"이다. 범위는 정의서 8-2 기준이며, 간편결제 월 건수 상한(50건)은 화면 범위가 정해지면 맞춘다.
BEST_VALUES = {
    "telecom_on_time_streak": 12,
    "utility_late_months": 0,
    "DQ1200001": 0,
    "CF1231605": 0,
    "L22000900": 0,
    "LA0099212": 0,
    "CL0631905": 0,
    "debt_balance_krw": 0,
    "dp_payment_count_12m": 600,   # 월 50건 × 12
}


CARD_KEYS = ("CARD_LIMIT_AMT", "CARD_MONTHLY_SPEND_AMT")
# 받는 키 10개 (B팀 명세서 4-4). 이 밖의 키는 오타일 수 있어 422로 알려 준다(조용히 무시하지 않는다).
ALLOWED_CHANGE_KEYS = frozenset(DIRECT_CHANGES) | {"EASYPAY_MONTHLY_COUNT", *CARD_KEYS}


def _as_int(value):
    return None if value is None else int(value)


def validate_changes(changes: dict) -> list[dict]:
    """ML-04 changes 검사 — 문제가 있으면 [{field, message}] 목록, 없으면 빈 목록 (라우터가 422로 돌려준다)."""
    errors = [{"field": f"changes.{key}", "message": "모르는 항목입니다."} for key in sorted(changes) if key not in ALLOWED_CHANGE_KEYS]
    limit, spend = changes.get(CARD_KEYS[0]), changes.get(CARD_KEYS[1])
    if (limit is None) != (spend is None):
        # 저장된 피처값에는 사용률만 있고 원래 한도·사용액이 없어서, 하나만으로는 사용률을 다시 계산할 수 없다
        errors.append({"field": "changes.CARD_LIMIT_AMT", "message": "카드 한도와 월 카드 사용액은 함께 보내야 합니다."})
    return errors


def apply_changes(snapshot: dict, changes: dict) -> dict:
    """저장된 피처값에 바꾼 값을 덮어쓴 새 피처값. 값이 없는(null) 키는 바꾸지 않는다. validate_changes를 먼저 통과해야 한다."""
    features = dict(snapshot)
    for key, code in DIRECT_CHANGES.items():
        if changes.get(key) is not None:
            features[code] = _as_int(changes[key])
    # TODO(정의서 9장) 간편결제 월 건수 ↔ 12개월 값 변환 방식 미정 — 지금은 월 값 × 12
    if changes.get("EASYPAY_MONTHLY_COUNT") is not None:
        features["dp_payment_count_12m"] = _as_int(changes["EASYPAY_MONTHLY_COUNT"]) * 12
    # 카드 한도·월 사용액 → 사용률(CL0631905). 한도가 0 이하면 점수 계산(feature_builder)과 같은 규칙으로 결측.
    limit, spend = changes.get(CARD_KEYS[0]), changes.get(CARD_KEYS[1])
    if limit is not None and spend is not None:
        features["CL0631905"] = round_half_up(spend / limit * 100, 1) if limit > 0 else None
    # TODO(정의서 9장) 통신비 정시 납부를 바꿀 때 telecom_late_months도 같이 바꿀지 미정 — 지금은 그대로 둔다.
    return features


def _top_reduction_factors(features: dict, result: dict, scorer=score_features) -> list[dict]:
    """N-18-8 감점 요인 상위 3개: 시뮬레이터에서 바꿀 수 있는 항목 중 shapScore가 가장 낮은(음수) 3개와 회복 점수."""
    current = result["alternative"]["score"]
    candidates = [f for f in result["shap"]["factors"]
                  if f["shapScore"] < 0 and FEATURE_BY_CODE[f["featureCode"]].simulatable_yn == "Y"]
    candidates.sort(key=lambda f: (f["shapScore"], FEATURE_BY_CODE[f["featureCode"]].name))
    top = []
    for f in candidates[:3]:
        code = f["featureCode"]
        improved = dict(features)
        improved[code] = BEST_VALUES.get(code, features.get(code))
        recover = scorer(improved)["alternative"]["score"] - current
        top.append({"rank": len(top) + 1, "featureCode": code, "featureValue": f["featureValue"],
                    "shapScore": f["shapScore"], "recoverScore": max(0, recover)})
    return top


def simulate(snapshot: dict, changes: dict, scorer=score_features) -> dict:
    """바꾸기 전·후 점수와 차이. 차이는 금융 이력 영향 + 대안 데이터 영향 = 전체가 되도록 SHAP 차이로 나눈다.
    scorer는 저장된 평가의 모델 버전으로 고른 계산기다(Mock 또는 실제 모델, FP-141). 응답 모양은 둘이 같다."""
    before = scorer(snapshot)
    after_features = apply_changes(snapshot, changes)
    after = scorer(after_features)

    before_by_code = {f["featureCode"]: f["shapScore"] for f in before["shap"]["factors"]}
    financial = alternative = 0
    for f in after["shap"]["factors"]:
        diff = f["shapScore"] - before_by_code[f["featureCode"]]
        if FEATURE_BY_CODE[f["featureCode"]].alternative_yn == "Y":
            alternative += diff
        else:
            financial += diff

    def summary(r):
        a = r["alternative"]
        return {"score": a["score"], "gradeBandCode": a["gradeBandCode"], "defaultProb": a["defaultProb"]}

    return {
        "before": summary(before),
        "after": summary(after),
        "delta": {"total": after["alternative"]["score"] - before["alternative"]["score"],
                  "financialEffect": financial, "alternativeEffect": alternative},
        "topReductionFactors": _top_reduction_factors(after_features, after, scorer),
        "shap": after["shap"],
    }
