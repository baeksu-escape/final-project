# N-25 행 단위 평가 점수 내보내기 검사 — 작은 합성 표와 가짜 모델로 열 구성·점수 범위·TEST 제외·직군 이름 복원을 본다(학습 데이터·모델 파일 없이 돈다).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from training import config
from training.export_eval_scores import (
    EXPOSURE_COLUMN, LABEL_COLUMNS, MODEL_FEATURES, OUTPUT_COLUMNS, SCORE_COLUMNS, build_rows, count_summary, group_auc, prepare_group,
)


class FakeModel:
    """predict(X, raw_score=True)가 income 열로 만든 log-odds를 돌려주는 가짜 모델(값이 클수록 불량 쪽)."""

    def __init__(self, scale):
        self.scale = scale

    def predict(self, frame, raw_score=True):
        return frame["income_svc_12m_krw"].to_numpy(dtype=float) * self.scale


def make_group(id_offset, splits, segments, delinq, nonfin):
    frame = pd.DataFrame({column: 0.0 for column in config.ALTERNATIVE_FEATURES}, index=range(len(splits)))
    frame["customer_id"] = [f"C{id_offset + i:03d}" for i in range(len(splits))]
    frame[config.SPLIT_COLUMN] = splits
    frame["segment_name"] = segments
    frame["income_svc_12m_krw"] = np.linspace(-6, 6, len(splits))      # log-odds가 -6~6으로 퍼지게 한다
    frame[LABEL_COLUMNS["delinq"]] = delinq
    frame[LABEL_COLUMNS["nonfin"]] = nonfin
    return frame


MODELS = {key: FakeModel(scale) for key, scale in zip(SCORE_COLUMNS, (1.0, 0.8, 0.6, 0.4))}


class BuildRowsTests(unittest.TestCase):
    def setUp(self):
        self.legacy = make_group(0, ["TRAIN", "VALID", "TEST", "VALID", "VALID", "VALID"],
                                 ["wage", "wage", "selfemp", "selfemp", "freelance", "wage"],
                                 [0, 1, 1, 0, 1, 0], [0, 1, 0, 0, 1, 1])
        # 씬파일 표는 prepare_group이 TEST를 이미 버린 상태이므로 TRAIN·VALID만 들어온다
        self.thinfile = make_group(100, ["TRAIN", "VALID", "TRAIN", "VALID"],
                                   ["wage", "selfemp", "wage", "freelance"], [0, 1, 0, 0], [0, 0, 1, 1])
        self.rows = build_rows(MODELS, {"legacy": self.legacy, "thinfile": self.thinfile})

    def test_legacy_uses_only_valid_and_thinfile_uses_train_and_valid(self):
        legacy_rows = self.rows[self.rows["group"] == "legacy"]
        thinfile_rows = self.rows[self.rows["group"] == "thinfile"]
        self.assertEqual(set(legacy_rows["data_split"]), {"VALID"})                 # 모델이 학습한 TRAIN은 평가에 쓰지 않는다
        self.assertEqual(len(legacy_rows), 4)                                        # 기존 집단 VALID 4행(TEST·TRAIN 제외)
        self.assertEqual(set(thinfile_rows["data_split"]), {"TRAIN", "VALID"})       # 모델이 학습하지 않은 집단이라 TRAIN도 쓴다
        self.assertEqual(len(thinfile_rows), 4)
        self.assertNotIn("TEST", set(self.rows["data_split"]))

    def test_thinfile_valid_only_option(self):
        rows = build_rows(MODELS, {"legacy": self.legacy, "thinfile": self.thinfile},
                          {"legacy": ["VALID"], "thinfile": ["VALID"]})
        self.assertEqual(set(rows[rows["group"] == "thinfile"]["data_split"]), {"VALID"})
        self.assertEqual(int((rows["group"] == "thinfile").sum()), 2)

    def test_columns_and_order(self):
        self.assertEqual(list(self.rows.columns), OUTPUT_COLUMNS)
        self.assertEqual(list(SCORE_COLUMNS.values()),
                         ["score_legacy_delinq", "score_alt_delinq", "score_legacy_nonfin", "score_alt_nonfin"])

    def test_scores_are_integers_between_0_and_1000(self):
        for column in SCORE_COLUMNS.values():
            values = self.rows[column]
            self.assertTrue(pd.api.types.is_integer_dtype(values), column)
            self.assertTrue(values.between(0, 1000).all(), column)

    def test_higher_default_log_odds_gives_lower_score(self):
        legacy_rows = self.rows[self.rows["group"] == "legacy"]
        ordered = legacy_rows.sort_values("customer_id")["score_legacy_delinq"].tolist()
        self.assertEqual(ordered, sorted(ordered, reverse=True))      # 고객 번호가 클수록 log-odds가 커서 점수는 내려간다

    def test_segment_names_are_restored(self):
        self.assertEqual(set(self.rows["segment"]), {"wage", "selfemp", "freelance"})
        self.assertEqual(self.rows["group"].tolist(), ["legacy"] * 4 + ["thinfile"] * 4)

    def test_labels_are_copied_unchanged(self):
        legacy_rows = self.rows[self.rows["group"] == "legacy"]
        valid_source = self.legacy[self.legacy["data_split"] == "VALID"]
        self.assertEqual(legacy_rows[LABEL_COLUMNS["delinq"]].tolist(), valid_source[LABEL_COLUMNS["delinq"]].tolist())
        self.assertEqual(legacy_rows[LABEL_COLUMNS["nonfin"]].tolist(), valid_source[LABEL_COLUMNS["nonfin"]].tolist())

    def test_every_model_uses_its_own_feature_list(self):
        self.assertEqual(MODEL_FEATURES["legacy"], config.LEGACY_FEATURES)
        self.assertEqual(MODEL_FEATURES["alt"], config.ALTERNATIVE_FEATURES)


