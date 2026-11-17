# FS-V1 피처 세트·모델 버전 일치 검사 — 정의서 11장, DB 시드·기준 데이터, 학습 코드가 같은 값을 쓰는지 확인한다(DB 접속 불필요).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import json
import re
import unittest
from pathlib import Path

from training import config

REPO_ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = REPO_ROOT / "docs/spec/sql"
DB_DIR = SQL_DIR / "dummy_db"
DDL = SQL_DIR / "avenue_ddl.sql"
SEED_V1 = SQL_DIR / "seed/avenue_seed_dim_feature_fs_v1.sql"
SEED_DRAFT = SQL_DIR / "seed/avenue_seed_dim_feature_fs_draft.sql"
FEATURE_DEFINITION = REPO_ROOT / "docs/spec/feature_definition.md"
ROW = re.compile(r"VALUES \('([^']+)', '([^']+)', '([^']+)', (NULL|'[^']*'), '([YN])', '([YN])', (\d+)\)")


def seed_rows(path: Path, feature_set: str) -> list:
    """시드 파일의 DIM_FEATURE 행: (코드, 이름, 단위, ALT, SIM, 순서). 다른 세트 이름이 섞이면 실패시킨다."""
    rows = []
    for match in ROW.finditer(path.read_text(encoding="utf-8")):
        version, code, name, unit, alt, sim, order = match.groups()
        assert version == feature_set, (path.name, version)
        rows.append((code, name, None if unit == "NULL" else unit.strip("'"), alt, sim, int(order)))
    return rows


def definition_rows() -> list:
    """정의서 11장(FS-V1 제안) 표의 행: (코드, 이름, 단위, ALT, SIM, 순서)."""
    section = FEATURE_DEFINITION.read_text(encoding="utf-8").split("## 11. DIM_FEATURE", 1)[1]
    found = re.findall(r"^\| (\d+) \| `(\w+)` \| ([^|]+?) \| ([^|]*?) \| ([YN]) \| ([YN]) \| [^|]+ \|", section, flags=re.MULTILINE)
    return [(code, name.strip(), unit.strip() or None, alt, sim, int(order)) for order, code, name, unit, alt, sim in found]


class Fsv1SeedTests(unittest.TestCase):
    def setUp(self):
        self.rows = seed_rows(SEED_V1, "FS-V1")

    def test_38_rows_in_order_without_duplicates(self):
        self.assertEqual(len(self.rows), 38)
        self.assertEqual([row[5] for row in self.rows], list(range(1, 39)))
        self.assertEqual(len({row[0] for row in self.rows}), 38)

    def test_same_as_feature_definition_chapter_11(self):
        self.assertEqual(self.rows, definition_rows())

    def test_codes_follow_training_feature_list(self):
        self.assertEqual([row[0] for row in self.rows], config.ALTERNATIVE_FEATURES)
        legacy = [row[0] for row in self.rows if row[3] == "N"]
        self.assertEqual(legacy, config.LEGACY_FEATURES)          # 기존 모델 = ALTERNATIVE_YN이 N인 피처

    def test_differs_from_fs_draft_only_by_lrz_and_renumbering(self):
        draft = seed_rows(SEED_DRAFT, "FS-DRAFT")
        self.assertEqual(len(draft), 39)
        self.assertEqual([row for row in draft if row[0] == "LRZ021201"][0][0], "LRZ021201")
        without_lrz = [row[:5] for row in draft if row[0] != "LRZ021201"]
        self.assertEqual(without_lrz, [row[:5] for row in self.rows])    # 이름·단위·ALT·SIM은 그대로, 순서 번호만 다시 매김

    def test_dummy_db_copy_is_byte_identical(self):
        self.assertEqual((DB_DIR / "26_seed_dim_feature_fs_v1.sql").read_bytes(), SEED_V1.read_bytes())

    def test_runners_include_the_seed_after_fs_draft(self):
        for runner in ("run_all.sql", "run_seed_only.sql"):
            lines = [line for line in (DB_DIR / runner).read_text(encoding="utf-8").splitlines() if line.startswith("@@")]
            self.assertLess(lines.index("@@25_seed_dim_feature_fs_draft.sql"), lines.index("@@26_seed_dim_feature_fs_v1.sql"), runner)
            self.assertLess(lines.index("@@26_seed_dim_feature_fs_v1.sql"), lines.index("@@99_check.sql"), runner)


