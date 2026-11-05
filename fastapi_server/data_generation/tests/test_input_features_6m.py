"""Fixed-fixture checks for generate/build_input_features_6m.py (v3.5.7): no generator run, no file write.
v3.5.11부터 집계 기간은 anchors의 model_feature_months(최근 6개월)이고, 기간 확인을 위해 anchors 파일만 읽는다."""
import json, unittest
from pathlib import Path
import numpy as np
import pandas as pd
from generate.build_input_features_6m import input_features_6m, input_months, COLUMNS

ANCHORS = json.loads((Path(__file__).resolve().parents[1]/'reference/service_dummy_anchors.json').read_text(encoding='utf-8'))

MONTHS = [f'2025-{m:02d}' for m in range(9, 13)] + [f'2026-{m:02d}' for m in range(1, 9)]


def monthly(income_by_month, expense=500_000, debt=100_000, cid='C1'):
    return pd.DataFrame([dict(customer_id=cid, month=m, income_krw=income_by_month.get(m, 1_000_000),
                              expense_total_krw=expense, debt_service_krw=debt) for m in MONTHS])


class InputFeatures6m(unittest.TestCase):
    def test_window_is_the_member_input_months(self):
        """집계 기간(model_feature_months)이 회원 입력 기간(input_months, 12개월)의 마지막 6개월인지 본다. 이름은 v3.5.7 그대로 유지한다."""
        self.assertEqual(input_months(), MONTHS[-6:])
        self.assertEqual(ANCHORS['members']['input_months']['value'], MONTHS)

    def test_only_the_last_six_months_count(self):
        h = monthly({'2025-09': 0, '2025-10': 9_000_000, '2026-08': 0})      # first two months are outside the window
        pay = pd.DataFrame(dict(customer_id=['C1', 'C1'], month=['2025-12', '2026-05'], payment_amount_krw=[700_000, 50_000]))
        f = input_features_6m(h, pay, input_months()).iloc[0]
        self.assertEqual(list(f.index), COLUMNS)
        self.assertEqual(f.income_6m_krw, 5_000_000)
        self.assertEqual((f.expense_6m_krw, f.debt_service_6m_krw), (3_000_000, 600_000))
        self.assertAlmostEqual(f.dsr_6m, 0.12)
        self.assertAlmostEqual(f.expense_ratio_6m, 0.6)
        self.assertEqual((f.zero_income_months_6m, f.deficit_months_6m), (1, 1))
        self.assertEqual(f.worst_month_net_cash_6m_krw, -600_000)
        self.assertEqual(f.dp_payment_amount_6m_krw, 50_000)                 # December payment is outside the window
        self.assertAlmostEqual(f.dp_amount_to_income_6m, 0.01)
        x = np.array([1_000_000] * 5 + [0]); self.assertAlmostEqual(f.income_cv_6m, x.std() / x.mean())

    def test_zero_income_gives_null_ratios_not_zero(self):
        h = monthly({m: 0 for m in MONTHS})
        f = input_features_6m(h, h.iloc[0:0].assign(payment_amount_krw=0), input_months()).iloc[0]
        self.assertTrue(pd.isna(f.dsr_6m) and pd.isna(f.expense_ratio_6m) and pd.isna(f.income_cv_6m) and pd.isna(f.dp_amount_to_income_6m))
        self.assertEqual(f.zero_income_months_6m, 6)

    def test_missing_month_stops(self):
        h = monthly({})
        with self.assertRaises(ValueError):
            input_features_6m(h[h.month != '2026-04'], h.iloc[0:0].assign(payment_amount_krw=0), input_months())


if __name__ == '__main__':
    unittest.main()
