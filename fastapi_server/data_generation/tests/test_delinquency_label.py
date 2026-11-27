"""N-12-2 v3.7.0 연체 라벨 재설계와 소득·지출 생성 규칙을 고정 예제로 검증한다. 생성 데이터를 읽지 않는다."""
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from generate import delinquency_label as dl
from generate.build_data_split import assign_splits, config as split_config, keep_train_ids, strata_frame
from generate.build_delinquency_label import build
from generate.extend import apply_income_floor, build as extend_build

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT/'reference/delinquency_label.json').read_text(encoding='utf-8'))


def people(n=1, **change):
    """효과 항목이 모두 같은 고객 n명."""
    base = dict(annual_income_krw=40_000_000, annual_debt_service_krw=6_000_000, debt_balance_krw=20_000_000, expense_ratio=0.5,
                deficit_months=0, zero_income_months=0, CL0631905=20.0, LA0099212=0, L22000900=0, CF1231605=0)
    base.update(change)
    return pd.DataFrame([base] * n)


class Effects(unittest.TestCase):
    def logit(self, **change):
        # 두 명을 함께 넣어 소득 중앙값이 비교 대상과 섞이지 않게, 기준 고객과 바꾼 고객을 한 표에서 비교한다.
        frame = pd.concat([people(3), people(1, **change)], ignore_index=True)
        out = dl.effect_logit(frame, CFG['effects'])
        return float(out[-1] - out[0])

    def test_riskier_values_raise_the_logit(self):
        for change in (dict(annual_debt_service_krw=12_000_000), dict(debt_balance_krw=60_000_000), dict(expense_ratio=0.8),
                       dict(deficit_months=6), dict(zero_income_months=2), dict(CL0631905=90.0), dict(LA0099212=1000),
                       dict(L22000900=1), dict(CF1231605=3)):
            self.assertGreater(self.logit(**change), 0, change)

    def test_odds_ratio_is_applied_per_unit(self):
        self.assertAlmostEqual(self.logit(deficit_months=6), np.log(1.15))
        self.assertAlmostEqual(self.logit(LA0099212=5000), np.log(1.4))
        self.assertAlmostEqual(self.logit(L22000900=2), 2 * np.log(1.15))

    def test_higher_income_lowers_the_logit(self):
        # 비율 항목이 같도록 금액을 함께 두 배로 하면 소득 효과만 남는다.
        self.assertAlmostEqual(self.logit(annual_income_krw=80_000_000, annual_debt_service_krw=12_000_000, debt_balance_krw=40_000_000), np.log(0.85))

    def test_values_are_clipped(self):
        self.assertAlmostEqual(self.logit(L22000900=3), self.logit(L22000900=9))
        self.assertAlmostEqual(self.logit(CL0631905=150.0), self.logit(CL0631905=180.0))

    def test_missing_card_utilization_is_zero_but_other_nulls_are_errors(self):
        self.assertAlmostEqual(self.logit(CL0631905=np.nan), self.logit(CL0631905=0.0))
        with self.assertRaises(ValueError):
            dl.effect_logit(people(1, LA0099212=np.nan), CFG['effects'])


