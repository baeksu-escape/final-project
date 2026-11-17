# FP-138 SHAP 요인 모듈 검사 — 작은 합성 데이터로 학습한 LightGBM으로 계산·형식·합 규칙을 확인한다(학습 데이터 파일 불필요).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import math
import unittest

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd

from pipeline import mock_scorer
from pipeline.feature_builder import build_features
from schemas.assessment import ScoreRequest
from test_mock_scorer import sample_request
from training import config, explain
from training.explain import AlternativeExplainer, score_one, to_score

ALTERNATIVE_MODEL_FILE = config.DEFAULT_OUT_DIR / "alternative.joblib"


def service_features(worker="SELF_EMPLOYED") -> dict:
    return build_features(ScoreRequest(**sample_request(worker=worker)))


def tiny_model(model_name: str = "alternative") -> lgb.LGBMClassifier:
    """합성 데이터로 학습한 작은 모델. 결측도 섞어 LightGBM이 결측을 다루는 경우를 포함한다."""
    features = config.MODELS[model_name]["features"]
    rng = np.random.RandomState(0)
    frame = pd.DataFrame({f: rng.uniform(0, 10, 400) for f in features})
    for column, values in config.CATEGORY_CODES.items():
        if column in frame:
            frame[column] = rng.randint(0, len(values), 400).astype("int32")
    frame.loc[rng.rand(400) < 0.1, features[0]] = np.nan
    target = ((frame[features[1]] + frame[features[3]] + rng.normal(0, 2, 400)) > 10).astype(int)
    model = lgb.LGBMClassifier(n_estimators=40, num_leaves=7, learning_rate=0.1, verbose=-1, random_state=0)
    model.fit(frame, target, categorical_feature=[f for f in features if f in config.CATEGORICAL_FEATURES])
    return model


class ScoreConversionTests(unittest.TestCase):
    def test_anchor_700_is_odds_20_to_1(self):
        self.assertEqual(to_score(-math.log(20)), 700)

    def test_every_40_points_doubles_the_good_odds(self):
        self.assertEqual(to_score(-math.log(20) - math.log(2)), 740)
        self.assertEqual(to_score(-math.log(20) + math.log(2)), 660)

    def test_clipped_to_0_and_1000(self):
        self.assertEqual(to_score(100.0), 0)
        self.assertEqual(to_score(-100.0), 1000)

    def test_constants_match_service_mock(self):
        """서비스 Mock과 같은 O-3 상수를 쓴다. 한쪽만 바뀌면 점수와 SHAP 점수가 어긋나므로 바로 실패시킨다."""
        self.assertEqual(explain.PDO, mock_scorer.PDO)
        self.assertAlmostEqual(explain.FACTOR, mock_scorer.FACTOR)
        self.assertAlmostEqual(explain.OFFSET, mock_scorer.OFFSET)


class RoundToTargetTests(unittest.TestCase):
    def test_sum_equals_target_after_rounding(self):
        raw = {"income_svc_12m_krw": 10.4, "age": 10.4, "dsr_svc_12m": -3.3}
        self.assertEqual(sum(explain._round_to_target(raw, 18).values()), 18)   # 반올림 합 17 → 18로 맞춘다

    def test_sum_follows_target_even_when_it_differs_from_raw_sum(self):
        """점수가 0·1000으로 잘리면 원래 합과 목표가 다르다. 그래도 합은 목표와 같아야 한다."""
        raw = {"income_svc_12m_krw": -20.0, "age": 5.0, "dsr_svc_12m": -1.0}
        for target in (-26, -60, 12):
            self.assertEqual(sum(explain._round_to_target(raw, target).values()), target)


class ExplainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = tiny_model()
        cls.explainer = AlternativeExplainer(cls.model)

    def inputs(self):
        missing = service_features()
        missing["income_svc_12m_krw"] = None
        missing["np_on_time_rate"] = None
        return [service_features("SELF_EMPLOYED"), service_features("EMPLOYEE"), service_features("FREELANCER"), missing]

    def test_shap_is_additive_on_log_odds(self):
        """expected_value + Σ SHAP = 모델 raw margin (SHAP 계산이 모델과 맞는지)."""
        for features in self.inputs():
            model_input = explain.to_model_input(features, "alternative")
            shap_row = explain._positive_class_values(self.explainer.explainer.shap_values(model_input))
            margin = float(self.model.predict(model_input, raw_score=True)[0])
            self.assertAlmostEqual(self.explainer.base_log_odds + float(shap_row.sum()), margin, places=5)

    def test_integer_scores_sum_to_score(self):
        for features in self.inputs():
            result = self.explainer.explain(features)
            self.assertEqual(result["baseScore"] + sum(f["shapScore"] for f in result["factors"]), result["score"])

    def test_sum_rule_holds_when_score_is_clipped(self):
        class Extreme(AlternativeExplainer):
            def _log_odds(self, model_input):          # 점수가 0으로 잘리는 극단값
                return 50.0
        result = Extreme(self.model).explain(service_features())
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["baseScore"] + sum(f["shapScore"] for f in result["factors"]), 0)

    def test_factor_format_matches_service_mock(self):
        """서비스·DB가 이미 쓰는 Mock 응답과 키·타입이 같아야 FP-141에서 그대로 끼운다."""
        features = service_features()
        mock_shap = mock_scorer.score_features(features)["shap"]
        ours = self.explainer.explain(features)
        self.assertEqual(set(mock_shap), {"baseScore", "factors"})
        self.assertEqual(set(mock_shap["factors"][0]), set(ours["factors"][0]))
        for key in ("rank", "featureCode", "shapScore"):
            self.assertIs(type(mock_shap["factors"][0][key]), type(ours["factors"][0][key]), key)

    def test_all_38_factors_ranked_by_abs_score_then_name(self):
        factors = self.explainer.explain(service_features())["factors"]
        self.assertEqual(len(factors), 38)
        self.assertEqual([f["rank"] for f in factors], list(range(1, 39)))
        self.assertEqual({f["featureCode"] for f in factors}, set(config.ALTERNATIVE_FEATURES))
        for first, second in zip(factors, factors[1:]):
            self.assertGreaterEqual(abs(first["shapScore"]), abs(second["shapScore"]))
            if abs(first["shapScore"]) == abs(second["shapScore"]):
                self.assertLessEqual(explain.FEATURE_BY_CODE[first["featureCode"]].name,
                                     explain.FEATURE_BY_CODE[second["featureCode"]].name)

    def test_shap_value_has_at_most_six_decimals(self):
        for factor in self.explainer.explain(service_features())["factors"]:
            self.assertEqual(round(factor["shapValue"], 6), factor["shapValue"])

    def test_feature_value_text(self):
        by_code = {f["featureCode"]: f for f in self.explainer.explain(self.inputs()[3])["factors"]}
        self.assertIsNone(by_code["income_svc_12m_krw"]["featureValue"])      # 결측은 None
        self.assertIsNone(by_code["np_on_time_rate"]["featureValue"])
        self.assertEqual(by_code["segment"]["featureValue"], "selfemp")        # 범주는 서비스 원문 문자열
        self.assertEqual(by_code["age"]["featureValue"], "34")

    def test_same_input_same_result(self):
        features = service_features()
        self.assertEqual(self.explainer.explain(features), self.explainer.explain(features))

    def test_score_one_matches_explain(self):
        features = service_features()
        result = self.explainer.explain(features)
        single = score_one(self.model, features, "alternative")
        self.assertEqual((single["score"], single["defaultProb"]), (result["score"], result["defaultProb"]))
        self.assertAlmostEqual(single["logOdds"], result["logOdds"])

    def test_default_prob_is_inverse_logit_of_margin(self):
        result = self.explainer.explain(service_features())
        self.assertAlmostEqual(result["defaultProb"], 1 / (1 + math.exp(-result["logOdds"])), places=6)


@unittest.skipUnless(ALTERNATIVE_MODEL_FILE.exists(), "artifacts/alternative.joblib 가 없다(python -m training.train 으로 만든다)")
class SavedModelExplainTests(unittest.TestCase):
    """저장한 실제 대안 모델에서도 합 규칙과 형식이 성립하는지(모델 파일이 있을 때만)."""

    def test_sum_rule_and_format_on_saved_model(self):
        explainer = AlternativeExplainer(joblib.load(ALTERNATIVE_MODEL_FILE))
        for worker in ("SELF_EMPLOYED", "EMPLOYEE", "FREELANCER"):
            result = explainer.explain(service_features(worker))
            self.assertEqual(len(result["factors"]), 38)
            self.assertEqual(result["baseScore"] + sum(f["shapScore"] for f in result["factors"]), result["score"])
            self.assertTrue(0 <= result["score"] <= 1000)


if __name__ == "__main__":
    unittest.main()
