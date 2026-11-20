# N-25 평가 표본 표(MODEL_EVAL_SAMPLE) 일치 검사 — DDL, 기존 DB용 생성 SQL, 적재 SQL, 내보내기 스크립트, 점검 SQL이 같은 구조·값을 쓰는지 본다(DB 접속 불필요).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import json
import re
import unittest
from pathlib import Path

import pandas as pd

from training import config
from training.export_eval_scores import LABEL_COLUMNS, LOAD_COLUMNS, SCORE_COLUMNS, SEGMENT_TO_WORKER_TYPE, render_load_sql

SQL_DIR = Path(__file__).resolve().parents[2] / "docs/spec/sql"
DB_DIR = SQL_DIR / "dummy_db"
DDL = (SQL_DIR / "avenue_ddl.sql").read_text(encoding="utf-8").replace("\r\n", "\n")
CREATE_SQL = (SQL_DIR / "create_model_eval_sample.sql").read_text(encoding="utf-8").replace("\r\n", "\n")
LOAD_SQL_FILES = {"LGBM-BASE-0.1": "load_model_eval_sample_lgbm_base_0_1.sql", "LGBM-BASE-0.2": "load_model_eval_sample_lgbm_base_0_2.sql"}
UPDATE_SQL_0_2 = (SQL_DIR / "update_model_metrics_same_label_lgbm_base_0_2.sql").read_text(encoding="utf-8").replace("\r\n", "\n")
INSERT = re.compile(r"^INSERT INTO MODEL_EVAL_SAMPLE \(([^)]*)\) VALUES \((.*)\);$", re.MULTILINE)


def ddl_block() -> str:
    """DDL에서 MODEL_EVAL_SAMPLE 설명·CREATE·COMMENT 부분."""
    start = DDL.index("-- v0.3.2 (C10) N-25 모형 성능 비교용 평가 표본.")
    end_marker = "COMMENT ON COLUMN MODEL_EVAL_SAMPLE.CREATED_AT IS"
    return DDL[start:DDL.index("\n", DDL.index(end_marker)) + 1]


def ddl_columns() -> list:
    body = DDL[DDL.index("CREATE TABLE MODEL_EVAL_SAMPLE ("):]
    body = body[:body.index("CONSTRAINT PK_MODEL_EVAL_SAMPLE")]
    return re.findall(r"^\s+([A-Z_0-9]+)\s+(?:NUMBER|VARCHAR2|TIMESTAMP)", body, flags=re.MULTILINE)


class DdlTests(unittest.TestCase):
    def test_columns_follow_export_script(self):
        # 적재용 열 11개 앞뒤에 번호(자동 증가)와 생성 시각이 있다. 점수·라벨 열 이름은 CSV 열 이름을 대문자로 한 것이다.
        self.assertEqual(ddl_columns(), ["EVAL_SAMPLE_ID", *LOAD_COLUMNS, "CREATED_AT"])
        self.assertEqual([c.upper() for c in LABEL_COLUMNS.values()], LOAD_COLUMNS[5:7])
        self.assertEqual([c.upper() for c in SCORE_COLUMNS.values()], LOAD_COLUMNS[7:])

    def test_every_column_has_a_comment(self):
        for column in ddl_columns():
            self.assertIn(f"COMMENT ON COLUMN MODEL_EVAL_SAMPLE.{column} IS", ddl_block(), column)
        self.assertIn("COMMENT ON TABLE  MODEL_EVAL_SAMPLE IS", ddl_block())

    def test_worker_type_codes_exist_in_ddl_seed(self):
        for code in SEGMENT_TO_WORKER_TYPE.values():
            self.assertIn(f"INSERT INTO DIM_WORKER_TYPE (WORKER_TYPE_CODE, WORKER_TYPE_NAME, DISPLAY_ORDER, REQUIRED_INCOME_MONTHS) VALUES ('{code}'", DDL)

    def test_table_is_created_after_its_parents(self):
        order = [DDL.index(f"CREATE TABLE {name} (") for name in ("DIM_WORKER_TYPE", "MODEL_REGISTRY", "MODEL_EVAL_SAMPLE")]
        self.assertEqual(order, sorted(order))