class RegistryRowsTests(unittest.TestCase):
    """DDL 기준 데이터와 학습 코드 상수가 같아야 한다. 어긋나면 설명 파일의 버전과 DB 장부가 다른 이름이 된다."""

    def setUp(self):
        self.ddl = DDL.read_text(encoding="utf-8")

    def test_feature_set_row(self):
        match = re.search(r"INSERT INTO FEATURE_SET_VERSION \([^)]*\) VALUES \('FS-V1', '(\w+)',", self.ddl)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), "DRAFT")                 # 정의서가 확정되면 CONFIRMED로 바꾼다
        self.assertEqual(config.FEATURE_SET_VERSION, "FS-V1")

    def test_model_registry_row(self):
        line = next((l for l in self.ddl.splitlines() if l.startswith("INSERT INTO MODEL_REGISTRY") and "'LGBM-BASE-0.1'" in l), None)
        self.assertIsNotNone(line, "DDL 기준 데이터에 LGBM-BASE-0.1 행이 없다")
        match = re.search(r"VALUES \('([^']+)', '([^']+)', '([^']+)', '([^']+)',", line)
        version, algorithm, feature_set, status = match.groups()
        self.assertEqual((version, algorithm, feature_set), (config.MODEL_VERSION, config.ALGORITHM_NAME, config.FEATURE_SET_VERSION))
        self.assertEqual(status, "CANDIDATE")                     # ACTIVE 전환은 DB 담당이 따로 한다

    def test_dev_dummy_stays_the_only_active_model(self):
        rows = re.findall(r"INSERT INTO MODEL_REGISTRY \([^)]*\) VALUES \('([^']+)', '[^']+', '[^']+', '([^']+)',", self.ddl)
        self.assertEqual([version for version, status in rows if status == "ACTIVE"], ["DEV-DUMMY"])
        self.assertEqual(len(rows), 2)

    def test_change_sql_matches_ddl_rows(self):
        change = (SQL_DIR / "add_fs_v1_feature_set.sql").read_text(encoding="utf-8")
        for text in ("'FS-V1' AS FEATURE_SET_VERSION", "'DRAFT' AS STATUS_CODE", "'LGBM-BASE-0.1' AS MODEL_VERSION",
                     "'LightGBM' AS ALGORITHM_NAME", "'CANDIDATE' AS STATUS_CODE", "TIMESTAMP '2026-11-16 11:19:49'"):
            self.assertIn(text, change)
        self.assertIn("TIMESTAMP '2026-11-16 11:19:49'", self.ddl)   # 학습 시각이 DDL과 변경 SQL에서 같다


class CheckValuesTests(unittest.TestCase):
    def test_expected_row_counts(self):
        report = json.loads((DB_DIR / "seed_report.json").read_text(encoding="utf-8"))["rows"]
        self.assertEqual((report["FEATURE_SET_VERSION"], report["MODEL_REGISTRY"], report["DIM_FEATURE"]), (2, 2, 77))
        check = (DB_DIR / "99_check.sql").read_text(encoding="utf-8")
        counts = dict((name, int(count)) for name, count in re.findall(r"SELECT '(\w+)' AS TABLE_NAME, (\d+) AS EXPECTED", check))
        for name in ("FEATURE_SET_VERSION", "MODEL_REGISTRY", "DIM_FEATURE"):
            self.assertEqual(counts[name], report[name], name)


if __name__ == "__main__":
    unittest.main()
