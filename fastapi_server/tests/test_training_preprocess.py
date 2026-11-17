# N-12-2 학습 전처리·설정 검사 — Python 내장 unittest만 쓴다(학습 자체는 돌리지 않는다).
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import unittest

import numpy as np
import pandas as pd

from pipeline import feature_catalog as catalog
from training import config
from training.preprocess import encode_categories, prepare


def one_row(**overrides) -> pd.DataFrame:
    """정상 값 한 행. 시험하려는 열만 overrides로 바꾼다."""
    row = {
        "income_svc_12m_krw": 40_000_000, "income_cv_svc_12m": 0.2, "zero_income_months_svc_12m": 0,
        "expense_avg_month_krw": 1_500_000, "debt_service_current_krw": 500_000,
        "expense_ratio_svc_12m": 0.45, "dsr_svc_12m": 0.15, "deficit_months_svc_12m": 1,
        "worst_month_net_cash_svc_12m_krw": 100_000,
        "segment": "wage", "np_coverage_status": "covered", "np_payer_type": "workplace",
        "hi_coverage_status": "covered", "hi_payer_type": "workplace",
    }
    row.update(overrides)
    return pd.DataFrame([row])


class FeatureListTests(unittest.TestCase):
    def test_feature_counts_and_no_lrz(self):
        self.assertEqual(len(config.LEGACY_FEATURES), 18)
        self.assertEqual(len(config.ALTERNATIVE_FEATURES), 38)
        self.assertNotIn("LRZ021201", config.ALTERNATIVE_FEATURES)  # C9로 모델에서 뺌
        self.assertEqual(len(set(config.ALTERNATIVE_FEATURES)), 38)

    def test_lists_match_service_catalog(self):
        """서비스 피처 사전(FS-DRAFT 39개)에서 LRZ021201만 뺀 것과 같아야 학습과 서비스가 갈라지지 않는다."""
        self.assertEqual(set(config.LEGACY_FEATURES), set(catalog.TRADITIONAL_CODES) - {"LRZ021201"})
        self.assertEqual(set(config.ALTERNATIVE_FEATURES), set(catalog.ALTERNATIVE_CODES) - {"LRZ021201"})

    def test_categorical_features_are_in_alternative_list(self):
        self.assertTrue(set(config.CATEGORICAL_FEATURES) <= set(config.ALTERNATIVE_FEATURES))


class PrepareTests(unittest.TestCase):
    def test_normal_row_is_unchanged(self):
        out = prepare(one_row())
        self.assertEqual(out.loc[0, "income_svc_12m_krw"], 40_000_000)
        self.assertEqual(out.loc[0, "dsr_svc_12m"], 0.15)
        self.assertEqual(out.loc[0, "deficit_months_svc_12m"], 1)

    def test_income_over_cap_makes_income_and_derived_missing(self):
        out = prepare(one_row(income_svc_12m_krw=config.INCOME_SUM_MAX_KRW + 1))
        for column in ["income_svc_12m_krw", "income_cv_svc_12m", "expense_ratio_svc_12m", "dsr_svc_12m",
                       "deficit_months_svc_12m", "worst_month_net_cash_svc_12m_krw"]:
            self.assertTrue(pd.isna(out.loc[0, column]), column)
        self.assertEqual(out.loc[0, "zero_income_months_svc_12m"], 0)   # 큰 값이 있어도 셀 수 있는 열은 그대로
        self.assertEqual(out.loc[0, "expense_avg_month_krw"], 1_500_000)

    def test_income_at_cap_is_kept(self):
        out = prepare(one_row(income_svc_12m_krw=config.INCOME_SUM_MAX_KRW))
        self.assertEqual(out.loc[0, "income_svc_12m_krw"], config.INCOME_SUM_MAX_KRW)

    def test_expense_over_cap(self):
        out = prepare(one_row(expense_avg_month_krw=config.EXPENSE_AVG_MAX_KRW + 1))
        for column in ["expense_avg_month_krw", "expense_ratio_svc_12m", "deficit_months_svc_12m",
                       "worst_month_net_cash_svc_12m_krw"]:
            self.assertTrue(pd.isna(out.loc[0, column]), column)
        self.assertEqual(out.loc[0, "dsr_svc_12m"], 0.15)                # 상환액·소득은 정상이라 그대로
        self.assertEqual(out.loc[0, "income_cv_svc_12m"], 0.2)

    def test_negative_debt_service(self):
        out = prepare(one_row(debt_service_current_krw=-1))
        for column in ["debt_service_current_krw", "dsr_svc_12m", "deficit_months_svc_12m",
                       "worst_month_net_cash_svc_12m_krw"]:
            self.assertTrue(pd.isna(out.loc[0, column]), column)
        self.assertEqual(out.loc[0, "expense_ratio_svc_12m"], 0.45)

    def test_zero_debt_service_is_not_outlier(self):
        out = prepare(one_row(debt_service_current_krw=0))
        self.assertEqual(out.loc[0, "debt_service_current_krw"], 0)

    def test_injected_missing_input_also_blanks_derived(self):
        out = prepare(one_row(debt_service_current_krw=np.nan))
        self.assertTrue(pd.isna(out.loc[0, "dsr_svc_12m"]))
        self.assertTrue(pd.isna(out.loc[0, "deficit_months_svc_12m"]))

    def test_input_frame_is_not_modified(self):
        source = one_row(income_svc_12m_krw=config.INCOME_SUM_MAX_KRW + 1)
        prepare(source)
        self.assertEqual(source.loc[0, "income_svc_12m_krw"], config.INCOME_SUM_MAX_KRW + 1)


class EncodeCategoriesTests(unittest.TestCase):
    def test_fixed_codes(self):
        out = encode_categories(one_row(segment="freelance", hi_payer_type="household"))
        self.assertEqual(out.loc[0, "segment"], 0)
        self.assertEqual(out.loc[0, "hi_payer_type"], 0)
        self.assertEqual(out.loc[0, "np_payer_type"], 2)  # workplace

    def test_unknown_value_and_missing_become_minus_one(self):
        """학습에 없는 값(voluntary, 가입 상태 unknown)과 결측은 -1. 처리 방식은 정의서 9장 미정이라 임시 동작이다."""
        out = encode_categories(one_row(np_payer_type="voluntary", np_coverage_status="unknown", hi_coverage_status=None))
        self.assertEqual(out.loc[0, "np_payer_type"], -1)
        self.assertEqual(out.loc[0, "np_coverage_status"], -1)
        self.assertEqual(out.loc[0, "hi_coverage_status"], -1)

    def test_code_table_is_stable(self):
        """번호가 바뀌면 이미 저장한 모델의 범주형 입력이 어긋난다. 표를 바꾸려면 이 시험도 의식적으로 고친다."""
        self.assertEqual(config.CATEGORY_CODES["segment"], ["freelance", "selfemp", "wage"])
        self.assertEqual(config.CATEGORY_CODES["hi_payer_type"], ["household", "regional", "unknown", "workplace"])


if __name__ == "__main__":
    unittest.main()
