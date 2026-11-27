# FP-285 모델 0.3 등록·전환 SQL 검사 — 적재하는 해시·AUC가 정의서 C37·C39의 결과 파일과 같은지, 전환·되돌리기가 사전 확인 뒤에만 바꾸는지 본다(DB 접속·모델 파일 불필요).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import json
import re
import unittest
from pathlib import Path

from training import config

SPEC_DIR = Path(__file__).resolve().parents[2] / "docs/spec"
SQL_DIR = SPEC_DIR / "sql"
VALID = json.loads((SPEC_DIR / "model_v03_valid_check_c36.json").read_text(encoding="utf-8"))
TEST = json.loads((SPEC_DIR / "final_test_eval_result_v03.json").read_text(encoding="utf-8"))
LABELS = {"legacy": "label_any_delinquency_12m", "alternative": "label_nonfin_effect_12m"}
TEST_KEYS = {"legacy": "legacy_delinq", "alternative": "alt_nonfin"}


def read(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8").replace("\r\n", "\n")


REGISTER = read("register_model_lgbm_base_0_3.sql")
METRICS = read("update_model_metrics_same_label_lgbm_base_0_3.sql")
ACTIVATE = read("activate_model_lgbm_base_0_3.sql")
ROLLBACK = read("rollback_model_lgbm_base_0_3_to_0_2.sql")


def json_blocks(sql: str) -> list:
    return [json.loads(text) for text in re.findall(r"q'\[(.*?)\]'", sql, flags=re.DOTALL)]


def squeeze(sql: str) -> str:
    return re.sub(r"\s+", " ", "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--")))


class RegisterSqlTests(unittest.TestCase):
    def test_artifact_hashes_and_auc_match_the_recorded_results(self):
        found = re.findall(r"add_artifact\('(\w+)',\s*'[^']+ / (\w+)\.joblib',\s*'([0-9a-f]{64})',\s*([\d.]+), ([\d.]+),", REGISTER)
        self.assertEqual([(name, model) for name, model, *_ in found], [("trad_legacy", "legacy"), ("alt_legacy", "alternative")])
        for _, model, sha, auc_valid, auc_test in found:
            self.assertEqual(sha, TEST["model_files_sha256"][f"{model}.joblib"], model)
            self.assertEqual(float(auc_valid), VALID["measured"]["auc"][model][LABELS[model]]["by_seed"][0], model)   # 서버에 올리는 시드 11
            self.assertEqual(float(auc_test), TEST["legacy_group"]["shipped_auc"][TEST_KEYS[model]]["auc"], model)

    def test_metrics_json_matches_the_recorded_results(self):
        blocks = json_blocks(REGISTER)
        self.assertEqual([b["model"] for b in blocks], ["legacy", "alternative"])
        for block in blocks:
            model = block["model"]
            self.assertEqual(block["meta_sha256"], TEST["model_files_sha256"][f"{model}.meta.json"])
            self.assertEqual(block["valid_auc_by_seed"], VALID["measured"]["auc"][model][LABELS[model]]["by_seed"])
            self.assertEqual(block["test_auc_by_seed"], TEST["legacy_group"]["five_seed_auc"][TEST_KEYS[model]]["by_seed"])
            self.assertEqual(block["monotone_constraints"], config.MONOTONE_CONSTRAINTS_V03)
            self.assertEqual((block["train_rows"], block["valid_rows"], block["test_rows"]), (97543, 20903, 20901))

    def test_new_dataset_row_points_to_the_v3_7_0_table(self):
        table_sha = VALID["data"]["table_sha256"]
        self.assertIn(f"c_table_sha    CONSTANT DATASET_VERSION.FILE_SHA256%TYPE  := '{table_sha}';", REGISTER)
        self.assertIn("c_version_no   CONSTANT DATASET_VERSION.VERSION_NO%TYPE   := 2;", REGISTER)
        self.assertIn("139347, 252,", REGISTER)

    def test_registers_as_candidate_and_does_not_activate(self):
        text = squeeze(REGISTER)
        self.assertIn("'FS-V1', 'CANDIDATE'", text)
        self.assertNotIn("'ACTIVE'", text)
        self.assertNotIn("UPDATE ", text)
        self.assertNotIn("DELETE ", text)

    def test_lines_fit_sqlplus_limit(self):
        for sql in (REGISTER, METRICS):
            self.assertLess(max(len(line.encode("utf-8")) for line in sql.splitlines()), 2499)


class MetricsSqlTests(unittest.TestCase):
    def test_same_label_values_match_the_valid_check(self):
        blocks = json_blocks(METRICS)
        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0], blocks[1])
        comparison = blocks[0]["same_label_comparison"]
        self.assertEqual((comparison["basis"], comparison["seeds"]), ("VALID", config.SEEDS))
        for label, entry in comparison["by_label"].items():
            for model in ("legacy", "alternative"):
                self.assertEqual(entry[model], VALID["measured"]["auc"][model][label], f"{model} {label}")
            self.assertAlmostEqual(entry["diff_alt_minus_legacy_mean"], entry["alternative"]["mean"] - entry["legacy"]["mean"], places=4)

    def test_merges_only_this_version_and_keeps_auc_columns(self):
        self.assertIn("JSON_MERGEPATCH(NVL(METRICS_JSON, '{}'), p_patch RETURNING CLOB)", METRICS)
        self.assertIn("MODEL_VERSION = 'LGBM-BASE-0.3' AND ARTIFACT_NAME = p_name", METRICS)
        self.assertNotIn("SET AUC", METRICS)
        self.assertIn("RAISE_APPLICATION_ERROR(-20184", METRICS)


class ActivateSqlTests(unittest.TestCase):
    def test_all_prechecks_come_before_the_status_change(self):
        text = squeeze(ACTIVATE)
        for code in ("-20185", "-20186", "-20187", "-20188"):
            self.assertLess(text.index(f"RAISE_APPLICATION_ERROR({code}"), text.index("UPDATE MODEL_REGISTRY"), code)
        self.assertIn("WHERE CUTOFF_VERSION = 'CUT-0.4'", text)     # FastAPI 0.3이 저장할 등급 구간이 먼저 있어야 한다
        retire = text.index("SET STATUS_CODE = 'RETIRED' WHERE STATUS_CODE = 'ACTIVE'")
        activate = text.index("SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE MODEL_VERSION = 'LGBM-BASE-0.3'")
        self.assertLess(retire, activate)

    def test_rollback_restores_0_2(self):
        text = squeeze(ROLLBACK)
        self.assertLess(text.index("RAISE_APPLICATION_ERROR(-20189"), text.index("UPDATE MODEL_REGISTRY"))
        self.assertIn("SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE MODEL_VERSION = 'LGBM-BASE-0.2'", text)
        for sql in (ACTIVATE, ROLLBACK):
            self.assertIn("WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK", sql)


if __name__ == "__main__":
    unittest.main()
