# N-25 평가 표본 표(MODEL_EVAL_SAMPLE) 일치 검사 — DDL, 기존 DB용 생성 SQL, 적재 SQL, 내보내기 스크립트, 점검 SQL이 같은 구조·값을 쓰는지 본다(DB 접속 불필요).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
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
LOAD_SQL = (SQL_DIR / "load_model_eval_sample_lgbm_base_0_1.sql").read_text(encoding="utf-8").replace("\r\n", "\n")
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


class LoadSqlTests(unittest.TestCase):
    def setUp(self):
        self.rows = []
        for columns, values in INSERT.findall(LOAD_SQL):
            self.assertEqual([c.strip() for c in columns.split(",")], LOAD_COLUMNS)
            self.rows.append([v.strip().strip("'") for v in values.split(",")])

    def test_row_count_matches_header(self):
        header = re.search(r"행 수: (\d+), 집단/분할별: ([^\n]+)", LOAD_SQL)
        self.assertEqual(len(self.rows), int(header.group(1)))
        by_group = {tuple(key.split("/")): int(count) for key, count in re.findall(r"(\w+/\w+) (\d+)", header.group(2))}
        actual = {}
        for row in self.rows:
            key = (row[2].lower(), row[1])
            actual[key] = actual.get(key, 0) + 1
        self.assertEqual(actual, by_group)

    def test_codes_and_ranges(self):
        for model, split, group, ref, worker, delinq, nonfin, *scores in self.rows:
            self.assertEqual(model, config.MODEL_VERSION)
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
