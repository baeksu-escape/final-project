# FP-141 실제 모델 연결 검사 — 모델 버전으로 계산기를 고르는 규칙, 실제 모델 응답 모양, 503·409, 시뮬레이터, 반올림.
# 학습 데이터·모델 파일 없이도 돈다: 재욱 님 테스트(test_training_explain)의 작은 합성 모델을 빌려 쓴다.
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import json
import tempfile
import unittest
from pathlib import Path

from pipeline import model_scorer
from pipeline.feature_builder import build_features, round_half_up
from pipeline.feature_catalog import MODEL_VERSION, REAL_FEATURE_SET_VERSION, REAL_MODEL_VERSION, grade_band
from pipeline.model_scorer import ModelScorer, load_from_artifacts
from routers.assessment import ApiError, health, model_info, score, simulate_score
from schemas.assessment import ScoreRequest, SimulateRequest
from test_mock_scorer import REQUEST_ID, sample_request
from test_training_explain import tiny_model
from training import config

SIMULATE_ID = "9b2e4c1a-1111-4c1e-9a2b-1d2e3f4a5b6c"


class ScorerSwitchTestBase(unittest.TestCase):
    """서버 전체에서 쓰는 모델 묶음(model_scorer._scorer)을 시험용으로 바꾸고, 끝나면 되돌린다."""

    @classmethod
    def setUpClass(cls):
        cls.real = ModelScorer(tiny_model("legacy"), tiny_model("alternative"))

    def setUp(self):
        self._saved = model_scorer._scorer

    def tearDown(self):
        model_scorer._scorer = self._saved

    def use(self, scorer):
        model_scorer._scorer = scorer


class RealModelScoreTest(ScorerSwitchTestBase):
    """ML-03: DB ACTIVE가 LGBM-BASE-0.1이면 실제 모델, DEV-DUMMY면 지금과 같은 Mock."""

    def test_real_model_response_has_mock_shape_and_sum_rule(self):
        self.use(self.real)
        r = score(ScoreRequest(**sample_request(expectedModelVersion=REAL_MODEL_VERSION)), None)
        self.assertEqual((r["modelVersion"], r["featureSetVersion"]), (REAL_MODEL_VERSION, REAL_FEATURE_SET_VERSION))
        for side in ("traditional", "alternative"):
            self.assertEqual(set(r[side]), {"scorableYn", "score", "gradeBandCode", "defaultProb"})
            self.assertTrue(0 <= r[side]["score"] <= 1000)
            self.assertIn(r[side]["gradeBandCode"], {"GOOD", "STANDARD", "CAUTION"})
        factors = r["shap"]["factors"]
        self.assertEqual(len(factors), len(config.MODELS["alternative"]["features"]))   # 38개 (LRZ021201 없음)
        self.assertNotIn("LRZ021201", {f["featureCode"] for f in factors})
        self.assertEqual(r["shap"]["baseScore"] + sum(f["shapScore"] for f in factors), r["alternative"]["score"])
        self.assertEqual(set(factors[0]), {"rank", "featureCode", "featureValue", "shapValue", "shapScore"})

    def test_dev_dummy_and_missing_version_stay_mock(self):
        """병합해도 DB가 DEV-DUMMY인 동안은 아무것도 바뀌지 않는다(시연 안전)."""
        self.use(self.real)
        for body in (sample_request(), sample_request(expectedModelVersion=None)):
            r = score(ScoreRequest(**body), None)
            self.assertEqual((r["modelVersion"], r["featureSetVersion"]), (MODEL_VERSION, "FS-DRAFT"))
            self.assertEqual(len(r["shap"]["factors"]), 39)

    def test_real_model_not_loaded_is_503_not_mock(self):
        """모델 파일이 없는 PC: Mock으로 바꾸지 않고 503 MODEL_NOT_READY(11/17 범영·재욱 합의 (가))."""
        self.use(ModelScorer())
        with self.assertRaises(ApiError) as e:
            score(ScoreRequest(**sample_request(expectedModelVersion=REAL_MODEL_VERSION)), None)
        self.assertEqual((e.exception.status, e.exception.code), (503, "MODEL_NOT_READY"))

    def test_unknown_version_is_409(self):
        with self.assertRaises(ApiError) as e:
            score(ScoreRequest(**sample_request(expectedModelVersion="OLD")), None)
        self.assertEqual((e.exception.status, e.exception.code), (409, "VERSION_MISMATCH"))

    def test_health_reports_real_model_loaded(self):
        self.use(self.real)
        self.assertEqual((health()["modelLoaded"], health()["modelVersion"]), (True, REAL_MODEL_VERSION))
        self.use(ModelScorer())
        self.assertEqual((health()["modelLoaded"], health()["modelVersion"]), (False, MODEL_VERSION))


