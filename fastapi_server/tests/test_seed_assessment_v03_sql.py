# FP-285 모델 0.3 시드 회원 평가 적재 SQL 검사 — 회원·항목 수, 등급 구간(CUT-0.4), SHAP 합, 더미 시드와 같은 입력인지 본다(DB 접속·모델 파일 불필요).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import json
import re
import unittest
from collections import Counter
from pathlib import Path

from pipeline.feature_catalog import GRADE_BANDS_BY_CUTOFF, grade_band

SQL_DIR = Path(__file__).resolve().parents[2] / "docs/spec/sql"
SQL = (SQL_DIR / "load_seed_assessment_lgbm_base_0_3.sql").read_text(encoding="utf-8").replace("\r\n", "\n")
EXPENSE_SEED = (SQL_DIR / "dummy_db/15_seed_user_expense_item.sql").read_text(encoding="utf-8")
FS_V1_CODES = set(re.findall(r"VALUES \('FS-V1', '(\w+)'", (SQL_DIR / "dummy_db/26_seed_dim_feature_fs_v1.sql").read_text(encoding="utf-8")))

HEAD = re.compile(r"^SELECT '([0-9a-f-]{36})', (\d+), 'SERVICE', '\w+', '\w+', '[\d-]+', '([\w.-]+)', '([\w-]+)', '([\w.-]+)', 'SCORED', NULL, "
                  r"'Y', (\d+), '(\w+)', [\d.]+, 'Y', (\d+), '(\w+)', [\d.]+, (\d+),$")
FACTOR = re.compile(r"SELECT A\.ASSESSMENT_ID, 'FS-V1', (\d+), '(\w+)', (?:NULL|'(?:[^']|'')*'), -?[\d.]+, (-?\d+), TIMESTAMP .*?A\.REQUEST_ID = '([0-9a-f-]{36})'")


# 적재 SQL에서 회원별 평가 한 건(점수·등급·입력 스냅샷·항목)을 읽는다.
def parse(sql: str) -> dict:
    people, current, chunks = {}, None, []
    for line in sql.split("\n"):
        head = HEAD.match(line)
        if head:
            request, user, model, fsv, cutoff, trad, trad_band, alt, alt_band, base = head.groups()
            current = {"user": int(user), "versions": (model, fsv, cutoff), "trad": (int(trad), trad_band),
                       "alt": (int(alt), alt_band), "base": int(base), "factors": []}
            people[request], chunks = current, []
            continue
        if current is not None and "snapshot" not in current:
            if line.lstrip().startswith("'N', NULL, TIMESTAMP"):
                text = "".join(re.findall(r"TO_CLOB\('((?:[^']|'')*)'\)", "\n".join(chunks)))
                current["snapshot"] = json.loads(text.replace("''", "'"))
            else:
                chunks.append(line)
            continue
        factor = FACTOR.search(line)
        if factor:
            rank, code, points, request = factor.groups()
            people[request]["factors"].append((int(rank), code, int(points)))
    return people


PEOPLE = parse(SQL)


