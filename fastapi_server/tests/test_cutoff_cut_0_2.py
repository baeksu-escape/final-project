# 등급 구간 CUT-0.2·CUT-0.3(DRAFT) 일치 검사 — DDL 기준 데이터, 기존 DB용 변경 SQL, 더미 DB 묶음, FastAPI의 CUT-0.1 상수가 같은 값을 쓰는지 본다(DB 접속 불필요).
# 25/50/25 임시 결정(D-01)의 경계: CUT-0.2(11/19, 모델 0.1 분포)는 CAUTION 0~659 / STANDARD 660~730 / GOOD 731~1000, CUT-0.3(11/20, 모델 0.2 분포)은 0~653 / 654~726 / 727~1000이다. 서비스는 아직 CUT-0.1(ACTIVE)을 쓴다.
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
CHANGE_SQL_FILES = {"CUT-0.2": "add_cutoff_cut_0_2.sql", "CUT-0.3": "add_cutoff_cut_0_3.sql"}
CHANGE_SQL = {version: (SQL_DIR / name).read_text(encoding="utf-8").replace("\r\n", "\n") for version, name in CHANGE_SQL_FILES.items()}

VERSION_ROW = re.compile(r"^INSERT INTO SCORE_CUTOFF_VERSION \(CUTOFF_VERSION, STATUS_CODE, NOTE, ACTIVATED_AT\) VALUES \('([^']+)', '([^']+)', '[^']*', ([^)]+)\);$", re.MULTILINE)
BAND_ROW = re.compile(r"^INSERT INTO SCORE_GRADE_BAND \(CUTOFF_VERSION, GRADE_BAND_CODE, MIN_SCORE, MAX_SCORE, DISPLAY_ORDER\) VALUES \('([^']+)', '([^']+)', (\d+), (\d+), (\d+)\);$", re.MULTILINE)

CUT_0_3 = [("CAUTION", 0, 653), ("STANDARD", 654, 726), ("GOOD", 727, 1000)]
CUT_0_2 = [("CAUTION", 0, 659), ("STANDARD", 660, 730), ("GOOD", 731, 1000)]
CUT_0_1 = [("CAUTION", 0, 664), ("STANDARD", 665, 779), ("GOOD", 780, 1000)]
DRAFT_VERSIONS = {"CUT-0.2": CUT_0_2, "CUT-0.3": CUT_0_3}


def bands_of(version: str) -> list:
    """DDL 기준 데이터에서 한 버전의 (등급 코드, 최소, 최대)를 표시 순서대로 읽는다."""
    rows = [(int(order), code, int(low), int(high)) for ver, code, low, high, order in BAND_ROW.findall(DDL) if ver == version]
    return [(code, low, high) for _, code, low, high in sorted(rows)]


class DdlBaseDataTests(unittest.TestCase):
    def test_draft_versions_are_draft_and_cut_0_1_is_the_only_active(self):
        versions = {name: (status, activated) for name, status, activated in VERSION_ROW.findall(DDL)}
        for version in DRAFT_VERSIONS:
            self.assertEqual(versions[version], ("DRAFT", "NULL"), version)         # DRAFT는 활성화 시각이 없다(CK_SCV_ACTIVATED)
        self.assertEqual([name for name, (status, _) in versions.items() if status == "ACTIVE"], ["CUT-0.1"])   # UX_SCV_ACTIVE

    def test_draft_versions_follow_the_25_50_25_decision(self):
        for version, expected in DRAFT_VERSIONS.items():
            self.assertEqual(bands_of(version), expected, version)

    def test_cut_0_3_boundaries_come_from_the_model_0_2_quartiles(self):
        # 모델 0.2 대안 모델의 기존 집단 VALID 점수 p25=653, p75=727(경계 점수는 각각 주의·우수에 속한다).
        (_, _, caution_high), (_, standard_low, standard_high), (_, good_low, _) = bands_of("CUT-0.3")
        self.assertEqual((caution_high, standard_low, standard_high, good_low), (653, 654, 726, 727))

    def test_cut_0_1_is_unchanged(self):
        self.assertEqual(bands_of("CUT-0.1"), CUT_0_1)

    def test_every_version_covers_0_to_1000_without_gaps_or_overlaps(self):
        for version in ("CUT-0.1", *DRAFT_VERSIONS):
            bands = sorted(bands_of(version), key=lambda band: band[1])
            self.assertEqual(bands[0][1], 0, version)
            self.assertEqual(bands[-1][2], 1000, version)
            for (_, _, previous_high), (_, next_low, _) in zip(bands, bands[1:]):
                self.assertEqual(next_low, previous_high + 1, version)   # 경계 점수가 두 등급에 속하거나 비지 않는다


