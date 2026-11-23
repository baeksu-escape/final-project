# 모델 0.2 학습 옵션 검사 — 단조 제약(--monotone)과 씬파일 학습 포함(--with-thinfile)이 의도대로 동작하고, 옵션이 없으면 기존과 같은지 본다.
# 작은 합성 표로 train.py·export_eval_scores.py를 실제로 돌려 본다(학습 데이터·모델 파일 없이 실행, DB 접속 불필요).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import joblib
import numpy as np
import pandas as pd

from training import config, export_eval_scores, train
from training.data_io import load_thinfile_train_valid

SEGMENTS = ["wage", "selfemp", "freelance"]


def make_table(rows: int, seed: int, with_exposure: bool) -> pd.DataFrame:
    """모델 피처 38개·라벨 2개·분할 열을 가진 작은 합성 표. 분할은 TRAIN 60%, VALID 20%, TEST 20%이고 라벨은 두 값이 모두 나오게 만든다."""
    rng = np.random.default_rng(seed)
    frame = pd.DataFrame({name: rng.normal(1_000_000, 100_000, rows) for name in config.ALTERNATIVE_FEATURES})
    for column, codes in config.CATEGORY_CODES.items():
        frame[column] = [codes[i % len(codes)] for i in range(rows)]
    frame["segment"] = [SEGMENTS[i % 3] for i in range(rows)]
    frame["customer_id"] = [f"C{seed}{i:04d}" for i in range(rows)]
    frame[config.SPLIT_COLUMN] = ["TRAIN"] * (rows * 6 // 10) + ["VALID"] * (rows * 2 // 10) + ["TEST"] * (rows - rows * 6 // 10 - rows * 2 // 10)
    for label in ("label_any_delinquency_12m", "label_nonfin_effect_12m"):
        frame[label] = (rng.random(rows) < 0.3).astype(int)
    if with_exposure:
        frame[config.EXPOSURE_COLUMN] = [0 if i % 3 == 0 else 1 for i in range(rows)]      # 3행 중 1행은 노출 0
    return frame


class DataDirCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data_dir = Path(self.tmp.name) / "data"
        (self.data_dir / "1_model").mkdir(parents=True)
        self.legacy = make_table(300, 1, with_exposure=False)
        self.thinfile = make_table(300, 2, with_exposure=True)
        self.legacy.to_csv(self.data_dir / config.TABLE_RELATIVE_PATH, index=False)
        self.thinfile.to_csv(self.data_dir / config.THINFILE_TABLE_RELATIVE_PATH, index=False)
        self.out_dir = Path(self.tmp.name) / "out"

    def exposed(self, split: str) -> int:
        part = self.thinfile
        return int(((part[config.SPLIT_COLUMN] == split) & (part[config.EXPOSURE_COLUMN] == 1)).sum())

    def run_main(self, module, argv):
        with mock.patch.object(sys, "argv", ["prog", *argv]), contextlib.redirect_stdout(io.StringIO()):
            module.main()


class FitModelTests(unittest.TestCase):
    def u_shaped_data(self):
        """a가 작을 때와 클 때 위험이 높은 U자 관계. 제약이 없으면 모델이 그대로 배우고, a에 +1 제약을 걸면 올라가기만 하는 모양만 남는다."""
        rng = np.random.default_rng(0)
        a = rng.uniform(0, 1, 4000)
        risk = np.where(a < 0.3, 0.6, np.where(a < 0.7, 0.1, 0.3))
        frame = pd.DataFrame({"a": a, "b": rng.uniform(0, 1, 4000)})
        frame["y"] = (rng.random(4000) < risk).astype(int)
        return frame

    def predictions_along_a(self, model):
        grid = pd.DataFrame({"a": np.linspace(0, 1, 200), "b": 0.5})
        return model.predict_proba(grid)[:, 1]

    def test_monotone_constraint_forces_one_direction(self):
        data = self.u_shaped_data()
        constrained = train.fit_model(data, ["a", "b"], "y", 11, {"a": 1})
        free = train.fit_model(data, ["a", "b"], "y", 11)
        self.assertTrue((np.diff(self.predictions_along_a(constrained)) >= -1e-12).all())    # 제약: a가 커져도 불량 확률이 내려가지 않는다
        self.assertTrue((np.diff(self.predictions_along_a(free)) < -1e-3).any())             # 제약이 없으면 내려가는 구간이 있다(시험이 의미 있는지 확인)

    def test_constraint_list_follows_feature_order_and_unlisted_are_zero(self):
        data = self.u_shaped_data()
        data["c"] = 0.0
        model = train.fit_model(data, ["b", "a", "c"], "y", 11, {"a": 1, "c": -1})
        self.assertEqual(model.get_params()["monotone_constraints"], [0, 1, -1])

    def test_without_monotone_uses_the_default_params(self):
        model = train.fit_model(self.u_shaped_data(), ["a", "b"], "y", 11)
        self.assertIsNone(model.get_params().get("monotone_constraints"))
        for name, value in config.LGBM_PARAMS.items():
            self.assertEqual(model.get_params()[name], value, name)

    def test_config_constraints_are_model_features_with_plus_or_minus_one(self):
        self.assertEqual(set(config.MONOTONE_CONSTRAINTS.values()), {1, -1})
        for name in config.MONOTONE_CONSTRAINTS:
            self.assertIn(name, config.LEGACY_FEATURES, name)              # 기존·대안 모델 둘 다 쓰는 피처에만 건다
            self.assertIn(name, config.ALTERNATIVE_FEATURES, name)


    def test_config_constraints_are_the_adopted_candidate_b(self):
        # 모델 0.2로 채택한 후보 B(11/20 시험): 위험이 커지는 방향 +1 여섯, 줄어드는 방향 -1 둘. 바꾸면 모델이 달라지므로 새 버전에서만 바꾼다.
        self.assertEqual(config.MONOTONE_CONSTRAINTS, {
            "expense_ratio_svc_12m": 1, "dsr_svc_12m": 1, "deficit_months_svc_12m": 1, "DQ1200001": 1, "CL0631905": 1,
            "expense_avg_month_krw": 1, "worst_month_net_cash_svc_12m_krw": -1, "income_svc_12m_krw": -1,
        })


class LoaderTests(DataDirCase):
    def test_thinfile_loader_keeps_only_exposed_train_and_valid_rows(self):
        loaded = load_thinfile_train_valid(self.data_dir / config.THINFILE_TABLE_RELATIVE_PATH)
        self.assertEqual(set(loaded[config.EXPOSURE_COLUMN]), {1})
        self.assertEqual(set(loaded[config.SPLIT_COLUMN]), {"TRAIN", "VALID"})        # TEST는 읽자마자 버린다
        self.assertEqual(len(loaded), self.exposed("TRAIN") + self.exposed("VALID"))

    def test_thinfile_loader_stops_without_exposure_column(self):
        path = self.data_dir / "1_model" / "no_exposure.csv"
        self.thinfile.drop(columns=[config.EXPOSURE_COLUMN]).to_csv(path, index=False)
        with self.assertRaises(SystemExit):
            load_thinfile_train_valid(path)

    def test_training_sets_without_thinfile_match_the_old_behavior(self):
        train_rows, valid, thin_valid, info = train.load_training_sets(self.data_dir)
        self.assertEqual(len(train_rows), int((self.legacy[config.SPLIT_COLUMN] == "TRAIN").sum()))
        self.assertEqual(len(valid), int((self.legacy[config.SPLIT_COLUMN] == "VALID").sum()))
        self.assertIsNone(thin_valid)
        self.assertNotIn("thinfile_table_sha256", info)

    def test_training_sets_with_thinfile_add_only_exposed_thinfile_train_rows(self):
        train_rows, valid, thin_valid, info = train.load_training_sets(self.data_dir, with_thinfile=True)
        legacy_train = int((self.legacy[config.SPLIT_COLUMN] == "TRAIN").sum())
        self.assertEqual(len(train_rows), legacy_train + self.exposed("TRAIN"))
        self.assertEqual(set(valid[config.SPLIT_COLUMN]), {"VALID"})
        self.assertEqual(set(thin_valid[config.SPLIT_COLUMN]), {"VALID"})              # 씬파일 TRAIN은 학습에 쓰므로 평가용에는 VALID만
        self.assertEqual(len(thin_valid), self.exposed("VALID"))
        self.assertEqual(info["train_rows_thinfile"], self.exposed("TRAIN"))
        self.assertEqual(len(info["thinfile_table_sha256"]), 64)
        self.assertNotIn("TEST", set(train_rows[config.SPLIT_COLUMN]))


class TrainMainTests(DataDirCase):
    def read_meta(self, name):
        return json.loads((self.out_dir / f"{name}.meta.json").read_text(encoding="utf-8"))

    def test_default_run_has_no_new_behavior(self):
        self.run_main(train, ["--data-dir", str(self.data_dir), "--out-dir", str(self.out_dir)])
        meta = self.read_meta("legacy")
        self.assertEqual(meta["model_version"], config.MODEL_VERSION)
        self.assertEqual(meta["options"], {"with_thinfile": False, "monotone": False})
        self.assertIsNone(meta["monotone_constraints"])
        self.assertIsNone(meta["valid_auc_thinfile"])
        self.assertEqual(meta["data"]["train_rows"], int((self.legacy[config.SPLIT_COLUMN] == "TRAIN").sum()))
        self.assertIsNone(joblib.load(self.out_dir / "legacy.joblib").get_params().get("monotone_constraints"))

    def test_thinfile_and_monotone_run_records_everything(self):
        self.run_main(train, ["--data-dir", str(self.data_dir), "--out-dir", str(self.out_dir),
                              "--with-thinfile", "--monotone", "--model-version", "TEST-MODEL-0.2"])
        for name, spec in config.MODELS.items():
            meta = self.read_meta(name)
            self.assertEqual(meta["model_version"], "TEST-MODEL-0.2")
            self.assertEqual(meta["options"], {"with_thinfile": True, "monotone": True})
            self.assertEqual(meta["monotone_constraints"], config.MONOTONE_CONSTRAINTS)
            self.assertEqual(meta["data"]["train_rows"], int((self.legacy[config.SPLIT_COLUMN] == "TRAIN").sum()) + self.exposed("TRAIN"))
            self.assertEqual(meta["data"]["train_rows_thinfile"], self.exposed("TRAIN"))
            self.assertEqual(meta["data"]["valid_rows"], int((self.legacy[config.SPLIT_COLUMN] == "VALID").sum()))   # valid_auc는 기존 집단 VALID 기준 그대로
            self.assertEqual(len(meta["valid_auc_thinfile"]["by_seed"]), len(config.SEEDS))
            self.assertIn("씬파일", meta["note"])
            expected = [config.MONOTONE_CONSTRAINTS.get(feature, 0) for feature in spec["features"]]
            self.assertEqual(joblib.load(self.out_dir / f"{name}.joblib").get_params()["monotone_constraints"], expected)


class ExportMainTests(DataDirCase):
    def export(self, *extra):
        out = Path(self.tmp.name) / "eval.csv"
        sql = Path(self.tmp.name) / "load.sql"
        self.run_main(export_eval_scores, ["--data-dir", str(self.data_dir), "--out", str(out), "--model-dir", str(self.tmp.name),
                                          "--sql-out", str(sql), *extra])
        return pd.read_csv(out), json.loads(out.with_suffix(".meta.json").read_text(encoding="utf-8")), sql.read_text(encoding="utf-8")

    def test_default_run_still_uses_thinfile_train_and_valid_rows(self):
        rows, meta, _ = self.export()
        self.assertEqual(set(rows[rows["group"] == "thinfile"]["data_split"]), {"TRAIN", "VALID"})
        self.assertEqual(meta["options"], {"with_thinfile": False, "monotone": False, "thinfile_valid_only": False})

    def test_with_thinfile_evaluates_thinfile_valid_rows_only(self):
        rows, meta, sql = self.export("--with-thinfile", "--monotone", "--model-version", "TEST-MODEL-0.2")
        thin = rows[rows["group"] == "thinfile"]
        self.assertEqual(set(thin["data_split"]), {"VALID"})                           # 학습에 쓴 씬파일 TRAIN은 평가에서 뺀다
        self.assertEqual(len(thin), self.exposed("VALID"))
        self.assertEqual(set(rows[rows["group"] == "legacy"]["data_split"]), {"VALID"})
        self.assertEqual(meta["options"], {"with_thinfile": True, "monotone": True, "thinfile_valid_only": True})
        self.assertEqual(meta["monotone_constraints"], config.MONOTONE_CONSTRAINTS)
        self.assertEqual(meta["model_version_of_shipped_models"], "TEST-MODEL-0.2")
        self.assertIn("모델 버전 TEST-MODEL-0.2", sql)
        self.assertIn("모두 VALID만", sql)
        self.assertNotIn("TEST", set(rows["data_split"]))

    def test_with_thinfile_cannot_skip_the_thinfile_table(self):
        with self.assertRaises(SystemExit):
            self.export("--with-thinfile", "--skip-thinfile")


if __name__ == "__main__":
    unittest.main()