class RealModelSimulationTest(ScorerSwitchTestBase):
    """ML-04: 저장된 평가의 모델 버전으로 계산기를 고른다."""

    def simulate_request(self, model_version: str, changes: dict) -> SimulateRequest:
        snapshot = build_features(ScoreRequest(**sample_request()))
        return SimulateRequest(requestId=SIMULATE_ID, changes=changes, baseAssessment={
            "requestId": REQUEST_ID, "modelVersion": model_version, "featureSetVersion": REAL_FEATURE_SET_VERSION,
            "featureSnapshot": snapshot})

    def test_simulate_with_real_model(self):
        self.use(self.real)
        r = simulate_score(self.simulate_request(REAL_MODEL_VERSION, {"DELINQ_COUNT_12M": 0}), None)
        self.assertEqual(r["modelVersion"], REAL_MODEL_VERSION)
        self.assertEqual(r["delta"]["total"], r["after"]["score"] - r["before"]["score"])
        self.assertEqual(len(r["shap"]["factors"]), 38)
        self.assertLessEqual(len(r["topReductionFactors"]), 3)

    def test_simulate_real_not_loaded_is_503(self):
        self.use(ModelScorer())
        with self.assertRaises(ApiError) as e:
            simulate_score(self.simulate_request(REAL_MODEL_VERSION, {}), None)
        self.assertEqual(e.exception.status, 503)


