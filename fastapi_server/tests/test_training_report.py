# FP-131 기본 통계 보고서의 계산 함수 검사 — 작은 합성 표로 결측·상한 초과·범주 집계가 맞는지 본다.
# 실행: fastapi_server 폴더에서 `python -m unittest discover tests -v`
import subprocess
import sys
import unittest

import numpy as np
import pandas as pd

from training import config
from training.data_report import (
    DEFAULT_REPORT_PATH, build_report, catalog_difference, category_counts, label_check, limit_violation_counts, md_table,
    missing_counts, numeric_summary,
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


class LabelCheckAndSummaryTests(unittest.TestCase):
    """FP-130 라벨 검증, FP-131 평균 열."""

    def test_label_check_ok(self):
        result = label_check(pd.DataFrame({"y": [0, 1, 0, 0]}), "y")
        self.assertEqual((result["rows"], result["missing"], result["positives"]), (4, 0, 1))
        self.assertAlmostEqual(result["positive_rate"], 0.25)
        self.assertTrue(result["values_ok"] and result["ok"])

    def test_label_check_flags_non_binary_values(self):
        result = label_check(pd.DataFrame({"y": [0, 1, 2]}), "y")
        self.assertFalse(result["values_ok"])
        self.assertFalse(result["ok"])

    def test_label_check_flags_missing(self):
        result = label_check(pd.DataFrame({"y": [0, 1, np.nan]}), "y")
        self.assertEqual(result["missing"], 1)
        self.assertTrue(result["values_ok"])       # 값 자체는 0/1뿐이지만 결측이 있어 통과가 아니다
        self.assertFalse(result["ok"])

    def test_numeric_summary_mean_is_last_column_and_ignores_missing(self):
        rows = numeric_summary(pd.DataFrame({"x": [1.0, 2.0, 6.0, np.nan]}), ["x"])
        self.assertEqual(len(rows[0]), 7)           # 이름 + 최소·25%·중앙값·75%·최대·평균
        self.assertEqual(rows[0][6], "3")           # (1+2+6)/3
        self.assertEqual(rows[0][1], "1")           # 기존 열 위치는 그대로(최소)
        self.assertEqual(rows[0][5], "6")           # 최대


def synthetic_split_table() -> pd.DataFrame:
    """보고서 전체 생성(build_report)을 시험할 작은 합성 표. TEST 행은 일부러 라벨을 1로 넣어 보고서가 쓰지 않는지 본다."""
    rows = []
    for split, count in [("TRAIN", 6), ("VALID", 4), ("TEST", 3)]:
        for i in range(count):
            row = {name: 1.0 for name in config.ALTERNATIVE_FEATURES}
            row.update({column: values[0] for column, values in config.CATEGORY_CODES.items()})
            row.update({"data_split": split, "label_any_delinquency_12m": i % 2 if split != "TEST" else 1,
                        "label_nonfin_effect_12m": i % 2 if split != "TEST" else 1})
            rows.append(row)
    return pd.DataFrame(rows)


class BuildReportTests(unittest.TestCase):
    def setUp(self):
        self.report = build_report(synthetic_split_table(), "0123456789abcdef")

    def test_has_label_check_section_and_ok_message(self):
        self.assertIn("### 라벨 검증 (FP-130)", self.report)
        self.assertIn("두 라벨 모두 TRAIN·VALID에서 값이 0/1뿐이고 결측이 없다", self.report)

    def test_test_split_only_counts_rows(self):
        self.assertIn("| TEST | 3 | (보지 않음) | (보지 않음) |", self.report)
        self.assertNotIn("| `label_any_delinquency_12m` | TEST |", self.report)   # 라벨 검증 표에 TEST 행이 없다

    def test_warns_when_label_is_not_binary(self):
        table = synthetic_split_table()
        table.loc[0, "label_any_delinquency_12m"] = 2
        report = build_report(table, "0123456789abcdef")
        self.assertIn("**경고:**", report)


class ImportLightnessTests(unittest.TestCase):
    def test_data_report_does_not_need_lightgbm_or_shap(self):
        """보고서만 만들 때 학습 라이브러리가 필요 없어야 한다(train.py에서 공통 함수를 분리한 이유)."""
        code = ("import sys; import training.data_report; "
                "assert 'lightgbm' not in sys.modules and 'shap' not in sys.modules, sorted(m for m in sys.modules if m in ('lightgbm', 'shap'))")
        result = subprocess.run([sys.executable, "-c", code], cwd=config.FASTAPI_ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
