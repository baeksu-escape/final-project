"""N-05-2·N-12 기본 12개월 집계와 6개월 보존·독립 이상치 정책을 고정 예제로 검증한다."""
import json
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from generate.build_input_features_12m import input_features_12m, input_months, anomaly_spec, COLUMNS
from generate.build_input_features_6m import input_features_6m, input_months as six_months
from generate.synthesis_logic import inject_anomalies

MONTHS = [f'2025-{m:02d}' for m in range(9, 13)] + [f'2026-{m:02d}' for m in range(1, 9)]


def monthly(incomes=None, cid='C1'):
    """앞·뒤 6개월의 차이를 확인할 수 있는 월별 입력을 만든다."""
    incomes = incomes or {}
    return pd.DataFrame([dict(customer_id=cid, month=m, income_krw=incomes.get(m, 1_000_000),
                              expense_total_krw=500_000, debt_service_krw=100_000) for m in MONTHS])


def payments():
    """집계 범위 안과 밖의 간편결제 내역을 분리해 둔다."""
    return pd.DataFrame(dict(customer_id=['C1'] * 3, month=['2025-08', '2025-12', '2026-05'],
                             payment_amount_krw=[9_000_000, 700_000, 50_000]))


class InputFeatures12m(unittest.TestCase):
    """12개월 수치·기간·결측 의미와 6개월 수치 보존을 확인한다."""
    def test_window_and_every_aggregate(self):
        """앞 6개월의 실제 값을 포함해 합계와 파생값을 검증한다."""
        self.assertEqual(input_months(), MONTHS)
        self.assertEqual(six_months(), MONTHS[-6:])
        h = monthly({'2025-09': 0, '2025-10': 9_000_000, '2026-08': 0})
        f = input_features_12m(h, payments(), MONTHS).iloc[0]
        self.assertEqual(list(f.index), COLUMNS)
        self.assertEqual(f.income_12m_krw, 18_000_000)
        self.assertEqual((f.expense_12m_krw, f.debt_service_12m_krw), (6_000_000, 1_200_000))
        self.assertAlmostEqual(f.expense_ratio_12m, 1/3)
        self.assertAlmostEqual(f.dsr_12m, 1/15)
        self.assertAlmostEqual(f.income_cv_12m, np.array([0, 9_000_000] + [1_000_000]*9 + [0]).std()/1_500_000)
        self.assertEqual((f.zero_income_months_12m, f.deficit_months_12m, f.worst_month_net_cash_12m_krw), (2, 2, -600_000))
        self.assertEqual(f.dp_payment_amount_12m_krw, 750_000)
        self.assertAlmostEqual(f.dp_amount_to_income_12m, 1/24)
        old = input_features_6m(h, payments(), six_months()).iloc[0]
        self.assertEqual(old.income_6m_krw, 5_000_000)
        self.assertEqual(old.dp_payment_amount_6m_krw, 50_000)

    def test_zero_income_and_no_payment(self):
        """무소득은 0으로, 나눌 수 없는 비율은 NULL로 구별한다."""
        f = input_features_12m(monthly({m: 0 for m in MONTHS}), payments().iloc[:0], MONTHS).iloc[0]
        for c in ['expense_ratio_12m', 'dsr_12m', 'income_cv_12m', 'dp_amount_to_income_12m']:
            self.assertTrue(pd.isna(f[c]), c)
        self.assertEqual(f.zero_income_months_12m, 12)
        self.assertEqual(f.dp_payment_amount_12m_krw, 0)

    def test_missing_duplicate_and_null_months_rejected(self):
        """누락·중복·미관측 월을 0원으로 처리하지 않는다."""
        h = monthly()
        null = h.copy(); null.loc[0, 'income_krw'] = np.nan
        for invalid in [h.iloc[1:], pd.concat([h, h.iloc[:1]]), null]:
            with self.subTest(rows=len(invalid)), self.assertRaises(ValueError):
                input_features_12m(invalid, payments(), MONTHS)
        for invalid in [MONTHS[-6:], MONTHS[::-1], MONTHS[:-1]+[MONTHS[0]]]:
            with self.assertRaises(ValueError):
                input_features_12m(h, payments(), invalid)

    def test_outside_window_ignored_and_customer_coverage(self):
        """범위 밖 달은 제외하고 모든 고객에 12개월이 있는지 확인한다."""
        h = monthly(); extra = h.iloc[:1].assign(month='2025-08', income_krw=999_000_000)
        pd.testing.assert_frame_equal(input_features_12m(h, payments(), MONTHS),
                                      input_features_12m(pd.concat([extra, h]), payments(), MONTHS))
        with self.assertRaises(ValueError):
            input_features_12m(pd.concat([h, extra.assign(customer_id='C2')]), payments(), MONTHS)

    def test_independent_anomalies_reproducible_and_restorable(self):
        """주입된 칸·건수·원래 값과 깨끗한 파생값을 대조한다."""
        source = input_features_12m(pd.concat([monthly(cid=f'C{i:04}') for i in range(1000)]), payments(), MONTHS)
        spec = anomaly_spec()
        root = Path(__file__).resolve().parents[1]
        old = json.loads((root/'reference/anomaly_injection.json').read_text(encoding='utf-8'))
        self.assertNotEqual(spec['seed']['value'], old['seed']['value'])
        seed = [spec['seed']['value'], 0]
        got, log = inject_anomalies(source, spec, np.random.default_rng(seed))
        repeated, repeated_log = inject_anomalies(source, spec, np.random.default_rng(seed))
        pd.testing.assert_frame_equal(got, repeated); pd.testing.assert_frame_equal(log, repeated_log)
        self.assertFalse(log.duplicated(['customer_id', 'column']).any())
        expected = {(r['type'], c): int(len(source)*r['rate']['value']+0.5) for r in spec['rules'] for c in r['columns']}
        self.assertEqual(log.groupby(['anomaly_type', 'column']).size().to_dict(), expected)
        restored = got.set_index('customer_id').copy()
        for r in log.itertuples():
            self.assertEqual(r.original_value, source.set_index('customer_id').loc[r.customer_id, r.column])
            value = restored.loc[r.customer_id, r.column]
            if r.anomaly_type == 'missing':
                self.assertTrue(pd.isna(value))
            else:
                self.assertEqual(value, r.original_value*(1000 if r.anomaly_type == 'unit_error' else -1))
            restored.loc[r.customer_id, r.column] = r.original_value
        pd.testing.assert_frame_equal(restored.reset_index(), source, check_dtype=False)
        dirty_columns = set(log.column)
        pd.testing.assert_frame_equal(got.drop(columns=list(dirty_columns)), source.drop(columns=list(dirty_columns)))


if __name__ == '__main__':
    unittest.main()