class ModelFileLoadingTest(unittest.TestCase):
    """artifacts 폴더 읽기 — 파일이 없거나 설명 파일의 버전이 다르면 준비 안 됨(서버는 켜진다)."""

    def test_missing_files_means_not_ready(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertFalse(load_from_artifacts(Path(folder)).ready)

    def test_meta_with_other_version_means_not_ready(self):
        import joblib
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            for name in ("legacy", "alternative"):
                joblib.dump(tiny_model(name), directory / f"{name}.joblib")
                (directory / f"{name}.meta.json").write_text(
                    json.dumps({"model_version": "OTHER-9", "feature_set_version": REAL_FEATURE_SET_VERSION}), encoding="utf-8")
            self.assertFalse(load_from_artifacts(directory).ready)
            for name in ("legacy", "alternative"):   # 버전이 맞으면 준비됨
                (directory / f"{name}.meta.json").write_text(
                    json.dumps({"model_version": REAL_MODEL_VERSION, "feature_set_version": REAL_FEATURE_SET_VERSION}), encoding="utf-8")
            self.assertTrue(load_from_artifacts(directory).ready)


class ModelVersionFromBundleTest(ScorerSwitchTestBase):
    """FP-237 실제 모델 버전은 불러온 묶음의 meta.json에서 정한다 — 0.1·0.2 어느 묶음을 넣어도 그 버전으로 동작한다."""

    def bundle(self, directory: Path, versions: dict):
        import joblib
        for name in ("legacy", "alternative"):
            joblib.dump(tiny_model(name), directory / f"{name}.joblib")
            meta = {"feature_set_version": REAL_FEATURE_SET_VERSION}
            if versions.get(name) is not None:
                meta["model_version"] = versions[name]
            (directory / f"{name}.meta.json").write_text(json.dumps(meta), encoding="utf-8")

    def test_version_comes_from_meta(self):
        with tempfile.TemporaryDirectory() as folder:
            self.bundle(Path(folder), {"legacy": "LGBM-BASE-0.2", "alternative": "LGBM-BASE-0.2"})
            scorer = load_from_artifacts(Path(folder))
            self.assertTrue(scorer.ready)
            self.assertEqual(scorer.version, "LGBM-BASE-0.2")

    def test_old_bundle_without_version_uses_default(self):
        with tempfile.TemporaryDirectory() as folder:
            self.bundle(Path(folder), {})
            self.assertEqual(load_from_artifacts(Path(folder)).version, REAL_MODEL_VERSION)

    def test_mixed_versions_are_not_loaded(self):
        """두 설명 파일의 버전이 다르면(다른 학습의 파일이 섞임) 열지 않는다."""
        with tempfile.TemporaryDirectory() as folder:
            self.bundle(Path(folder), {"legacy": "LGBM-BASE-0.1", "alternative": "LGBM-BASE-0.2"})
            self.assertFalse(load_from_artifacts(Path(folder)).ready)

    def test_loaded_02_scores_02_and_rejects_01(self):
        """0.2 묶음을 불러온 서버: 0.2 요청은 실제 모델, 0.1 요청은 409(평가를 다시 산출하라는 신호), health는 0.2."""
        self.use(ModelScorer(tiny_model("legacy"), tiny_model("alternative"), "LGBM-BASE-0.2"))
        r = score(ScoreRequest(**sample_request(expectedModelVersion="LGBM-BASE-0.2")), None)
        self.assertEqual((r["modelVersion"], r["featureSetVersion"]), ("LGBM-BASE-0.2", REAL_FEATURE_SET_VERSION))
        with self.assertRaises(ApiError) as e:
            score(ScoreRequest(**sample_request(expectedModelVersion="LGBM-BASE-0.1")), None)
        self.assertEqual((e.exception.status, e.exception.code), (409, "VERSION_MISMATCH"))
        h = health()
        self.assertEqual((h["modelLoaded"], h["modelVersion"], h["supportedModelVersions"]),
                         (True, "LGBM-BASE-0.2", [MODEL_VERSION, "LGBM-BASE-0.2"]))

    def test_cutoff_follows_bundle_version(self):
        """FP-285 0.2 묶음은 CUT-0.3, 0.3 묶음은 CUT-0.4로 점수·시뮬레이터·model-info가 답하고 등급도 그 구간을 따른다."""
        for version, cutoff, good_min in (("LGBM-BASE-0.2", "CUT-0.3", 727), ("LGBM-BASE-0.3", "CUT-0.4", 712)):
            with self.subTest(version=version):
                self.use(ModelScorer(tiny_model("legacy"), tiny_model("alternative"), version))
                r = score(ScoreRequest(**sample_request(expectedModelVersion=version)), None)
                self.assertEqual(r["cutoffVersion"], cutoff)
                for side in ("traditional", "alternative"):
                    self.assertEqual(r[side]["gradeBandCode"], grade_band(r[side]["score"], cutoff))
                simulated = simulate_score(SimulateRequest(requestId=SIMULATE_ID, changes={}, baseAssessment={
                    "requestId": REQUEST_ID, "modelVersion": version, "featureSetVersion": REAL_FEATURE_SET_VERSION,
                    "featureSnapshot": r["featureSnapshot"]}), None)
                self.assertEqual(simulated["cutoffVersion"], cutoff)
                info = model_info()
                self.assertEqual((info["modelVersion"], info["cutoffVersion"]), (version, cutoff))
                self.assertEqual(info["gradeBands"][-1]["minScore"], good_min)

    def test_mock_keeps_cut_03_even_with_03_bundle(self):
        """FP-285 0.3 묶음을 불러온 서버에서도 Mock(DEV-DUMMY) 요청은 CUT-0.3이다."""
        self.use(ModelScorer(tiny_model("legacy"), tiny_model("alternative"), "LGBM-BASE-0.3"))
        self.assertEqual(score(ScoreRequest(**sample_request()), None)["cutoffVersion"], "CUT-0.3")

    def test_not_loaded_any_real_version_is_503(self):
        """묶음이 없는 서버에 실제 모델 버전(0.1이든 0.2든)을 요청하면 Mock으로 바꾸지 않고 503."""
        self.use(ModelScorer())
        for version in ("LGBM-BASE-0.1", "LGBM-BASE-0.2"):
            with self.subTest(version=version), self.assertRaises(ApiError) as e:
                score(ScoreRequest(**sample_request(expectedModelVersion=version)), None)
            self.assertEqual((e.exception.status, e.exception.code), (503, "MODEL_NOT_READY"))
        self.assertEqual(health()["supportedModelVersions"], [MODEL_VERSION])


class ModelHashCheckTest(unittest.TestCase):
    """SHA256SUMS.txt가 있으면 joblib을 열기 전에 해시를 대조한다(#74 리뷰 ④)."""

    def write_bundle(self, directory: Path, tamper: bool):
        import hashlib
        import joblib
        lines = []
        for name in ("legacy", "alternative"):
            path = directory / f"{name}.joblib"
            joblib.dump(tiny_model(name), path)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            lines.append(f"{'0' * 64 if tamper and name == 'legacy' else digest}  {path.name}")
        (directory / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    def test_matching_hashes_load(self):
        with tempfile.TemporaryDirectory() as folder:
            self.write_bundle(Path(folder), tamper=False)
            self.assertTrue(load_from_artifacts(Path(folder)).ready)

    def test_wrong_hash_is_not_loaded(self):
        """받은 묶음과 다른 파일(해시 불일치)은 열지 않고 준비 안 됨 → 실제 모델 요청은 503."""
        with tempfile.TemporaryDirectory() as folder:
            self.write_bundle(Path(folder), tamper=True)
            self.assertFalse(load_from_artifacts(Path(folder)).ready)


class RoundHalfUpTest(unittest.TestCase):
    def test_exact_half_goes_up_like_training_data(self):
        """학습 생성 코드와 같은 ROUND_HALF_UP. Python round(1.25, 1)은 1.2라서 경계값이 학습과 달라진다."""
        self.assertEqual(round_half_up(1.25, 1), 1.3)
        self.assertEqual(round_half_up(0.12345, 4), 0.1235)
        self.assertEqual(round_half_up(2.0, 4), 2.0)


if __name__ == "__main__":
    unittest.main()
