# FP-140 예측 Mock 검사 — Python 내장 unittest만 쓴다(새 라이브러리 없음).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
# API 화면 확인(경로·오류 코드)은 서버를 켜고 /docs에서 직접 한다(README 참고).
import re
import unittest
from pathlib import Path

from pipeline import feature_catalog as catalog
from pipeline.feature_builder import build_features
from pipeline.mock_scorer import score_features
from pipeline.simulation import simulate
from routers.assessment import ApiError, score
from schemas.assessment import ScoreRequest

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_SQL = REPO_ROOT / "docs/spec/sql/seed/avenue_seed_dim_feature_fs_draft.sql"
FEATURE_DEFINITION = REPO_ROOT / "docs/spec/feature_definition.md"
REQUEST_ID = "3f1c2a9e-8b7d-4c1e-9a2b-1d2e3f4a5b6c"


def months(start_year=2025, start_month=11, count=12):
    """기준월로 끝나는 12개월 'YYYY-MM' 목록 (2025-11 ~ 2026-10)."""
    out, y, m = [], start_year, start_month
    for _ in range(count):
        out.append(f"{y}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def sample_request(worker="SELF_EMPLOYED", **overrides) -> dict:
    """명세서 4-3 예시를 바탕으로 한 합성 요청 (자영업자, 12개월)."""
    ms = months()
    incomes = ([{"baseMonth": "2026-10", "incomeKindCode": "SALARY", "incomeAmt": 3_000_000}]
               if worker == "EMPLOYEE" else
               [{"baseMonth": m, "incomeKindCode": "MONTHLY_INCOME", "incomeAmt": 2_000_000 + i * 100_000}
                for i, m in enumerate(ms)])
    body = {
        "requestId": REQUEST_ID,
        "expectedModelVersion": "DEV-DUMMY",
        "applicant": {"workerTypeCode": worker, "age": 34, "requiredIncomeMonths": 1 if worker == "EMPLOYEE" else 12},
        "inputBaseMonth": "2026-10",
        "incomeMonths": incomes,
        "expenses": [{"expenseGroupCode": "FIXED", "expenseCategory": "주거", "monthlyAmt": 650_000}],
        "loans": [{"loanTypeCode": "CREDIT", "sourceCode": "MANUAL", "balanceAmt": 12_000_000,
                   "annualRatePct": 8.9, "remainingMonths": 24, "monthlyPaymentAmt": 550_000}],
        "creditProfile": {"sourceCode": "MANUAL", "delinqCount12m": 1, "newLoanCount3m": 0, "cardLimitAmt": 5_000_000,
                          "cardMonthlySpendAmt": 3_000_000, "cashAdvanceMonths": 2, "privateLenderLoanBalanceAmt": 0},
        "alternativeData": {
            "telecom": [{"billMonth": m, "paymentStatusCode": "LATE" if i == 2 else "ON_TIME"} for i, m in enumerate(ms)],
            "utility": [{"billMonth": m, "paymentStatusCode": "UNPAID" if i == 5 else "ON_TIME"} for i, m in enumerate(ms)],
            "easypay": [{"baseMonth": m, "observationStatusCode": "OBSERVED", "paymentCount": 5, "paymentAmt": 100_000}
                        for m in ms],
            "socialInsurance": (
                [{"insuranceTypeCode": "NATIONAL_PENSION", "baseMonth": m, "coverageStatusCode": "COVERED",
                  "payerTypeCode": "REGIONAL", "paymentStatusCode": "LATE" if i == 0 else "ON_TIME"} for i, m in enumerate(ms)]
                + [{"insuranceTypeCode": "HEALTH_INSURANCE", "baseMonth": m, "coverageStatusCode": "DEPENDENT",
                    "payerTypeCode": "HOUSEHOLD", "paymentStatusCode": "NOT_APPLICABLE"} for m in ms]),
        },
    }
    body.update(overrides)
    return body


class FeatureCatalogTest(unittest.TestCase):
    """피처 목록이 시드 SQL·피처 정의서와 같은지 — 다르면 Spring 저장이 FK 오류로 실패한다."""

    def test_same_as_seed_sql(self):
        rows = re.findall(r"VALUES \('FS-DRAFT', '([^']+)', '([^']+)', (NULL|'[^']*'), '([YN])', '([YN])', (\d+)\)",
                          SEED_SQL.read_text(encoding="utf-8"))
        seed = [(c, n, None if u == "NULL" else u.strip("'"), a, s, int(o)) for c, n, u, a, s, o in rows]
        ours = [(f.code, f.name, f.unit, f.alternative_yn, f.simulatable_yn, f.display_order) for f in catalog.FEATURES]
        self.assertEqual(len(ours), 39)
        self.assertEqual(sorted(ours), sorted(seed))

    def test_same_codes_as_feature_definition(self):
        section = FEATURE_DEFINITION.read_text(encoding="utf-8").split("## 11. DIM_FEATURE")[1]
        codes = re.findall(r"^\| \d+ \| `([^`]+)` \|", section, re.M)
        self.assertEqual(sorted(codes), sorted(f.code for f in catalog.FEATURES))

    def test_model_feature_counts(self):
        self.assertEqual(len(catalog.TRADITIONAL_CODES), 19)
        self.assertEqual(len(catalog.ALTERNATIVE_CODES), 39)

    def test_grade_band_edges(self):
        self.assertEqual(catalog.grade_band(0), "CAUTION")
        self.assertEqual(catalog.grade_band(664), "CAUTION")
        self.assertEqual(catalog.grade_band(665), "STANDARD")
        self.assertEqual(catalog.grade_band(779), "STANDARD")
        self.assertEqual(catalog.grade_band(780), "GOOD")
        self.assertEqual(catalog.grade_band(1000), "GOOD")


class FeatureBuilderTest(unittest.TestCase):
    """입력 → 피처 39개 (정의서 3장)."""

    def test_builds_exactly_39_features(self):
        features = build_features(ScoreRequest(**sample_request()))
        self.assertEqual(set(features), set(catalog.ALTERNATIVE_CODES))

    def test_values_from_sample(self):
        f = build_features(ScoreRequest(**sample_request()))
        self.assertEqual(f["telecom_late_months"], 1)
        self.assertEqual(f["telecom_on_time_streak"], 9)       # 마지막 9달 연속 정시
        self.assertEqual(f["utility_late_months"], 1)          # UNPAID도 미납 (U2)
        self.assertEqual(f["CL0631905"], 60.0)                 # 300만 ÷ 500만 × 100
        self.assertEqual(f["LRZ021201"], 550_000 * 12)
        self.assertEqual(f["L00000001"], 1)
        self.assertEqual(f["segment"], "selfemp")
        self.assertEqual(f["np_payer_type"], "regional")
        self.assertEqual(f["np_arrears_months"], 1)
        self.assertEqual(f["si_arrears_any"], 1)

    def test_employee_salary_spread_to_12_months(self):
        f = build_features(ScoreRequest(**sample_request(worker="EMPLOYEE")))
        self.assertEqual(f["income_svc_12m_krw"], 3_000_000 * 12)
        self.assertEqual(f["income_cv_svc_12m"], 0)
        self.assertEqual(f["zero_income_months_svc_12m"], 0)

    def test_missing_stays_none(self):
        """null을 0으로 채우지 않는다: 납부 대상 0달이면 정시율 None, 신용 이력 없음이면 None (정의서 7장)."""
        body = sample_request(creditProfile={"sourceCode": "MANUAL"})
        f = build_features(ScoreRequest(**body))
        self.assertIsNone(f["hi_on_time_rate"])
        self.assertEqual(f["hi_due_months"], 0)
        self.assertIsNone(f["DQ1200001"])
        self.assertIsNone(f["CL0631905"])


class MockScorerTest(unittest.TestCase):
    """점수 0~1000, 점수 합 규칙, rank, 같은 입력 같은 결과."""

    def setUp(self):
        self.features = build_features(ScoreRequest(**sample_request()))
        self.result = score_features(self.features)

    def test_same_input_same_result(self):
        self.assertEqual(self.result, score_features(dict(self.features)))

    def test_scores_in_range_and_grades(self):
        for model in ("traditional", "alternative"):
            r = self.result[model]
            self.assertTrue(0 <= r["score"] <= 1000)
            self.assertEqual(r["gradeBandCode"], catalog.grade_band(r["score"]))
            self.assertTrue(0 <= r["defaultProb"] <= 1)

    def test_shap_sum_rule(self):
        shap = self.result["shap"]
        self.assertEqual(shap["baseScore"] + sum(f["shapScore"] for f in shap["factors"]),
                         self.result["alternative"]["score"])

    def test_all_39_factors_with_ranks(self):
        factors = self.result["shap"]["factors"]
        self.assertEqual(len(factors), 39)
        self.assertEqual([f["rank"] for f in factors], list(range(1, 40)))
        for f in factors:
            self.assertTrue(-9999 <= f["shapScore"] <= 9999)          # SHAP_SCORE NUMBER(4)
            self.assertTrue(f["featureValue"] is None or len(f["featureValue"]) <= 100)

    def test_rank_order_and_tie_by_name(self):
        """|shapScore| 큰 순서, 같으면 항목 이름 가나다순."""
        factors = self.result["shap"]["factors"]
        keys = [(-abs(f["shapScore"]), catalog.FEATURE_BY_CODE[f["featureCode"]].name) for f in factors]
        self.assertEqual(keys, sorted(keys))
        zeros = [catalog.FEATURE_BY_CODE[f["featureCode"]].name for f in factors if f["shapScore"] == 0]
        self.assertGreater(len(zeros), 1)                               # 동점(0점) 항목이 실제로 있는 경우를 검사
        self.assertEqual(zeros, sorted(zeros))

    def test_traditional_ignores_alternative_data(self):
        """기존 모델은 대안 데이터 20개를 보지 않는다 — 대안 값을 바꿔도 기존 점수는 그대로."""
        changed = dict(self.features, telecom_late_months=5, utility_late_months=5, si_arrears_any=1)
        self.assertEqual(score_features(changed)["traditional"], self.result["traditional"])
        self.assertNotEqual(score_features(changed)["alternative"]["score"], self.result["alternative"]["score"])

    def test_extreme_inputs_stay_in_range(self):
        worst = {c: None for c in catalog.ALTERNATIVE_CODES}
        worst.update(DQ1200001=7, LA0099212=800_000_000, CL0631905=180, telecom_late_months=12,
                     utility_late_months=12, dsr_svc_12m=21.5, income_cv_svc_12m=1.2)
        r = score_features(worst)
        self.assertTrue(0 <= r["alternative"]["score"] <= 1000)
        self.assertEqual(r["shap"]["baseScore"] + sum(f["shapScore"] for f in r["shap"]["factors"]),
                         r["alternative"]["score"])


class SimulationTest(unittest.TestCase):
    """ML-04: 바꾸기 전·후와 영향 나누기."""

    def setUp(self):
        self.snapshot = build_features(ScoreRequest(**sample_request()))

    def test_no_changes_no_delta(self):
        r = simulate(self.snapshot, {})
        self.assertEqual(r["delta"], {"total": 0, "financialEffect": 0, "alternativeEffect": 0})

    def test_delta_split_adds_up(self):
        r = simulate(self.snapshot, {"TELECOM_ON_TIME_MONTHS": 12, "DELINQ_COUNT_12M": 0, "UTILITY_LATE_MONTHS": 0,
                                     "CARD_LIMIT_AMT": 5_000_000, "CARD_MONTHLY_SPEND_AMT": 500_000})
        d = r["delta"]
        self.assertEqual(d["financialEffect"] + d["alternativeEffect"], d["total"])
        self.assertEqual(d["total"], r["after"]["score"] - r["before"]["score"])
        self.assertGreater(d["total"], 0)

    def test_top_reduction_factors_are_simulatable_negatives(self):
        r = simulate(self.snapshot, {})
        self.assertLessEqual(len(r["topReductionFactors"]), 3)
        for f in r["topReductionFactors"]:
            self.assertEqual(catalog.FEATURE_BY_CODE[f["featureCode"]].simulatable_yn, "Y")
            self.assertLess(f["shapScore"], 0)
            self.assertGreaterEqual(f["recoverScore"], 0)


class ScoreEndpointRuleTest(unittest.TestCase):
    """ML-03 엔드포인트 함수를 직접 불러 응답·오류 규칙을 검사한다(서버를 켜지 않음)."""

    def test_response_versions_and_snapshot(self):
        r = score(ScoreRequest(**sample_request()), None)
        self.assertEqual((r["modelVersion"], r["featureSetVersion"], r["cutoffVersion"]),
                         ("DEV-DUMMY", "FS-DRAFT", "CUT-0.1"))
        self.assertEqual(r["requestId"], REQUEST_ID)
        self.assertEqual(len(r["featureSnapshot"]), 39)

    def test_version_mismatch_409(self):
        with self.assertRaises(ApiError) as e:
            score(ScoreRequest(**sample_request(expectedModelVersion="OLD")), None)
        self.assertEqual((e.exception.status, e.exception.code), (409, "VERSION_MISMATCH"))

    def test_income_count_422(self):
        body = sample_request()
        body["incomeMonths"] = body["incomeMonths"][:11]
        with self.assertRaises(ApiError) as e:
            score(ScoreRequest(**body), None)
        self.assertEqual((e.exception.status, e.exception.code), (422, "INVALID_INPUT"))

    def test_request_id_must_be_lowercase_uuid(self):
        with self.assertRaises(ApiError) as e:
            score(ScoreRequest(**sample_request(requestId=REQUEST_ID.upper())), None)
        self.assertEqual(e.exception.status, 422)

    def test_mock_scenarios(self):
        for scenario, status in (("MODEL_ERROR", 500), ("NOT_READY", 503)):
            with self.assertRaises(ApiError) as e:
                score(ScoreRequest(**sample_request()), scenario)
            self.assertEqual(e.exception.status, status)


if __name__ == "__main__":
    unittest.main()
