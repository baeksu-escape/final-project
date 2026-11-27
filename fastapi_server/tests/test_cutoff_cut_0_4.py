# FP-285 등급 구간 CUT-0.4 일치 검사 — DDL 기준 데이터, 기존 DB용 추가·전환·되돌리기 SQL, 더미 DB 묶음(시드), FastAPI의 구간 표가 같은 값을 쓰는지 본다(DB 접속 불필요).
# CUT-0.4(0~644 / 645~711 / 712~1000)는 모델 0.3 대안 점수의 VALID 25/50/25 경계다(정의서 C37, D-01 임시 결정).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import re
import unittest

from pipeline import feature_catalog
from test_cutoff_cut_0_2 import DB_DIR, SQL_DIR, VERSION_ROW, bands_of, squeeze
from training.final_test_eval import CUT_0_4_BANDS

CUT_0_4 = [("CAUTION", 0, 644), ("STANDARD", 645, 711), ("GOOD", 712, 1000)]


def read(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8").replace("\r\n", "\n")


ADD_SQL = read("add_cutoff_cut_0_4.sql")
ACTIVATE_SQL = read("activate_cutoff_cut_0_4.sql")
ROLLBACK_SQL = read("rollback_cutoff_cut_0_4_to_0_3.sql")


def as_tuples(bands: list) -> list:
    return [(b["gradeBandCode"], b["minScore"], b["maxScore"]) for b in bands]


class ValuesAgreeTests(unittest.TestCase):
    def test_ddl_activates_only_cut_0_4(self):
        versions = {name: (status, activated) for name, status, activated in VERSION_ROW.findall(read("avenue_ddl.sql"))}
        self.assertEqual(versions["CUT-0.4"], ("ACTIVE", "SYSTIMESTAMP"))
        self.assertEqual([name for name, (status, _) in versions.items() if status == "ACTIVE"], ["CUT-0.4"])   # UX_SCV_ACTIVE
        self.assertEqual(bands_of("CUT-0.4"), CUT_0_4)

    def test_fastapi_table_matches_the_ddl_and_the_test_evaluation(self):
        self.assertEqual(as_tuples(feature_catalog.GRADE_BANDS_BY_CUTOFF["CUT-0.4"]), CUT_0_4)
        self.assertEqual(as_tuples(CUT_0_4_BANDS), CUT_0_4)     # TEST 평가에 쓴 후보 경계(C37)와 같아야 한다
        self.assertEqual(feature_catalog.cutoff_for("LGBM-BASE-0.3"), "CUT-0.4")
        for version in ("LGBM-BASE-0.1", "LGBM-BASE-0.2", feature_catalog.MODEL_VERSION, None):
            self.assertEqual(feature_catalog.cutoff_for(version), "CUT-0.3", version)

    def test_grade_band_edges(self):
        for score, code in ((0, "CAUTION"), (644, "CAUTION"), (645, "STANDARD"), (711, "STANDARD"), (712, "GOOD"), (1000, "GOOD")):
            self.assertEqual(feature_catalog.grade_band(score, "CUT-0.4"), code, score)
        with self.assertRaises(ValueError):
            feature_catalog.grade_band(1001, "CUT-0.4")

    def test_add_sql_uses_the_same_values_in_check_and_merge(self):
        text = re.sub(r"\s+", " ", ADD_SQL)
        check_part, merge_part = text.split("MERGE INTO SCORE_GRADE_BAND")
        for part in (check_part, merge_part):
            found = [(code, int(low), int(high)) for code, low, high in re.findall(r"'(CAUTION|STANDARD|GOOD)'(?: AS GRADE_BAND_CODE)?, (\d+)(?: AS MIN_SCORE)?, (\d+)", part)]
            self.assertEqual(found, CUT_0_4)


class AddSqlTests(unittest.TestCase):
    def test_adds_a_draft_without_touching_other_versions(self):
        statements = "\n".join(line for line in ADD_SQL.splitlines() if not line.startswith("--"))
        self.assertIn("'CUT-0.4' AS CUTOFF_VERSION,\n              'DRAFT' AS STATUS_CODE", statements)
        for other in ("'CUT-0.1'", "'CUT-0.2'", "'CUT-0.3'", "'ACTIVE'"):
            self.assertNotIn(other, statements)
        self.assertNotIn("UPDATE", statements.upper())
        self.assertNotIn("DELETE", statements.upper())

    def test_stops_before_changing_anything_when_rows_differ(self):
        check = ADD_SQL[ADD_SQL.index("DECLARE"):ADD_SQL.index("MERGE INTO SCORE_CUTOFF_VERSION")]
        for code in ("-20171", "-20172", "-20173"):
            self.assertIn(f"RAISE_APPLICATION_ERROR({code}", check)
        for word in ("INSERT", "UPDATE", "DELETE", "MERGE", "COMMIT"):
            self.assertNotIn(word, check.upper())
        self.assertIn("WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK\n", ADD_SQL)


class ActivateSqlTests(unittest.TestCase):
    def test_prechecks_come_before_any_change_and_only_one_version_is_active(self):
        text = squeeze(ACTIVATE_SQL)
        for code in ("-20174", "-20175", "-20176", "-20177"):
            self.assertIn(f"RAISE_APPLICATION_ERROR({code}", text)
        self.assertIn("IF v_active IS NULL OR v_active NOT IN ('CUT-0.3', 'CUT-0.4') THEN RAISE_APPLICATION_ERROR(-20177", text)
        for table in ("SCORE_BAND_OFFER", "LOAN_PRODUCT", "SCORE_CUTOFF_VERSION"):
            self.assertLess(text.index("-20177"), text.index(f"UPDATE {table}"), table)
        for code, low, high, order in (("CAUTION", 0, 644, 1), ("STANDARD", 645, 711, 2), ("GOOD", 712, 1000, 3)):
            self.assertIn(f"GRADE_BAND_CODE = '{code}' AND MIN_SCORE = {low} AND MAX_SCORE = {high} AND DISPLAY_ORDER = {order}", text)
        retire = text.index("SET STATUS_CODE = 'RETIRED' WHERE STATUS_CODE = 'ACTIVE'")
        activate = text.index("SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = SYSTIMESTAMP WHERE CUTOFF_VERSION = 'CUT-0.4'")
        self.assertLess(retire, activate)
        self.assertEqual(text.count("COMMIT;"), 1)
        self.assertNotIn("DELETE", text.upper())

    def test_offer_and_product_scores_move_and_rollback_reverses_them(self):
        activate, rollback = squeeze(ACTIVATE_SQL), squeeze(ROLLBACK_SQL)
        self.assertIn("SET MAX_SCORE = 644 WHERE MIN_SCORE = 0 AND MAX_SCORE = 653", activate)
        self.assertIn("SET MIN_SCORE = 645, MAX_SCORE = 711 WHERE MIN_SCORE = 654 AND MAX_SCORE = 726", activate)
        self.assertIn("SET MIN_SCORE = 712 WHERE MIN_SCORE = 727 AND MAX_SCORE = 1000", activate)
        self.assertIn("SET MAX_SCORE = 653 WHERE MIN_SCORE = 0 AND MAX_SCORE = 644", rollback)
        self.assertIn("SET MIN_SCORE = 654, MAX_SCORE = 726 WHERE MIN_SCORE = 645 AND MAX_SCORE = 711", rollback)
        self.assertIn("SET MIN_SCORE = 727 WHERE MIN_SCORE = 712 AND MAX_SCORE = 1000", rollback)
        for old, new in ((727, 712), (654, 645)):
            self.assertIn(f"UPDATE LOAN_PRODUCT SET MIN_ALT_SCORE = {new} WHERE MIN_ALT_SCORE = {old}", activate)
            self.assertIn(f"UPDATE LOAN_PRODUCT SET MIN_ALT_SCORE = {old} WHERE MIN_ALT_SCORE = {new}", rollback)
        self.assertIn("SET STATUS_CODE = 'DRAFT', ACTIVATED_AT = NULL WHERE CUTOFF_VERSION = 'CUT-0.4'", rollback)
        self.assertIn("SET STATUS_CODE = 'ACTIVE', ACTIVATED_AT = NVL(ACTIVATED_AT, SYSTIMESTAMP) WHERE CUTOFF_VERSION = 'CUT-0.3'", rollback)
        for sql in (ACTIVATE_SQL, ROLLBACK_SQL):
            self.assertIn("WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK", sql)


class DummyDbSeedTests(unittest.TestCase):
    def test_offers_and_products_use_the_new_boundaries(self):
        offers = (DB_DIR / "21_seed_score_band_offer.sql").read_text(encoding="utf-8")
        found = re.findall(r"VALUES \((\d), (\d+), (\d+), ", offers)
        self.assertEqual([(int(a), int(b), int(c)) for a, b, c in found], [(1, 0, 644), (2, 645, 711), (3, 712, 1000)])
        products = (DB_DIR / "22_seed_loan_product.sql").read_text(encoding="utf-8")
        scores = re.findall(r"', (\d+|NULL), '[^']*대상\(시연용\)'", products)
        self.assertEqual({score: scores.count(score) for score in set(scores)}, {"0": 8, "645": 2, "712": 7})
        builder = (DB_DIR / "tools/build_db.py").read_text(encoding="utf-8")
        self.assertIn("PRODUCT_MIN_SCORES = {'0': 712, '5': 645, '1': 0, '2': 0, '3': 0}", builder)


if __name__ == "__main__":
    unittest.main()
