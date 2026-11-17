# FP-131 기본 통계 보고서의 계산 함수 검사 — 작은 합성 표로 결측·상한 초과·범주 집계가 맞는지 본다.
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import unittest

import numpy as np
import pandas as pd

from training import config
from training.data_report import (
    DEFAULT_REPORT_PATH, catalog_difference, category_counts, limit_violation_counts, md_table, missing_counts, numeric_summary,
)


class ReportFunctionTests(unittest.TestCase):
    def test_missing_counts(self):
        df = pd.DataFrame({"a": [1, np.nan, 3], "b": [np.nan, np.nan, 1]})
        self.assertEqual(missing_counts(df, ["a", "b"]), {"a": 1, "b": 2})

    def test_limit_violation_counts(self):
        df = pd.DataFrame({
            "income_svc_12m_krw": [1_000_000, config.INCOME_SUM_MAX_KRW + 1, config.INCOME_SUM_MAX_KRW, np.nan],
            "expense_avg_month_krw": [1_000, 1_000, config.EXPENSE_AVG_MAX_KRW + 1, 1_000],
            "debt_service_current_krw": [0, -1, 5, 5],
        })
        counts = limit_violation_counts(df)
        self.assertEqual(counts["income_svc_12m_krw"], 1)    # 상한과 같은 값은 넘은 것이 아니다
        self.assertEqual(counts["expense_avg_month_krw"], 1)
        self.assertEqual(counts["debt_service_current_krw"], 1)   # 0은 음수가 아니다
        self.assertEqual(counts["any"], 2)                       # 행 1은 소득·상환액에 함께 걸려 한 행으로 센다, 행 2는 지출

    def test_numeric_summary_ignores_missing(self):
        rows = numeric_summary(pd.DataFrame({"x": [1.0, 2.0, 3.0, np.nan]}), ["x"])
        self.assertEqual(rows[0][0], "x")
        self.assertEqual(rows[0][1], "1")      # 최소
        self.assertEqual(rows[0][3], "2")      # 중앙값
        self.assertEqual(rows[0][5], "3")      # 최대

    def test_category_counts_reports_unknown_values_and_missing(self):
        df = pd.DataFrame({column: [values[0]] * 2 for column, values in config.CATEGORY_CODES.items()})
        df.loc[0, "np_payer_type"] = "voluntary"
        df.loc[1, "segment"] = None
        rows = {row[0]: row for row in category_counts(df)}
        self.assertEqual(rows["`np_payer_type`"][2], 1)
        self.assertEqual(rows["`segment`"][2], 1)
        self.assertEqual(rows["`hi_payer_type`"][2], 0)

    def test_catalog_difference_is_only_lrz(self):
        """학습 피처와 서비스 피처 사전의 차이는 C9로 뺀 LRZ021201 하나뿐이다."""
        self.assertEqual(catalog_difference(), {"only_service": ["LRZ021201"], "only_training": []})

    def test_md_table(self):
        self.assertEqual(md_table(["a", "b"], [[1, 2]]), "| a | b |\n|---|---|\n| 1 | 2 |")

    def test_default_report_path_is_under_docs_spec(self):
        self.assertEqual(DEFAULT_REPORT_PATH.parts[-3:], ("docs", "spec", "training_data_report.md"))


if __name__ == "__main__":
    unittest.main()
