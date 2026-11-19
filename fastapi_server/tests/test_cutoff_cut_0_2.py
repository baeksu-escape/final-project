# 등급 구간 CUT-0.2(DRAFT) 일치 검사 — DDL 기준 데이터, 기존 DB용 변경 SQL, 더미 DB 묶음, FastAPI의 CUT-0.1 상수가 같은 값을 쓰는지 본다(DB 접속 불필요).
# 25/50/25 임시 결정(D-01, 11/19)의 경계는 CAUTION 0~659 / STANDARD 660~730 / GOOD 731~1000이고, 서비스는 아직 CUT-0.1(ACTIVE)을 쓴다.
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import hashlib
import json
import re
import unittest
from pathlib import Path

from pipeline import feature_catalog

SQL_DIR = Path(__file__).resolve().parents[2] / "docs/spec/sql"
DB_DIR = SQL_DIR / "dummy_db"
DDL = (SQL_DIR / "avenue_ddl.sql").read_text(encoding="utf-8").replace("\r\n", "\n")
CHANGE_SQL = (SQL_DIR / "add_cutoff_cut_0_2.sql").read_text(encoding="utf-8").replace("\r\n", "\n")

VERSION_ROW = re.compile(r"^INSERT INTO SCORE_CUTOFF_VERSION \(CUTOFF_VERSION, STATUS_CODE, NOTE, ACTIVATED_AT\) VALUES \('([^']+)', '([^']+)', '[^']*', ([^)]+)\);$", re.MULTILINE)
BAND_ROW = re.compile(r"^INSERT INTO SCORE_GRADE_BAND \(CUTOFF_VERSION, GRADE_BAND_CODE, MIN_SCORE, MAX_SCORE, DISPLAY_ORDER\) VALUES \('([^']+)', '([^']+)', (\d+), (\d+), (\d+)\);$", re.MULTILINE)

CUT_0_2 = [("CAUTION", 0, 659), ("STANDARD", 660, 730), ("GOOD", 731, 1000)]
CUT_0_1 = [("CAUTION", 0, 664), ("STANDARD", 665, 779), ("GOOD", 780, 1000)]


def bands_of(version: str) -> list:
    """DDL 기준 데이터에서 한 버전의 (등급 코드, 최소, 최대)를 표시 순서대로 읽는다."""
    rows = [(int(order), code, int(low), int(high)) for ver, code, low, high, order in BAND_ROW.findall(DDL) if ver == version]
    return [(code, low, high) for _, code, low, high in sorted(rows)]


class DdlBaseDataTests(unittest.TestCase):
    def test_cut_0_2_is_draft_and_cut_0_1_is_the_only_active(self):
        versions = {name: (status, activated) for name, status, activated in VERSION_ROW.findall(DDL)}
        self.assertEqual(versions["CUT-0.2"], ("DRAFT", "NULL"))         # DRAFT는 활성화 시각이 없다(CK_SCV_ACTIVATED)
        self.assertEqual([name for name, (status, _) in versions.items() if status == "ACTIVE"], ["CUT-0.1"])   # UX_SCV_ACTIVE

    def test_cut_0_2_follows_the_25_50_25_decision(self):
        self.assertEqual(bands_of("CUT-0.2"), CUT_0_2)

    def test_cut_0_1_is_unchanged(self):
        self.assertEqual(bands_of("CUT-0.1"), CUT_0_1)

    def test_every_version_covers_0_to_1000_without_gaps_or_overlaps(self):
        for version in ("CUT-0.1", "CUT-0.2"):
            bands = sorted(bands_of(version), key=lambda band: band[1])
            self.assertEqual(bands[0][1], 0, version)
            self.assertEqual(bands[-1][2], 1000, version)
            for (_, _, previous_high), (_, next_low, _) in zip(bands, bands[1:]):
                self.assertEqual(next_low, previous_high + 1, version)   # 경계 점수가 두 등급에 속하거나 비지 않는다


class ChangeSqlTests(unittest.TestCase):
    def test_uses_the_same_values_as_the_ddl(self):
        text = re.sub(r"\s+", " ", CHANGE_SQL)
        self.assertIn("'CUT-0.2' AS CUTOFF_VERSION, 'DRAFT' AS STATUS_CODE", text)
        found = [(code, int(low), int(high)) for code, low, high in re.findall(r"'(CAUTION|STANDARD|GOOD)'(?: AS GRADE_BAND_CODE)?, (\d+)(?: AS MIN_SCORE)?, (\d+)", text)]
        self.assertEqual(found, CUT_0_2)

    def test_rolls_back_both_steps_on_error(self):
        # 두 번째 MERGE가 실패해도 첫 번째(버전 행)만 커밋되지 않도록 오류 종료 때 ROLLBACK한다(SQL*Plus는 종료 시 기본이 COMMIT).
        self.assertIn("WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK\n", CHANGE_SQL)
        self.assertIn("WHENEVER OSERROR EXIT FAILURE ROLLBACK\n", CHANGE_SQL)
        self.assertLess(CHANGE_SQL.index("WHENEVER SQLERROR"), CHANGE_SQL.index("MERGE INTO SCORE_CUTOFF_VERSION"))

    def test_does_not_touch_cut_0_1_or_activate_cut_0_2(self):
        statements = "\n".join(line for line in CHANGE_SQL.splitlines() if not line.startswith("--"))
        self.assertNotIn("'CUT-0.1'", statements)
        self.assertNotIn("'ACTIVE'", statements)
        self.assertNotIn("UPDATE", statements.upper())
        self.assertNotIn("DELETE", statements.upper())


class DummyDbBundleTests(unittest.TestCase):
    def test_ddl_copy_is_identical(self):
        self.assertEqual((SQL_DIR / "avenue_ddl.sql").read_bytes(), (DB_DIR / "01_create_tables.sql").read_bytes())

    def test_seed_report_and_check_match_the_ddl(self):
        report = json.loads((DB_DIR / "seed_report.json").read_text(encoding="utf-8"))
        self.assertEqual(report["ddl_sha256"], hashlib.sha256(DDL.encode("utf-8")).hexdigest())   # CRLF를 LF로 정규화한 해시
        self.assertEqual(report["rows"]["SCORE_CUTOFF_VERSION"], len(VERSION_ROW.findall(DDL)))
        self.assertEqual(report["rows"]["SCORE_GRADE_BAND"], len(BAND_ROW.findall(DDL)))
        check = (DB_DIR / "99_check.sql").read_text(encoding="utf-8")
        self.assertIn(f"SELECT 'SCORE_CUTOFF_VERSION' AS TABLE_NAME, {report['rows']['SCORE_CUTOFF_VERSION']} AS EXPECTED", check)
        self.assertIn(f"SELECT 'SCORE_GRADE_BAND' AS TABLE_NAME, {report['rows']['SCORE_GRADE_BAND']} AS EXPECTED", check)


class ServiceStillUsesCut01Tests(unittest.TestCase):
    def test_fastapi_constants_match_cut_0_1(self):
        # CUT-0.2를 ACTIVE로 옮길 때는 이 상수도 함께 바꾼다(서비스 전환 PR). 그 전에는 DB의 ACTIVE 버전과 같아야 FK 오류가 없다.
        self.assertEqual(feature_catalog.CUTOFF_VERSION, "CUT-0.1")
        self.assertEqual([(b["gradeBandCode"], b["minScore"], b["maxScore"]) for b in feature_catalog.GRADE_BANDS], CUT_0_1)


if __name__ == "__main__":
    unittest.main()
