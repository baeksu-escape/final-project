"""N-25 v3.6.0 학습·검증·시험 분리(generate/build_data_split.py)를 고정 예제로 검증한다. 생성 데이터를 읽지 않는다."""
import unittest
import numpy as np
import pandas as pd
from generate.build_data_split import assign_splits, split_counts, config, SPLITS

RATIOS = {'TRAIN': 0.70, 'VALID': 0.15, 'TEST': 0.15}
STRATA = ['segment', 'label_any_delinquency_12m']


def profiles():
    """칸 크기가 서로 다른 합성 고객 (wage 0: 100명, wage 1: 7명, selfemp 0: 45명, selfemp 1: 1명)."""
    rows = [('wage', 0, 100), ('wage', 1, 7), ('selfemp', 0, 45), ('selfemp', 1, 1)]
    out, k = [], 0
    for seg, lab, n in rows:
        for _ in range(n):
            out.append(dict(customer_id=f'C{k:04}', segment=seg, label_any_delinquency_12m=lab)); k += 1
    return pd.DataFrame(out)


class DataSplit(unittest.TestCase):
    def test_counts_round_down_then_largest_remainder(self):
        self.assertEqual(split_counts(100, RATIOS), dict(TRAIN=70, VALID=15, TEST=15))
        self.assertEqual(split_counts(7, RATIOS), dict(TRAIN=5, VALID=1, TEST=1))     # 4.9/1.05/1.05 -> 4/1/1, 나머지 1은 TRAIN
        self.assertEqual(split_counts(45, RATIOS), dict(TRAIN=31, VALID=7, TEST=7))   # 31.5/6.75/6.75 -> 31/6/6, 나머지 2는 나머지가 큰 VALID·TEST
        self.assertEqual(split_counts(1, RATIOS), dict(TRAIN=1, VALID=0, TEST=0))
        self.assertEqual(split_counts(0, RATIOS), dict(TRAIN=0, VALID=0, TEST=0))

    def test_every_customer_once_per_stratum_counts_and_reproducible(self):
        p = profiles()
        a = assign_splits(p, RATIOS, STRATA, np.random.default_rng([20261114, 0]))
        b = assign_splits(p, RATIOS, STRATA, np.random.default_rng([20261114, 0]))
        pd.testing.assert_frame_equal(a, b)
        self.assertEqual(list(a.customer_id), list(p.customer_id))
        self.assertTrue(a.data_split.isin(SPLITS).all())
        t = p.merge(a, on='customer_id')
        for key, g in t.groupby(STRATA):
            self.assertEqual(g.data_split.value_counts().reindex(SPLITS, fill_value=0).to_dict(), split_counts(len(g), RATIOS), key)
        other = assign_splits(p, RATIOS, STRATA, np.random.default_rng([20261114, 1]))
        self.assertFalse(a.data_split.equals(other.data_split))                       # 집단마다 다른 난수

    def test_input_order_does_not_change_assignment(self):
        p = profiles()
        a = assign_splits(p, RATIOS, STRATA, np.random.default_rng(1)).set_index('customer_id')
        b = assign_splits(p.iloc[::-1], RATIOS, STRATA, np.random.default_rng(1)).set_index('customer_id')
        pd.testing.assert_series_equal(a.data_split, b.data_split.loc[a.index])

    def test_rejects_duplicates_and_null_strata(self):
        p = profiles()
        with self.assertRaises(ValueError):
            assign_splits(pd.concat([p, p.iloc[:1]]), RATIOS, STRATA, np.random.default_rng(1))
        q = p.copy(); q.loc[0, 'segment'] = None
        with self.assertRaises(ValueError):
            assign_splits(q, RATIOS, STRATA, np.random.default_rng(1))

    def test_config_matches_decision(self):
        cfg = config()
        self.assertEqual(cfg['ratios']['value'], RATIOS)
        self.assertEqual(cfg['strata']['value'], STRATA)
        self.assertEqual(cfg['seed']['value'], 20261114)


if __name__ == '__main__':
    unittest.main()