class SqlFilesTests(unittest.TestCase):
    def test_create_sql_has_the_same_table_definition_as_ddl(self):
        self.assertIn(ddl_block(), CREATE_SQL)

    def test_check_and_drop_sql_include_the_table(self):
        check = (DB_DIR / "99_check.sql").read_text(encoding="utf-8")
        self.assertIn("'MODEL_EVAL_SAMPLE'", check)
        self.assertIn("SELECT 'MODEL_EVAL_SAMPLE' AS TABLE_NAME, 0 AS EXPECTED", check)     # 기본 시드에는 넣지 않으므로 기대 행 수 0
        drop = (DB_DIR / "00_drop_all.sql").read_text(encoding="utf-8")
        self.assertLess(drop.index("DROP TABLE MODEL_EVAL_SAMPLE "), drop.index("DROP TABLE MODEL_ARTIFACT "))   # 자식 표를 먼저 지운다

    def test_default_seed_does_not_load_the_table(self):
        for runner in ("run_all.sql", "run_seed_only.sql"):
            self.assertNotIn("eval_sample", (DB_DIR / runner).read_text(encoding="utf-8").lower(), runner)


class LoadSqlChecks:
    """모델 버전마다 만든 적재 SQL(0.1, 0.2)이 같은 규칙을 지키는지 본다. 서브클래스가 model_version을 정한다."""
    model_version = ""

    def setUp(self):
        self.load_sql = (SQL_DIR / LOAD_SQL_FILES[self.model_version]).read_text(encoding="utf-8").replace("\r\n", "\n")
        self.rows = []
        for columns, values in INSERT.findall(self.load_sql):
            self.assertEqual([c.strip() for c in columns.split(",")], LOAD_COLUMNS)
            self.rows.append([v.strip().strip("'") for v in values.split(",")])

    def test_row_count_matches_header(self):
        header = re.search(r"행 수: (\d+), 집단/분할별: ([^\n]+)", self.load_sql)
        self.assertEqual(len(self.rows), int(header.group(1)))
        by_group = {tuple(key.split("/")): int(count) for key, count in re.findall(r"(\w+/\w+) (\d+)", header.group(2))}
        actual = {}
        for row in self.rows:
            key = (row[2].lower(), row[1])
            actual[key] = actual.get(key, 0) + 1
        self.assertEqual(actual, by_group)

    def test_codes_and_ranges(self):
        for model, split, group, ref, worker, delinq, nonfin, *scores in self.rows:
            self.assertEqual(model, self.model_version)
            self.assertIn(split, {"TRAIN", "VALID"})                  # TEST는 최종 평가(FP-144) 전에는 넣지 않는다
            self.assertIn(group, {"LEGACY", "THINFILE"})
            self.assertIn(worker, set(SEGMENT_TO_WORKER_TYPE.values()))
            self.assertIn(delinq, {"0", "1"})
            self.assertIn(nonfin, {"0", "1"})
            self.assertEqual(len(scores), 4)
            self.assertTrue(all(0 <= int(s) <= 1000 for s in scores))
            self.assertTrue(ref.startswith(("SYN", "THF")), ref)

    def test_legacy_group_only_uses_valid_rows(self):
        self.assertEqual({row[1] for row in self.rows if row[2] == "LEGACY"}, {"VALID"})

    def test_keys_are_unique(self):
        keys = [(row[0], row[1], row[2], row[3]) for row in self.rows]
        self.assertEqual(len(keys), len(set(keys)))                  # UK_MES_SAMPLE

    def test_header_names_the_model_version_and_checks_it_before_inserting(self):
        self.assertIn(f"모델 버전 {self.model_version},", self.load_sql)
        self.assertIn(f"WHERE MODEL_VERSION = '{self.model_version}'", self.load_sql)
        self.assertLess(self.load_sql.index("RAISE_APPLICATION_ERROR(-20115"), self.load_sql.index("INSERT INTO MODEL_EVAL_SAMPLE"))


class LoadSql01Tests(LoadSqlChecks, unittest.TestCase):
    model_version = "LGBM-BASE-0.1"


class LoadSql02Tests(LoadSqlChecks, unittest.TestCase):
    model_version = "LGBM-BASE-0.2"

    def test_has_the_same_composition_as_version_0_1(self):
        # 0.2도 씬파일을 학습하지 않아서 0.1과 같은 구성(기존 VALID 1,800, 씬파일 TRAIN 1,057 + VALID 228)이다.
        header = re.search(r"행 수: (\d+), 집단/분할별: ([^\n]+)", self.load_sql)
        self.assertEqual(int(header.group(1)), 3085)
        counts = dict(re.findall(r"(\w+/\w+) (\d+)", header.group(2)))
        self.assertEqual(counts, {"legacy/VALID": "1800", "thinfile/VALID": "228", "thinfile/TRAIN": "1057"})


