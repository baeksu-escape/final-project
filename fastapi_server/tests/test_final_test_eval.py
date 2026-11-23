# FP-144 TEST 평가 스크립트(training/final_test_eval.py) 검사 — 실제 TEST 데이터는 읽지 않고 가짜 소형 표로 계산·안전장치·C26 기준 값을 확인한다.
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import contextlib
import hashlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import pandas as pd

from training import config
from training import final_test_eval as fte

DEFINITION = (Path(__file__).resolve().parents[2] / "docs/spec/feature_definition.md").read_text(encoding="utf-8")
C26_ROW = next(line for line in DEFINITION.splitlines() if line.startswith("| C26 |"))
SEGMENTS = ["wage", "selfemp", "freelance"]
COHORTS = ["no_credit", "short_history", "young_established"]


def make_frame(rows: int, seed: int) -> pd.DataFrame:
    """평가 함수에 넣을 가짜 표(전처리된 형태): 숫자 피처는 난수, 범주 5개는 부호, 라벨 2개는 양쪽 클래스가 모두 있게."""
    rng = np.random.default_rng(seed)
    data = {name: rng.normal(size=rows) for name in config.ALTERNATIVE_FEATURES}
    for name in config.CATEGORICAL_FEATURES:
        data[name] = rng.integers(0, 3, size=rows).astype("int32")
    frame = pd.DataFrame(data)
    for column in fte.LABEL_COLUMNS.values():
        frame[column] = rng.integers(0, 2, size=rows)
    frame["segment_name"] = rng.choice(SEGMENTS, size=rows)
    frame["cohort"] = rng.choice(COHORTS, size=rows)
    return frame


