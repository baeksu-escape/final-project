# FP-135 모델 입력 규격 검사 — 서비스 피처 dict가 학습한 모델의 입력 규격(열 순서·범주 부호·결측)으로 바뀌는지 확인한다.
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import re
import unittest

import joblib
import numpy as np

from pipeline.feature_builder import build_features
from schemas.assessment import ScoreRequest
from test_mock_scorer import sample_request
from training import config
from training.interface import to_model_input

MODEL_FILES = {name: config.DEFAULT_OUT_DIR / f"{name}.joblib" for name in config.MODELS}


def service_features(**overrides) -> dict:
    """서비스가 실제로 만드는 피처 dict (Mock 시험의 합성 요청 사용)."""
    return build_features(ScoreRequest(**sample_request(**overrides)))


class ToModelInputTests(unittest.TestCase):
    def test_columns_follow_config_order(self):
        for name, spec in config.MODELS.items():
            self.assertEqual(list(to_model_input(service_features(), name).columns), spec["features"])

    def test_one_row_and_dtypes(self):
        frame = to_model_input(service_features(), "alternative")
        self.assertEqual(frame.shape, (1, 38))
        for column in config.ALTERNATIVE_FEATURES:
            expected = "int32" if column in config.CATEGORICAL_FEATURES else "float64"
            self.assertEqual(str(frame[column].dtype), expected, column)

    def test_categories_use_fixed_codes(self):
        frame = to_model_input(service_features(), "alternative")
        self.assertEqual(frame.loc[0, "segment"], config.CATEGORY_CODES["segment"].index("selfemp"))
        self.assertEqual(frame.loc[0, "np_payer_type"], config.CATEGORY_CODES["np_payer_type"].index("regional"))
        self.assertEqual(frame.loc[0, "hi_payer_type"], config.CATEGORY_CODES["hi_payer_type"].index("household"))

    def test_none_becomes_nan_not_zero(self):
        features = service_features()
        features["income_svc_12m_krw"] = None
        features["np_on_time_rate"] = None
        frame = to_model_input(features, "alternative")
        self.assertTrue(np.isnan(frame.loc[0, "income_svc_12m_krw"]))
        self.assertTrue(np.isnan(frame.loc[0, "np_on_time_rate"]))

    def test_unknown_category_becomes_minus_one(self):
        """학습에 없는 값(voluntary)은 -1(결측). 처리 방식은 정의서 9장 미정이라 임시 동작이다."""
        features = service_features()
        features["np_payer_type"] = "voluntary"
        self.assertEqual(to_model_input(features, "alternative").loc[0, "np_payer_type"], -1)

    def test_legacy_input_has_only_legacy_columns(self):
        frame = to_model_input(service_features(), "legacy")
        self.assertEqual(frame.shape, (1, 18))
        self.assertNotIn("np_payer_type", frame.columns)      # 대안 데이터 열은 기존 모델 입력에 없다
        self.assertNotIn("LRZ021201", frame.columns)           # C9로 모델에서 뺐다. 서비스 dict에는 남아 있어도 무시한다

    def test_missing_key_is_an_error(self):
        features = service_features()
        del features["DQ1200001"]
        with self.assertRaises(ValueError):
            to_model_input(features, "legacy")

    def test_non_numeric_text_is_an_error(self):
        features = service_features()
        features["age"] = "서른"
        with self.assertRaises(ValueError):
            to_model_input(features, "legacy")


class ReadmeSpecTests(unittest.TestCase):
    """training/README.md의 입력 규격 표가 config.py와 같은지 — 표를 고치지 않고 config만 바꾸는 실수를 막는다."""

    def setUp(self):
        self.text = (config.FASTAPI_ROOT / "training" / "README.md").read_text(encoding="utf-8")

    def test_feature_table_matches_config_order(self):
        rows = re.findall(r"^\| (\d+) \| `(\w+)` \| (○?) \|", self.text, flags=re.MULTILINE)
        self.assertEqual([name for _, name, _ in rows], config.ALTERNATIVE_FEATURES)
        self.assertEqual([int(number) for number, _, _ in rows], list(range(1, 39)))
        legacy_marked = [name for _, name, mark in rows if mark == "○"]
        self.assertEqual(legacy_marked, config.LEGACY_FEATURES)

    def test_category_code_table_matches_config(self):
        for column, values in config.CATEGORY_CODES.items():
            expected = ", ".join(f"{value}={i}" for i, value in enumerate(values))
            self.assertIn(f"| `{column}` | {expected} |", self.text)


@unittest.skipUnless(all(path.exists() for path in MODEL_FILES.values()),
                     "artifacts/에 학습한 모델 파일이 없다(python -m training.train 으로 만든다)")
class SavedModelTests(unittest.TestCase):
    """저장한 모델 파일이 이 입력 규격으로 확률을 내는지 확인한다(모델 파일이 있을 때만)."""

    def test_predict_proba_returns_probability_per_row(self):
        for name, path in MODEL_FILES.items():
            proba = joblib.load(path).predict_proba(to_model_input(service_features(), name))
            self.assertEqual(proba.shape, (1, 2), name)
            self.assertTrue(0.0 <= proba[0, 1] <= 1.0, name)
            self.assertAlmostEqual(float(proba[0].sum()), 1.0, places=6)

    def test_missing_inputs_still_predict(self):
        """이상치로 걸러져 결측이 된 입력도 모델이 확률을 낸다(결측을 모델이 처리)."""
        features = service_features()
        for key in ["income_svc_12m_krw", "dsr_svc_12m", "np_on_time_rate"]:
            features[key] = None
        proba = joblib.load(MODEL_FILES["alternative"]).predict_proba(to_model_input(features, "alternative"))
        self.assertTrue(0.0 <= proba[0, 1] <= 1.0)


if __name__ == "__main__":
    unittest.main()