class UpdateSql02Tests(unittest.TestCase):
    """모델 0.2의 같은 라벨 AUC 갱신 SQL — JSON_MERGEPATCH로 same_label_comparison만 더하고, AUC 열과 기존 JSON 항목은 건드리지 않는다."""

    def patches(self):
        return [json.loads(text) for text in re.findall(r"q'\[(.*?)\]'", UPDATE_SQL_0_2, flags=re.DOTALL)]

    def test_two_rows_get_the_same_valid_json(self):
        patches = self.patches()
        self.assertEqual(len(patches), 2)
        self.assertEqual(patches[0], patches[1])
        self.assertIn("add_comparison('trad_legacy'", UPDATE_SQL_0_2)
        self.assertIn("add_comparison('alt_legacy'", UPDATE_SQL_0_2)
        self.assertEqual(list(patches[0]), ["same_label_comparison"])                 # 이 키만 더한다

    def test_values_are_consistent(self):
        comparison = self.patches()[0]["same_label_comparison"]
        self.assertEqual(comparison["seeds"], config.SEEDS)
        self.assertEqual(comparison["model_options"], {"monotone": True, "with_thinfile": False})
        for label in ("label_any_delinquency_12m", "label_nonfin_effect_12m"):
            entry = comparison["by_label"][label]
            for model in ("legacy", "alternative"):
                self.assertEqual(len(entry[model]["by_seed"]), len(config.SEEDS))
                self.assertAlmostEqual(entry[model]["mean"], sum(entry[model]["by_seed"]) / len(config.SEEDS), places=3)
            self.assertAlmostEqual(entry["diff_alt_minus_legacy_mean"], entry["alternative"]["mean"] - entry["legacy"]["mean"], places=4)

    def test_merges_instead_of_replacing_and_keeps_auc_columns(self):
        self.assertIn("JSON_MERGEPATCH(NVL(METRICS_JSON, '{}'), p_patch RETURNING CLOB)", UPDATE_SQL_0_2)
        self.assertIn("MODEL_VERSION = 'LGBM-BASE-0.2'", UPDATE_SQL_0_2)
        self.assertNotIn("SET AUC", UPDATE_SQL_0_2)                                    # AUC_VALID·AUC_TEST는 바꾸지 않는다
        self.assertIn("RAISE_APPLICATION_ERROR(-20112", UPDATE_SQL_0_2)                # 등록 행이 없으면 멈춘다

    def test_rolls_back_everything_on_error(self):
        self.assertIn("WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK\n", UPDATE_SQL_0_2)
        self.assertIn("WHENEVER OSERROR EXIT FAILURE ROLLBACK\n", UPDATE_SQL_0_2)

    def test_longest_line_fits_sqlplus_limit(self):
        self.assertLess(max(len(line) for line in UPDATE_SQL_0_2.splitlines()), 2499)


class RenderTests(unittest.TestCase):
    def make_rows(self, count):
        segments = (["wage", "selfemp", "freelance"] * (count // 3 + 1))[:count]
        frame = pd.DataFrame({"customer_id": [f"SYN{i:09d}" for i in range(count)], "group": ["legacy"] * count, "segment": segments})
        frame["data_split"] = "VALID"
        for label in LABEL_COLUMNS.values():
            frame[label] = 0
        for column in SCORE_COLUMNS.values():
            frame[column] = 700
        return frame

    def test_maps_codes_and_commits_every_500_rows(self):
        sql = render_load_sql(self.make_rows(501), "TEST-MODEL-0.1", "a" * 64)
        self.assertEqual(sql.count("INSERT INTO MODEL_EVAL_SAMPLE"), 501)
        self.assertEqual(sql.count("\nCOMMIT;\n"), 2)                 # 500행째와 마지막
        self.assertIn("'LEGACY'", sql)
        self.assertIn("'EMPLOYEE'", sql)
        self.assertIn("'SELF_EMPLOYED'", sql)
        self.assertIn("'FREELANCER'", sql)
        self.assertIn("행 수: 501, 집단/분할별: legacy/VALID 501", sql)

    def test_stops_when_rows_already_exist(self):
        sql = render_load_sql(self.make_rows(3), config.MODEL_VERSION, "b" * 64)
        self.assertIn("SELECT COUNT(*) INTO v_cnt FROM MODEL_EVAL_SAMPLE WHERE MODEL_VERSION", sql)
        self.assertIn("RAISE_APPLICATION_ERROR(-20115", sql)
        self.assertLess(sql.index("RAISE_APPLICATION_ERROR(-20115"), sql.index("INSERT INTO MODEL_EVAL_SAMPLE"))


if __name__ == "__main__":
    unittest.main()
