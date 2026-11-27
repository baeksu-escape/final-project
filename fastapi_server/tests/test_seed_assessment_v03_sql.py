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


if __name__ == "__main__":
    unittest.main()