class BuildThinfile(unittest.TestCase):
    """씬파일 방식(설계 확률에서 원본 logit)으로 build를 끝까지 실행한다. 원본 생성기는 부르지 않는다."""

    def setUp(self):
        self.t = Path(tempfile.mkdtemp())
        n = 400
        rng = np.random.default_rng(3)
        ids = [f'THF{i:08d}' for i in range(n)]
        profiles = people(n).drop(columns=['CL0631905', 'LA0099212', 'L22000900', 'CF1231605'])
        profiles.insert(0, 'customer_id', ids)
        profiles['annual_debt_service_krw'] = rng.integers(0, 30_000_000, n)
        profiles['segment'] = 'wage'
        profiles['cohort'] = 'a'
        profiles['label_any_delinquency_12m'] = 0
        profiles['dsr'] = 0.123456789012345
        profiles.to_csv(self.t/'profiles.csv', index=False, encoding='utf-8-sig')
        self.eligible = (np.arange(n) % 4 != 0).astype(int)
        base = pd.DataFrame({'식별구분': ids, '결과값(연체회차)': ((np.arange(n) % 7 == 1) & (self.eligible == 1)).astype(int),
                             'CL0631905': 20.0, 'LA0099212': 0, 'L22000900': 0, 'CF1231605': 0})
        base.to_csv(self.t/'base_207.csv', index=False, encoding='utf-8-sig')
        pd.DataFrame({'customer_id': ids, 'future_credit_exposure': self.eligible,
                      'target_design_probability': np.where(self.eligible == 1, 0.1, 0.0)}).to_csv(self.t/'target_metadata.csv', index=False, encoding='utf-8-sig')
        profiles[['customer_id', 'label_any_delinquency_12m']].to_csv(self.t/'model_inputs.csv', index=False, encoding='utf-8-sig')
        pd.DataFrame({'cohort': ['a'], 'label_rate': [0.0]}).to_csv(self.t/'cohort_summary.csv', index=False, encoding='utf-8-sig')

    def read(self, name):
        return pd.read_csv(self.t/name, encoding='utf-8-sig', float_precision='round_trip')

    def test_label_rate_eligibility_files_and_idempotence(self):
        before = self.read('profiles.csv')
        summary = build(self.t, CFG, 1, True)
        after, meta = self.read('profiles.csv'), self.read('labels_delinquency_metadata.csv')
        pd.testing.assert_frame_equal(before.drop(columns='label_any_delinquency_12m'), after.drop(columns='label_any_delinquency_12m'))
        self.assertTrue((after.label_any_delinquency_12m[self.eligible == 0] == 0).all())
        self.assertAlmostEqual(meta.design_probability[self.eligible == 1].mean(), summary['target_rate'], places=6)
        np.testing.assert_array_equal(self.read('model_inputs.csv').label_any_delinquency_12m, after.label_any_delinquency_12m)
        self.assertAlmostEqual(self.read('cohort_summary.csv').label_rate[0], after.label_any_delinquency_12m.mean())
        first = (self.t/'profiles.csv').read_bytes()
        build(self.t, CFG, 1, True)
        self.assertEqual((self.t/'profiles.csv').read_bytes(), first)    # 원래 라벨에서 다시 계산하므로 같은 결과


