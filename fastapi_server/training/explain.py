# FP-138 N-14 항목별 SHAP 요인 — 학습한 대안 모델에서 ML-03 응답의 shap 항목(기준점 + 요인 목록)을 만든다.
# 형식·규칙은 서비스 Mock(pipeline/mock_scorer.py)과 같다: baseScore + Σ shapScore = 대안 점수, rank는 |shapScore| 큰 순서이고 같으면 항목 이름 가나다순.
# 점수 환산은 명세서 O-3(700점 = 우량:불량 20:1, 40점마다 오즈 2배, 범위 0~1000)이다. 서비스 연결(FP-141)은 이 모듈을 불러 쓴다.
# SHAP 결과는 모델이 쓴 기여도이며 인과관계가 아니다. 화면에는 "작용한 정도"로만 보여 준다.
import math

import numpy as np
import shap

from pipeline.feature_catalog import FEATURE_BY_CODE
from training import config
from training.interface import to_model_input

# O-3 점수 환산. 서비스 mock_scorer.py와 같은 값이며 tests/test_training_explain.py가 두 곳이 같은지 검사한다.
PDO = 40
FACTOR = PDO / math.log(2)
OFFSET = 700 - FACTOR * math.log(20)


def to_score(log_odds: float) -> int:
    """불량 log-odds → 0~1000점(높을수록 좋음). 범위를 넘으면 0이나 1000으로 자른다."""
    return max(0, min(1000, round(OFFSET - FACTOR * log_odds)))


def _round_to_target(raw_scores: dict, target: int) -> dict:
    """SHAP 점수를 정수로 만들되 합이 target과 정확히 같게 한다. 반올림 차이는 |점수|가 큰 항목부터 1점씩 나눈다(최대 잉여 방식)."""
    rounded = {code: round(value) for code, value in raw_scores.items()}
    diff = target - sum(rounded.values())
    order = sorted(raw_scores, key=lambda code: (-abs(raw_scores[code]), FEATURE_BY_CODE[code].name))
    step = 1 if diff > 0 else -1
    for i in range(abs(diff)):
        rounded[order[i % len(order)]] += step
    return rounded


def _feature_value_text(value) -> str | None:
    """ASSESSMENT_FACTOR.FEATURE_VALUE(문자 100자)에 넣을 글자. 값이 없으면 None."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return str(value)


def _positive_class_values(raw_shap) -> np.ndarray:
    """shap 버전에 따라 이진 분류 결과가 배열 하나 또는 [음성, 양성] 목록이다. 양성(불량) 쪽 한 행을 꺼낸다."""
    values = raw_shap[-1] if isinstance(raw_shap, list) else raw_shap
    return np.asarray(values)[0]


def score_one(model, feature_dict: dict, model_name: str) -> dict:
    """SHAP 없이 점수와 불량 확률만 계산한다(기존 모델, 시뮬레이터 재계산용). 등급은 만들지 않는다(등급 경계는 D-01)."""
    log_odds = float(model.predict(to_model_input(feature_dict, model_name), raw_score=True)[0])
    return {"logOdds": log_odds, "score": to_score(log_odds), "defaultProb": round(1 / (1 + math.exp(-log_odds)), 6)}


class AlternativeExplainer:
    """대안 모델의 SHAP 설명기. 설명기는 만드는 데 시간이 걸리므로 서비스 시작 때 한 번 만들어 재사용한다."""

    def __init__(self, model, model_name: str = "alternative"):
        self.model = model
        self.model_name = model_name
        self.features = config.MODELS[model_name]["features"]
        self.explainer = shap.TreeExplainer(model)
        self.base_log_odds = float(np.ravel(self.explainer.expected_value)[-1])
        self.base_score = to_score(self.base_log_odds)

    def _log_odds(self, model_input) -> float:
        return float(self.model.predict(model_input, raw_score=True)[0])

    def explain(self, feature_dict: dict) -> dict:
        """피처 dict(서비스 build_features 결과) 하나의 점수와 SHAP 요인을 만든다.
        반환: logOdds, score, defaultProb, baseScore, factors(rank·featureCode·featureValue·shapValue·shapScore). baseScore + Σ shapScore = score.
        """
        model_input = to_model_input(feature_dict, self.model_name)
        log_odds = self._log_odds(model_input)
        score = to_score(log_odds)
        shap_log_odds = dict(zip(self.features, _positive_class_values(self.explainer.shap_values(model_input))))
        raw_scores = {code: -FACTOR * float(value) for code, value in shap_log_odds.items()}
        shap_scores = _round_to_target(raw_scores, score - self.base_score)

        ordered = sorted(self.features, key=lambda code: (-abs(shap_scores[code]), FEATURE_BY_CODE[code].name))
        factors = [{"rank": i + 1, "featureCode": code, "featureValue": _feature_value_text(feature_dict.get(code)),
                    "shapValue": round(float(shap_log_odds[code]), 6), "shapScore": shap_scores[code]}
                   for i, code in enumerate(ordered)]
        return {"logOdds": log_odds, "score": score, "defaultProb": round(1 / (1 + math.exp(-log_odds)), 6),
                "baseScore": self.base_score, "factors": factors}