class SummaryTests(unittest.TestCase):
    def setUp(self):
        legacy = make_group(0, ["VALID"] * 6, ["wage", "wage", "selfemp", "selfemp", "freelance", "wage"],
                            [0, 1, 1, 0, 1, 0], [0, 1, 0, 0, 1, 1])
        self.rows = build_rows(MODELS, {"legacy": legacy})

    def test_count_summary(self):
        info = count_summary(self.rows)["legacy"]
        self.assertEqual(info["rows"], 6)
        self.assertEqual(info["by_split"], {"VALID": 6})
        self.assertEqual(info["by_segment"], {"freelance": 1, "selfemp": 2, "wage": 3})
        self.assertEqual(info["positives"][LABEL_COLUMNS["delinq"]], 3)
        self.assertEqual(info["positives"][LABEL_COLUMNS["nonfin"]], 3)

    def test_group_auc_uses_low_score_as_bad(self):
        aucs = group_auc(self.rows)["legacy"]
        for column in SCORE_COLUMNS.values():
            self.assertTrue(0 <= aucs[column] <= 1, column)

    def test_auc_is_none_when_label_has_one_class(self):
        legacy = make_group(0, ["VALID"] * 4, ["wage"] * 4, [0, 0, 0, 0], [0, 1, 0, 1])
        aucs = group_auc(build_rows(MODELS, {"legacy": legacy}))["legacy"]
        self.assertIsNone(aucs["score_legacy_delinq"])
        self.assertIsNotNone(aucs["score_legacy_nonfin"])


class ThinfileFilterTests(unittest.TestCase):
    """씬파일은 eval_future_credit_exposure = 1인 고객만 평가에 쓴다(정의서 5장). 0인 고객은 라벨이 항상 0이라 가짜 패턴을 만든다."""

    def write_table(self, folder, with_exposure=True):
        frame = make_group(0, ["TRAIN", "VALID", "VALID", "VALID", "TEST"], ["wage", "selfemp", "freelance", "wage", "wage"],
                           [0, 1, 0, 0, 0], [0, 0, 0, 0, 0])
        frame["segment"] = frame["segment_name"]
        if with_exposure:
            frame[EXPOSURE_COLUMN] = [1, 1, 0, 1, 1]
        path = Path(folder) / "thinfile.csv"
        frame.to_csv(path, index=False)
        return path

    def test_thinfile_keeps_only_exposed_rows_and_counts_excluded(self):
        with tempfile.TemporaryDirectory() as folder:
            prepared = prepare_group(self.write_table(folder), "thinfile")
        valid = prepared[prepared[config.SPLIT_COLUMN] == config.VALID_SPLIT]
        self.assertEqual(len(valid), 2)                               # VALID 3행 중 노출 0인 1행 제외
        self.assertEqual(prepared.attrs["excluded_rows"], {"TRAIN": 0, "VALID": 1})
        self.assertEqual(set(prepared[config.SPLIT_COLUMN]), {"TRAIN", "VALID"})   # TEST는 처음부터 없다

    def test_legacy_group_is_not_filtered(self):
        with tempfile.TemporaryDirectory() as folder:
            prepared = prepare_group(self.write_table(folder), "legacy")
        self.assertEqual(int((prepared[config.SPLIT_COLUMN] == config.VALID_SPLIT).sum()), 3)
        self.assertEqual(prepared.attrs["excluded_rows"], {"TRAIN": 0, "VALID": 0})

    def test_thinfile_without_exposure_column_stops(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(SystemExit):
                prepare_group(self.write_table(folder, with_exposure=False), "thinfile")


if __name__ == "__main__":
    unittest.main()