class InputRules(unittest.TestCase):
    """extend.build의 v3.7.0 소득·지출 규칙. 설정을 끄면 이전 방식이다."""

    @classmethod
    def setUpClass(cls):
        n = 300
        rng = np.random.default_rng(5)
        balance = rng.integers(0, 300_000, n)
        cls.source = pd.DataFrame({'식별구분': [f'SYN{i:09d}' for i in range(1, n + 1)], 'HAC_CD': [['1', '2', '7'][i % 3] for i in range(n)],
                                   'C00000090': 1000, 'L23003700': 800, 'L00000002': balance, 'LRZ021201': (balance * 0.4).astype(int),
                                   'SP': 0, 'DQ1200001': 0, '결과값(연체회차)': (np.arange(n) % 10 == 0).astype(int)})
        cfg = json.loads((ROOT/'extension_config.json').read_text(encoding='utf-8'))
        cfg['rows'] = 0
        prior = yaml.safe_load((ROOT/'reference/claude_config.yaml').read_text(encoding='utf-8'))
        cls.rules = cfg['input_rules']
        cls.on = extend_build(cls.source, cfg, prior)
        off = dict(cfg)
        del off['input_rules']
        cls.off = extend_build(cls.source, off, prior)
        cls.disabled = extend_build(cls.source, dict(cfg, input_rules=dict(cls.rules, enabled=False)), prior)

    def test_disabled_rules_equal_the_old_output(self):
        for a, b in zip(self.off[:4], self.disabled[:4]):
            pd.testing.assert_frame_equal(a, b)

    def test_service_and_expense_stay_within_limits(self):
        p = self.on[1]
        self.assertTrue((p.annual_debt_service_krw <= p.annual_income_krw * self.rules['income_floor_dsr_range'][1] + 1).all())
        self.assertTrue((p.expense_ratio <= self.rules['expense_ratio_max'] + 1e-6).all())
        self.assertGreater((self.off[1].dsr > 1).sum(), 0)    # 예제에는 규칙이 없으면 상환액이 소득보다 큰 사람이 있다

    def test_ledger_age_and_arrays_other_than_money_are_kept(self):
        on, off = self.on[1], self.off[1]
        pd.testing.assert_frame_equal(self.on[0], self.off[0])    # 대출 원장(base)은 그대로
        for column in ('customer_id', 'age', 'segment', 'debt_balance_krw', 'annual_debt_service_krw', 'zero_income_months'):
            pd.testing.assert_series_equal(on[column], off[column])
        self.assertTrue((on.annual_income_krw >= off.annual_income_krw).all())

    def test_income_floor_uses_monthly_budget_when_given(self):
        base = self.source.iloc[:2]
        ids = base['식별구분'].to_numpy()
        budget = {str(ids[0]): [1_000_000] * 12, str(ids[1]): [0] * 12}
        out = apply_income_floor(np.array([1_000_000, 1_000_000]), base, ids, budget, [0.5, 0.5], 1)
        np.testing.assert_array_equal(out, [24_000_000, 1_000_000])
        with self.assertRaises(ValueError):
            apply_income_floor(np.array([1, 1]), base, ids, budget, [0.8, 0.4], 1)


class KeepTrainSplit(unittest.TestCase):
    RATIOS = {'TRAIN': 0.70, 'VALID': 0.15, 'TEST': 0.15}
    STRATA = ['segment', 'label_any_delinquency_12m']

    def profiles(self):
        return pd.DataFrame({'customer_id': [f'C{i:04}' for i in range(200)], 'segment': 'wage',
                             'label_any_delinquency_12m': [int(i % 5 == 0) for i in range(200)]})

    def test_kept_ids_stay_in_train_and_counts_follow_whole_stratum(self):
        p = self.profiles()
        keep = set(p.customer_id[:60])
        out = assign_splits(p, self.RATIOS, self.STRATA, np.random.default_rng(1), keep)
        self.assertEqual(list(out.customer_id), list(p.customer_id))
        self.assertTrue((out.data_split[out.customer_id.isin(keep)] == 'TRAIN').all())
        self.assertEqual(out.data_split.value_counts().to_dict(), {'TRAIN': 140, 'VALID': 30, 'TEST': 30})

    def test_too_few_new_customers_is_an_error(self):
        p = self.profiles()
        with self.assertRaises(ValueError):
            assign_splits(p, self.RATIOS, self.STRATA, np.random.default_rng(1), set(p.customer_id[:190]))

    def test_config_points_to_previous_cohort_and_thinfile_uses_original_label(self):
        cfg = split_config()
        ids = keep_train_ids(cfg, 'data')
        self.assertEqual(len(ids), 12000)
        self.assertIsNone(keep_train_ids(cfg, 'thinfile'))
        self.assertEqual(cfg['original_label_strata']['value'], ['thinfile'])
        with tempfile.TemporaryDirectory() as t:
            folder = Path(t)
            self.profiles().to_csv(folder/'profiles.csv', index=False, encoding='utf-8-sig')
            pd.DataFrame({'customer_id': self.profiles().customer_id, 'original_label': 1}).to_csv(folder/'labels_delinquency_metadata.csv', index=False, encoding='utf-8-sig')
            self.assertTrue((strata_frame(folder, self.STRATA, True).label_any_delinquency_12m == 1).all())
            pd.testing.assert_frame_equal(strata_frame(folder, self.STRATA, False), self.profiles()[['customer_id'] + self.STRATA])


if __name__ == '__main__':
    unittest.main()
