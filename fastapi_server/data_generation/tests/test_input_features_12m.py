"""N-05-2·N-12 기본 12개월 집계와 6개월 보존·독립 이상치 정책을 고정 예제로 검증한다. v3.6.0 서비스 정의 열 포함."""
import json
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from generate.build_input_features_12m import input_features_12m, input_months, anomaly_spec, COLUMNS, SVC_COLUMNS, service_features_12m
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


class ServiceViewFeatures(unittest.TestCase):
    """v3.6.0 지출=평균 월 지출, 상환=기준월 상환액, 급여소득자 소득=기준월 x 12개월을 고정 예제로 확인한다."""
    def frames(self):
        incomes = {'2025-09': 0, '2025-10': 9_000_000, '2026-08': 2_000_000}
        a = monthly(incomes, cid='S1')                                   # 자영업자: 소득 그대로
        b = monthly(incomes, cid='W1')                                   # 급여소득자: 기준월 소득 2,000,000 x 12
        for h in (a, b):
            h['expense_total_krw'] = [400_000] * 11 + [1_000_001]       # 평균 450,000.08 -> 450,000
            h['debt_service_krw'] = [100_000] * 11 + [300_000]          # 기준월 상환 300,000
        prof = pd.DataFrame(dict(customer_id=['S1', 'W1'], segment=['selfemp', 'wage']))
        return pd.concat([a, b], ignore_index=True), prof

    def test_values(self):
        h, prof = self.frames()
        f = service_features_12m(h, prof, MONTHS).set_index('customer_id')
        self.assertEqual(list(f.columns), SVC_COLUMNS)
        s, w = f.loc['S1'], f.loc['W1']
        self.assertEqual((s.expense_avg_month_krw, s.debt_service_current_krw), (450_000, 300_000))
        self.assertEqual(s.income_svc_12m_krw, 20_000_000)
        self.assertAlmostEqual(s.expense_ratio_svc_12m, 450_000 * 12 / 20_000_000)
        self.assertAlmostEqual(s.dsr_svc_12m, 300_000 * 12 / 20_000_000)
        # 월 소득(0, 9,000,000, 1,000,000 x 9, 2,000,000)에서 평균 지출 + 기준월 상환 750,000을 빼면 0원인 달만 적자다.
        self.assertEqual((s.zero_income_months_svc_12m, s.deficit_months_svc_12m, s.worst_month_net_cash_svc_12m_krw), (1, 1, -750_000))
        self.assertEqual(w.income_svc_12m_krw, 24_000_000)
        self.assertEqual((w.income_cv_svc_12m, w.zero_income_months_svc_12m, w.deficit_months_svc_12m), (0, 0, 0))
        self.assertEqual(w.worst_month_net_cash_svc_12m_krw, 2_000_000 - 750_000)

    def test_average_expense_round_half_up_at_exact_half(self):
        """v3.6.0: 평균이 정확히 .5이면 올린다(ROUND_HALF_UP). numpy 기본(짝수 쪽)과 다른 경계를 두 개 본다."""
        h, prof = self.frames()
        for total_extra, want in [(6, 400_001), (18, 400_002), (5, 400_000), (7, 400_001)]:
            for cid in ('S1', 'W1'):
                h.loc[h.customer_id == cid, 'expense_total_krw'] = [400_000] * 11 + [400_000 + total_extra]
            f = service_features_12m(h, prof, MONTHS).set_index('customer_id')
            self.assertEqual(f.loc['S1', 'expense_avg_month_krw'], want, total_extra)    # 400,000.5 -> 400,001 (rint는 400,000)
            self.assertAlmostEqual(f.loc['S1', 'expense_ratio_svc_12m'], want * 12 / 20_000_000)

    def test_zero_income_ratios_null_and_missing_segment_rejected(self):
        h, prof = self.frames()
        h.loc[h.customer_id == 'S1', 'income_krw'] = 0
        f = service_features_12m(h, prof, MONTHS).set_index('customer_id')
        for c in ['income_cv_svc_12m', 'expense_ratio_svc_12m', 'dsr_svc_12m']:
            self.assertTrue(pd.isna(f.loc['S1', c]), c)
        with self.assertRaises(ValueError):
            service_features_12m(h, prof.iloc[:1], MONTHS)
        with self.assertRaises(ValueError):
            service_features_12m(h[h.month != '2026-01'], prof, MONTHS)

    def test_svc_anomaly_spec_is_separate(self):
        old, svc = anomaly_spec(), anomaly_spec('anomaly_injection_12m_svc.json')
        self.assertNotEqual(old['seed']['value'], svc['seed']['value'])
        self.assertNotEqual(old['log_file'], svc['log_file'])
        targets = {c for r in svc['rules'] for c in r['columns']}
        self.assertTrue(targets <= set(SVC_COLUMNS))
        self.assertFalse(targets & set(COLUMNS))


if __name__ == '__main__':
    unittest.main()