def make_raw_table(rows_per_split: int = 6) -> pd.DataFrame:
    """읽기 함수 검사용 가짜 원본 표: TRAIN·VALID·TEST 행과 씬파일 노출 0·1 행이 섞여 있다."""
    rng = np.random.default_rng(0)
    parts = []
    for split in ("TRAIN", "VALID", "TEST"):
        frame = pd.DataFrame({name: rng.normal(size=rows_per_split) for name in config.ALTERNATIVE_FEATURES})
        for name, values in config.CATEGORY_CODES.items():
            if name in frame.columns:
                frame[name] = values[0]
        frame["segment"] = "wage"
        frame["income_svc_12m_krw"] = 30_000_000.0
        frame["expense_avg_month_krw"] = 1_000_000.0
        frame["debt_service_current_krw"] = 100_000.0
        for column in fte.LABEL_COLUMNS.values():
            frame[column] = 0
        frame[config.SPLIT_COLUMN] = split
        frame[config.EXPOSURE_COLUMN] = [1, 0] * (rows_per_split // 2)
        frame["cohort"] = "no_credit"
        parts.append(frame)
    return pd.concat(parts, ignore_index=True)


class CriteriaMatchDefinitionTests(unittest.TestCase):
    def test_ranges_match_c26_text(self):
        # 코드의 정상 범위·기준 AUC가 정의서 C26 본문과 글자 그대로 같다(결과를 본 뒤 몰래 바꾸지 못하게)
        for pair, (reference, low, high) in fte.C26_CRITERIA.items():
            with self.subTest(pair=pair):
                self.assertIn(f"{reference:.4f}이면 {low:.3f} 부터 {high:.3f}", C26_ROW)

    def test_diff_limit_matches_c26_text(self):
        self.assertEqual(fte.DELINQ_DIFF_LIMIT, 0.04)
        self.assertIn("-0.04에서 +0.04", C26_ROW)

    def test_expected_model_version_is_0_2(self):
        self.assertEqual(fte.EXPECTED_MODEL_VERSION, "LGBM-BASE-0.2")
        self.assertIn("LGBM-BASE-0.2", C26_ROW)


class JudgeTests(unittest.TestCase):
    def test_range_boundaries(self):
        pair = ("legacy", "delinq")                    # 0.555~0.655
        self.assertEqual(fte.judge_range(pair, 0.555), "범위 안")
        self.assertEqual(fte.judge_range(pair, 0.655), "범위 안")
        self.assertEqual(fte.judge_range(pair, 0.5549), "범위 밖(낮음)")
        self.assertEqual(fte.judge_range(pair, 0.6551), "범위 밖(높음)")

    def test_auc_at_or_below_half_and_none(self):
        self.assertEqual(fte.judge_range(("legacy", "delinq"), 0.5), "0.5 이하(우연 수준 이하)")
        self.assertIn("한 클래스", fte.judge_range(("legacy", "delinq"), None))

    def test_delinq_diff(self):
        self.assertEqual(fte.judge_diff("delinq", 0.0031), "차이 없음(±0.04 안)")
        self.assertEqual(fte.judge_diff("delinq", -0.04), "차이 없음(±0.04 안)")
        self.assertEqual(fte.judge_diff("delinq", 0.041), "대안 높음(+0.04 초과)")
        self.assertEqual(fte.judge_diff("delinq", -0.041), "대안 낮음(-0.04 미만)")

    def test_nonfin_diff_sign(self):
        self.assertEqual(fte.judge_diff("nonfin", 0.0511), "설계한 효과 재현(+방향)")
        self.assertEqual(fte.judge_diff("nonfin", -0.01), "설계한 효과 미재현(0 이하)")
        self.assertEqual(fte.judge_diff("nonfin", 0.0), "설계한 효과 미재현(0 이하)")


class MetricTests(unittest.TestCase):
    def test_auc_info_one_class_is_none(self):
        info = fte.auc_info(pd.Series([0, 0, 0]), pd.Series([0.1, 0.2, 0.3]))
        self.assertEqual(info, {"rows": 3, "positives": 0, "auc": None})

    def test_auc_info_perfect(self):
        info = fte.auc_info(pd.Series([0, 0, 1, 1]), pd.Series([0.1, 0.2, 0.8, 0.9]))
        self.assertEqual((info["rows"], info["positives"], info["auc"]), (4, 2, 1.0))

    def test_grade_ratio_uses_cut_0_3_boundaries(self):
        ratio = fte.grade_ratio([0, 653, 654, 726, 727, 1000])
        for code in ("CAUTION", "STANDARD", "GOOD"):
            self.assertEqual(ratio[code]["count"], 2)
        self.assertAlmostEqual(ratio["GOOD"]["ratio"], 0.3333, places=4)

    def test_auc_by_group_keeps_positive_counts(self):
        frame = pd.DataFrame({"g": ["a", "a", "b", "b"], "y": [0, 1, 0, 0]})
        result = fte.auc_by_group(frame, pd.Series([0.1, 0.9, 0.2, 0.3]), "y", "g")
        self.assertEqual(result["a"]["positives"], 1)
        self.assertEqual(result["a"]["auc"], 1.0)
        self.assertIsNone(result["b"]["auc"])


class TestGuardTests(unittest.TestCase):
    def test_test_split_not_read_without_confirm(self):
        # 없는 파일 경로를 줘도 PermissionError가 먼저 나온다 = 파일을 열기 전에 막는다
        with self.assertRaises(PermissionError):
            fte.load_eval_split(Path("없는파일.csv"), "TEST", "legacy")

    def test_main_test_without_confirm_reads_nothing(self):
        argv = ["final_test_eval", "--split", "TEST", "--data-dir", "없는폴더", "--model-dir", "없는폴더"]
        output = io.StringIO()
        with mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(output):
            fte.main()                                  # 표·모델이 없어도 오류 없이 끝난다 = 아무것도 읽지 않았다
        self.assertIn("읽지 않고 끝낸다", output.getvalue())

    def test_load_eval_split_keeps_only_requested_split_and_exposure(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "table.csv"
            make_raw_table().to_csv(path, index=False)
            valid = fte.load_eval_split(path, "VALID", "legacy")
            thin_valid = fte.load_eval_split(path, "VALID", "thinfile")
            test = fte.load_eval_split(path, "TEST", "thinfile", confirmed_test=True)
        self.assertEqual(set(valid[config.SPLIT_COLUMN]), {"VALID"})
        self.assertEqual(len(valid), 6)
        self.assertEqual(set(thin_valid[config.EXPOSURE_COLUMN]), {1})
        self.assertEqual(len(thin_valid), 3)
        self.assertEqual(set(test[config.SPLIT_COLUMN]), {"TEST"})
        self.assertEqual(list(thin_valid["segment_name"].unique()), ["wage"])
        self.assertEqual(list(thin_valid["cohort"].unique()), ["no_credit"])

    def test_load_eval_split_reports_missing_columns(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "table.csv"
            make_raw_table().drop(columns=["segment"]).to_csv(path, index=False)
            with self.assertRaises(SystemExit):
                fte.load_eval_split(path, "VALID", "legacy")

    def test_check_not_done(self):
        with tempfile.TemporaryDirectory() as folder:
            record, result = Path(folder) / "run.json", Path(folder) / "result.json"
            self.assertIsNone(fte.check_not_done(record, result, None))
            result.write_text("{}", encoding="utf-8")
            with self.assertRaises(SystemExit):
                fte.check_not_done(record, result, None)
            self.assertEqual(fte.check_not_done(record, result, "평가 코드 오류 수정"), hashlib.sha256(b"{}").hexdigest())

    def test_run_record_alone_blocks_rerun_without_reason(self):
        # 결과 파일이 없어도(읽는 도중 중단) 실행 기록만 있으면 사유 없이는 다시 실행되지 않는다
        with tempfile.TemporaryDirectory() as folder:
            record, result = Path(folder) / "run.json", Path(folder) / "result.json"
            record.write_text('{"runs": []}', encoding="utf-8")
            with self.assertRaises(SystemExit):
                fte.check_not_done(record, result, None)
            self.assertIsNone(fte.check_not_done(record, result, "읽는 도중 중단돼 같은 코드로 재실행"))

    def test_changing_out_dir_cannot_bypass_run_record(self):
        # --out-dir을 다른 폴더로 줘도 고정 경로의 실행 기록을 검사한다(TEST 행을 읽기 전에 멈춘다)
        with tempfile.TemporaryDirectory() as folder:
            record = Path(folder) / "run.json"
            record.write_text('{"runs": []}', encoding="utf-8")
            argv = ["final_test_eval", "--split", "TEST", "--confirm-test-once", "--out-dir", str(Path(folder) / "다른폴더"),
                    "--data-dir", "없는폴더", "--model-dir", "없는폴더"]
            with mock.patch.object(fte, "RUN_RECORD_PATH", record), mock.patch.object(fte, "DEFAULT_RESULT_DIR", Path(folder)), \
                    mock.patch.object(sys, "argv", argv), self.assertRaises(SystemExit) as caught:
                fte.main()
            self.assertIn("이미 시작했거나", str(caught.exception))


class VerifyShippedTests(unittest.TestCase):
    def build_dir(self, folder: Path, version: str = "LGBM-BASE-0.2", wrong_hash: bool = False, wrong_registry: bool = False) -> Path:
        """가짜 모델 폴더(SHA256SUMS.txt 포함)와 같은 해시를 적은 가짜 공용 0.2 등록 SQL을 만들고 등록 SQL 경로를 돌려준다."""
        lines, digests = [], {}
        for name in fte.SHIPPED_FILES:
            body = json.dumps({"model_version": version}).encode() if name.endswith(".meta.json") else name.encode()
            (folder / name).write_bytes(body)
            digests[name] = hashlib.sha256(body).hexdigest()
            lines.append(f"{'0' * 64 if wrong_hash and name == 'legacy.joblib' else digests[name]} *{name}")
        (folder / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        registered = dict(digests)
        if wrong_registry:
            registered["alternative.joblib"] = "f" * 64
        sql = "".join(
            f"add_artifact('{key}',\n 'avenue_model_files.zip / {model}.joblib',\n '{registered[model + '.joblib']}',\n 0.6,\n"
            f" q'[{{\"model\":\"{model}\",\"meta_sha256\":\"{registered[model + '.meta.json']}\",\"label\":\"x\"}}]');\n"
            for key, model in (("trad_legacy", "legacy"), ("alt_legacy", "alternative")))
        registry = folder / "register.sql"
        registry.write_text(sql, encoding="utf-8")
        return registry

    def test_matching_files_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            registry = self.build_dir(Path(folder))
            hashes = fte.verify_shipped(Path(folder), registry)
        self.assertEqual(set(hashes), set(fte.SHIPPED_FILES))

    def test_hash_mismatch_stops(self):
        with tempfile.TemporaryDirectory() as folder:
            registry = self.build_dir(Path(folder), wrong_hash=True)
            with self.assertRaises(SystemExit):
                fte.verify_shipped(Path(folder), registry)

    def test_wrong_model_version_stops(self):
        with tempfile.TemporaryDirectory() as folder:
            registry = self.build_dir(Path(folder), version="LGBM-BASE-0.1")
            with self.assertRaises(SystemExit):
                fte.verify_shipped(Path(folder), registry)

    def test_hash_different_from_registered_0_2_stops(self):
        # 로컬 SHA256SUMS.txt와는 맞아도 공용 DB에 등록한 0.2 해시와 다르면 TEST를 열기 전에 멈춘다
        with tempfile.TemporaryDirectory() as folder:
            registry = self.build_dir(Path(folder), wrong_registry=True)
            with self.assertRaises(SystemExit) as caught:
                fte.verify_shipped(Path(folder), registry)
        self.assertIn("공용 DB에 등록한 모델 0.2", str(caught.exception))

    def test_missing_registry_stops(self):
        with tempfile.TemporaryDirectory() as folder:
            self.build_dir(Path(folder))
            with self.assertRaises(SystemExit):
                fte.verify_shipped(Path(folder), Path(folder) / "없는파일.sql")

    def test_real_register_sql_has_four_hashes(self):
        hashes = fte.registered_hashes(fte.REGISTER_SQL_PATH)
        self.assertEqual(set(hashes), set(fte.SHIPPED_FILES))
        for digest in hashes.values():
            self.assertRegex(digest, r"^[0-9a-f]{64}$")


class RunRecordTests(unittest.TestCase):
    def test_start_and_finish_accumulate_without_overwriting(self):
        with tempfile.TemporaryDirectory() as folder:
            record = Path(folder) / "run.json"
            fte.start_run_record(record, {"started_at": "t1", "rerun_reason": None})
            fte.finish_run_record(record, "failed", error="중단")
            fte.start_run_record(record, {"started_at": "t2", "rerun_reason": "읽는 도중 중단"})
            fte.finish_run_record(record, "finished", result_json_sha256="abc")
            runs = json.loads(record.read_text(encoding="utf-8"))["runs"]
            self.assertEqual([run["status"] for run in runs], ["failed", "finished"])
            self.assertEqual(runs[1]["rerun_reason"], "읽는 도중 중단")
            self.assertEqual(list(Path(folder).glob("*.tmp")), [])

    def fake_run(self, folder: Path, evaluate) -> Path:
        """main()을 TEST로 돌리되 표·모델·평가를 가짜로 바꿔 실행 기록 흐름만 본다(실제 TEST는 읽지 않는다)."""
        data_dir = folder / "data"
        for relative in (fte.config.TABLE_RELATIVE_PATH, fte.config.THINFILE_TABLE_RELATIVE_PATH):
            (data_dir / relative).parent.mkdir(parents=True, exist_ok=True)
            (data_dir / relative).write_text("x\n", encoding="utf-8")
        record = folder / "run.json"
        argv = ["final_test_eval", "--split", "TEST", "--confirm-test-once", "--data-dir", str(data_dir), "--model-dir", str(folder), "--out-dir", str(folder / "out")]
        clean = {"commit": "abc", "working_tree_clean": True, "untracked_files_count": 0, "untracked_files": []}
        patches = [mock.patch.object(fte, "RUN_RECORD_PATH", record), mock.patch.object(fte, "DEFAULT_RESULT_DIR", folder),
                   mock.patch.object(sys, "argv", argv), mock.patch.object(fte, "git_state", return_value=clean),
                   mock.patch.object(fte, "verify_shipped", return_value={name: "0" * 64 for name in fte.SHIPPED_FILES}),
                   mock.patch.object(fte.joblib, "load", return_value=object()), mock.patch.object(fte, "load_training_sets", return_value=(pd.DataFrame(), pd.DataFrame(), None, {})),
                   mock.patch.object(fte, "train_models", return_value={}),
                   mock.patch.object(fte, "reproduction_check", return_value={"legacy_delinq": "같음", "alt_nonfin": "같음"}),
                   mock.patch.object(fte, "evaluate_and_render", side_effect=evaluate)]
        with contextlib.ExitStack() as stack:
            for patch in patches:
                stack.enter_context(patch)
            fte.main()
        return record

    def test_record_is_written_before_test_rows_are_evaluated_and_marked_failed(self):
        with tempfile.TemporaryDirectory() as folder:
            record = Path(folder) / "run.json"
            seen = {}

            def evaluate(*args, **kwargs):
                # TEST 행을 읽는 단계(evaluate_and_render)에 들어간 시점에 실행 기록이 이미 started로 있어야 한다
                seen["status"] = json.loads(record.read_text(encoding="utf-8"))["runs"][-1]["status"]
                raise RuntimeError("읽는 도중 중단")

            with self.assertRaises(RuntimeError), contextlib.redirect_stdout(io.StringIO()):
                self.fake_run(Path(folder), evaluate)
            self.assertEqual(seen["status"], "started")
            self.assertEqual(json.loads(record.read_text(encoding="utf-8"))["runs"][-1]["status"], "failed")
            self.assertFalse((Path(folder) / "out" / "final_test_eval_result.json").exists())     # 결과 파일은 없어도 기록은 남는다

    def test_rerun_after_failure_needs_reason(self):
        with tempfile.TemporaryDirectory() as folder:
            def boom(*args, **kwargs):
                raise RuntimeError("중단")

            with self.assertRaises(RuntimeError), contextlib.redirect_stdout(io.StringIO()):
                self.fake_run(Path(folder), boom)
            with self.assertRaises(SystemExit), contextlib.redirect_stdout(io.StringIO()):
                self.fake_run(Path(folder), boom)                                      # 사유 없이 다시 실행하면 TEST를 읽기 전에 거부


class GitStateTests(unittest.TestCase):
    def git(self, folder: Path, *args) -> None:
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@example.com", *args], cwd=folder, check=True, capture_output=True)

    def make_repo(self, folder: Path) -> None:
        self.git(folder, "init", "-q")
        (folder / "docs/spec").mkdir(parents=True)
        (folder / "tracked.txt").write_text("a", encoding="utf-8")
        (folder / "docs/spec/final_test_eval_run.json").write_text("{}", encoding="utf-8")
        self.git(folder, "add", ".")
        self.git(folder, "commit", "-q", "-m", "init")

    def test_untracked_files_do_not_block_but_are_recorded(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(fte, "REPO_ROOT", Path(folder)):
            self.make_repo(Path(folder))
            (Path(folder) / "artifacts_README.txt").write_text("메모", encoding="utf-8")
            state = fte.git_state()
        self.assertTrue(state["working_tree_clean"])
        self.assertEqual(state["untracked_files"], ["artifacts_README.txt"])

    def test_modified_tracked_file_blocks(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(fte, "REPO_ROOT", Path(folder)):
            self.make_repo(Path(folder))
            (Path(folder) / "tracked.txt").write_text("바뀜", encoding="utf-8")
            self.assertFalse(fte.git_state()["working_tree_clean"])

    def test_run_record_change_does_not_block(self):
        # 첫 실행이 실행 기록을 고쳐 놓아도 재실행 검사가 막히지 않는다
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(fte, "REPO_ROOT", Path(folder)):
            self.make_repo(Path(folder))
            (Path(folder) / "docs/spec/final_test_eval_run.json").write_text('{"runs": []}', encoding="utf-8")
            self.assertTrue(fte.git_state()["working_tree_clean"])


class EvaluationSmokeTests(unittest.TestCase):
    """난수 표로 평가·보고서 생성이 끝까지 도는지 본다(숫자 자체는 의미 없다). 모델은 작은 표로 시드 5개씩 학습한다."""

    @classmethod
    def setUpClass(cls):
        cls.train = make_frame(400, 1)
        cls.legacy = make_frame(300, 2)
        cls.thin = make_frame(200, 3)
        cls.models = fte.train_models(cls.train)
        cls.shipped = {pair: cls.models[(*pair, fte.SHIPPED_SEED)] for pair in fte.SHIPPED}

    def test_legacy_group_report_structure(self):
        report = fte.legacy_group_report(self.legacy, self.models, self.shipped)
        self.assertEqual(report["rows"], 300)
        self.assertEqual(set(report["five_seed_auc"]), {fte.pair_key(pair) for pair in fte.PAIRS})
        self.assertEqual(set(report["same_label_diff"]), {"delinq", "nonfin"})
        self.assertEqual(set(report["shipped_auc"]), {"legacy_delinq", "alt_nonfin"})
        self.assertEqual(set(report["by_segment"]["legacy_delinq"]), set(SEGMENTS))
        self.assertAlmostEqual(sum(item["ratio"] for item in report["grade_ratio"]["legacy"].values()), 1.0, places=3)

    def test_thinfile_report_is_reference_only(self):
        # C26 정상 범위는 기존 집단 기준이라 씬파일에는 판정을 붙이지 않고 값만 남긴다
        report = fte.thinfile_report(self.thin, self.models, self.shipped)
        self.assertEqual(report["judgement"], {})
        self.assertIn("참고", report["same_label_diff"]["delinq"]["verdict"])
        self.assertEqual(set(report["by_cohort"]["legacy_delinq"]), set(COHORTS))

    def test_reproduction_check_same_when_same_models(self):
        result = fte.reproduction_check(self.models, self.shipped, self.legacy)
        self.assertEqual(result, {"legacy_delinq": "같음", "alt_nonfin": "같음"})

    def test_render_markdown_has_notice_and_positive_counts(self):
        result = {"split": "VALID", "model_version": fte.EXPECTED_MODEL_VERSION,
                  "generated_at": "2026-11-23T00:00:00+00:00", "provenance": {"commit": "abc", "working_tree_clean": True},
                  "legacy_group": fte.legacy_group_report(self.legacy, self.models, self.shipped),
                  "thinfile": fte.thinfile_report(self.thin, self.models, self.shipped),
                  "reproduction_on_valid": {"legacy_delinq": "같음", "alt_nonfin": "같음"}}
        text = fte.render_markdown(result)
        self.assertIn(fte.SYNTHETIC_NOTICE, text)
        self.assertIn("young_established", text)
        self.assertIn("양성", text)
        self.assertIn("CUT-0.3", text)


if __name__ == "__main__":
    unittest.main()