class SeedAssessmentSqlTests(unittest.TestCase):
    def test_counts_match_the_header(self):
        self.assertIn("-- 시드 회원 318명 · 항목 12084행.", SQL)
        self.assertEqual(len(PEOPLE), 318)
        self.assertEqual(len({p["user"] for p in PEOPLE.values()}), 318)
        self.assertEqual(sum(len(p["factors"]) for p in PEOPLE.values()), 12084)

    def test_versions_and_grade_bands(self):
        self.assertEqual(Counter(p["versions"] for p in PEOPLE.values()), Counter({("LGBM-BASE-0.3", "FS-V1", "CUT-0.4"): 318}))
        self.assertIn("CUT-0.4", GRADE_BANDS_BY_CUTOFF)
        for p in PEOPLE.values():
            for score, band in (p["trad"], p["alt"]):
                self.assertEqual(grade_band(score, "CUT-0.4"), band, p["user"])

    def test_factors_are_complete_and_add_up_to_the_alternative_score(self):
        self.assertEqual(len(FS_V1_CODES), 38)
        for p in PEOPLE.values():
            self.assertEqual(sorted(rank for rank, _, _ in p["factors"]), list(range(1, 39)), p["user"])
            self.assertEqual({code for _, code, _ in p["factors"]}, FS_V1_CODES, p["user"])
            self.assertEqual(p["base"] + sum(points for _, _, points in p["factors"]), p["alt"][0], p["user"])

    # 산출한 DB의 입력이 화면에서 바뀐 채였던 0.2 때의 문제를 막는다 — 월 지출은 저장소 더미 시드와 같아야 한다.
    def test_monthly_expense_equals_the_dummy_seed(self):
        seed = {int(user): int(amount) for user, amount in
                re.findall(r"VALUES \(\d+, (\d+), '2026-08', '\w+', [^,]+, '[^']*', (\d+)\);", EXPENSE_SEED)}
        for p in PEOPLE.values():
            self.assertEqual(p["snapshot"]["expense_avg_month_krw"], seed[p["user"]], p["user"])

    def test_loads_only_after_prechecks_and_skips_existing_rows(self):
        self.assertLess(SQL.index("RAISE_APPLICATION_ERROR(-20202"), SQL.index("INSERT INTO ASSESSMENT "))
        self.assertIn("MODEL_VERSION = 'LGBM-BASE-0.3'", SQL.split("INSERT INTO ASSESSMENT ")[0])
        self.assertEqual(SQL.count("INSERT INTO ASSESSMENT "), 318)
        self.assertEqual(SQL.count("WHERE NOT EXISTS (SELECT 1 FROM ASSESSMENT X WHERE X.REQUEST_ID"), 318)
        self.assertNotIn("DELETE ", SQL)
        self.assertNotIn("UPDATE ", SQL)
        self.assertLess(max(len(line.encode("utf-8")) for line in SQL.split("\n")), 2499)


# FP-285 검토 반영 — 다른 회원에게 평가가 붙지 않도록 USER_ID·LOGIN_ID 대조와 ACTIVE 모델 확인이 적재보다 앞서는지 본다.
class TargetCheckTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed = (SQL_DIR / "dummy_db/10_seed_app_user.sql").read_text(encoding="utf-8")
        cls.login = {int(user): name for user, name in re.findall(r"INSERT INTO APP_USER \([^)]*\) VALUES \((\d+), '([^']*)'", seed)}
        cls.before, _, cls.after = SQL.partition("INSERT INTO ASSESSMENT ")

    def test_guard_lists_every_target_with_the_seed_login_id(self):
        pairs = re.findall(r"SELECT (\d+) AS USER_ID, '(\w+)' AS LOGIN_ID FROM DUAL", self.before)
        self.assertEqual({int(user) for user, _ in pairs}, {p["user"] for p in PEOPLE.values()})
        self.assertEqual(len(pairs), 318)
        for user, name in pairs:
            self.assertEqual(name, self.login[int(user)], user)

    def test_stops_before_loading_when_a_check_fails(self):
        self.assertIn("E ON E.USER_ID = U.USER_ID AND E.LOGIN_ID = U.LOGIN_ID", self.before)
        self.assertIn("IF v_cnt <> 318 THEN RAISE_APPLICATION_ERROR(-20205", self.before)
        self.assertIn("MODEL_VERSION = 'LGBM-BASE-0.3' AND STATUS_CODE = 'ACTIVE';", self.before)
        self.assertIn("RAISE_APPLICATION_ERROR(-20204", self.before)
        self.assertIn("WHENEVER SQLERROR EXIT FAILURE ROLLBACK", self.before)

    def test_final_query_pairs_each_request_with_its_member(self):
        found = dict((request, name) for name, request in re.findall(r"SELECT '(\w+)' AS LOGIN_ID, '([0-9a-f-]{36})' AS REQUEST_ID FROM DUAL", SQL))
        self.assertEqual(found, {request: self.login[p["user"]] for request, p in PEOPLE.items()})
        self.assertIn("AS 다른_회원", SQL)

    # 다시 뽑은 파일에도 같은 검사가 들어가야 한다.
    def test_export_script_writes_the_same_checks(self):
        export = (SQL_DIR / "export_seed_assessment.sql").read_text(encoding="utf-8")
        for text in ("-20204", "-20205", "E ON E.USER_ID = U.USER_ID AND E.LOGIN_ID = U.LOGIN_ID", "AS 다른_회원"):
            self.assertIn(text, export)


if __name__ == "__main__":
    unittest.main()