class ChangeSqlTests(unittest.TestCase):
    def test_uses_the_same_values_as_the_ddl(self):
        for version, sql in CHANGE_SQL.items():
            text = re.sub(r"\s+", " ", sql)
            self.assertIn(f"'{version}' AS CUTOFF_VERSION, 'DRAFT' AS STATUS_CODE", text, version)
            # 확인 블록(MERGE 앞)과 MERGE 두 곳에 같은 경계가 들어 있어야 한다.
            check_part, merge_part = text.split("MERGE INTO SCORE_GRADE_BAND")[0], text.split("MERGE INTO SCORE_GRADE_BAND")[1]
            for part in (check_part, merge_part):
                found = [(code, int(low), int(high)) for code, low, high in re.findall(r"'(CAUTION|STANDARD|GOOD)'(?: AS GRADE_BAND_CODE)?, (\d+)(?: AS MIN_SCORE)?, (\d+)", part)]
                self.assertEqual(found, DRAFT_VERSIONS[version], version)

    def test_stops_when_existing_rows_differ_before_changing_anything(self):
        # 같은 버전·등급 코드가 이미 있으면 MERGE가 건너뛰어 성공하므로, MERGE 앞에서 상태·경계·표시 순서를 비교해 다르면 오류로 멈춘다(검수 반영).
        for version, sql in CHANGE_SQL.items():
            text = re.sub(r"\s+", " ", sql)
            check = text[text.index("DECLARE"):text.index("MERGE INTO SCORE_CUTOFF_VERSION")]
            self.assertLess(sql.index("DECLARE"), sql.index("MERGE INTO SCORE_CUTOFF_VERSION"), version)
            self.assertIn(f"WHERE CUTOFF_VERSION = '{version}'", check, version)
            self.assertIn("IF v_status <> 'DRAFT' THEN RAISE_APPLICATION_ERROR(-20141", check, version)               # 상태
            self.assertIn("b.MIN_SCORE <> e.MIN_SCORE OR b.MAX_SCORE <> e.MAX_SCORE OR b.DISPLAY_ORDER <> e.DISPLAY_ORDER", check, version)   # 경계·표시 순서
            self.assertIn("RAISE_APPLICATION_ERROR(-20142", check, version)
            self.assertIn("GRADE_BAND_CODE NOT IN ('CAUTION', 'STANDARD', 'GOOD')", check, version)                   # 모르는 등급 코드
            self.assertIn("RAISE_APPLICATION_ERROR(-20143", check, version)
            self.assertIn("WHEN NO_DATA_FOUND THEN NULL", check, version)                                              # 버전 행이 없는 새 DB는 통과

    def test_check_block_does_not_change_data(self):
        # 확인 블록은 읽기만 한다. 값을 바꾸는 문장은 MERGE 두 개뿐이어야 한다.
        for version, sql in CHANGE_SQL.items():
            block = sql[sql.index("DECLARE"):sql.index("MERGE INTO SCORE_CUTOFF_VERSION")]
            for word in ("INSERT", "UPDATE", "DELETE", "MERGE", "COMMIT"):
                self.assertNotIn(word, block.upper(), f"{version} 확인 블록에 {word}가 있다")

    def test_rolls_back_both_steps_on_error(self):
        # 두 번째 MERGE가 실패해도 첫 번째(버전 행)만 커밋되지 않도록 오류 종료 때 ROLLBACK한다(SQL*Plus는 종료 시 기본이 COMMIT).
        for version, sql in CHANGE_SQL.items():
            self.assertIn("WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK\n", sql, version)
            self.assertIn("WHENEVER OSERROR EXIT FAILURE ROLLBACK\n", sql, version)
            self.assertLess(sql.index("WHENEVER SQLERROR"), sql.index("MERGE INTO SCORE_CUTOFF_VERSION"), version)

    def test_does_not_touch_other_versions_or_activate_the_new_one(self):
        for version, sql in CHANGE_SQL.items():
            statements = "\n".join(line for line in sql.splitlines() if not line.startswith("--"))
            for other in ("CUT-0.1", "CUT-0.2", "CUT-0.3"):
                if other != version:
                    self.assertNotIn(f"'{other}'", statements, f"{version} 변경 SQL이 {other}를 건드린다")
            self.assertNotIn("'ACTIVE'", statements, version)
            self.assertNotIn("UPDATE", statements.upper(), version)
            self.assertNotIn("DELETE", statements.upper(), version)


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
