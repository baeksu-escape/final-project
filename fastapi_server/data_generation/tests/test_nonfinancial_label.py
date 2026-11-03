"""Fixed-fixture / simulated checks for arrears and nonfinancial-label logic.
No project generator is run and no project data is written."""
import json
import unittest
from pathlib import Path
import numpy as np
from scipy.special import expit
from generate import nonfinancial_label as nl
from generate.synthesis_logic import arrears_flags, arrears_months

CFG = json.loads((Path(__file__).resolve().parents[1]/'reference/nonfinancial_label.json').read_text(encoding='utf-8'))


class Arrears(unittest.TestCase):
    def test_risk_multiplier_and_cap(self):
        u = np.full(4, .5)
        _, _, p_util, p_tel = arrears_flags([.1, .1, .5, .5], .03, .25, [0, 1, 0, 1], 3.0, u, u)
        np.testing.assert_allclose(p_util, [.1, .3, .5, .95])
        util = u < p_util
        np.testing.assert_allclose(p_tel, np.minimum((.03 + .25*util)*np.array([1, 3, 1, 3]), .95))

    def test_runs_are_contiguous_and_reconcile_with_flags(self):
        rng = np.random.default_rng(0)
        flags = rng.random(5000) < .3
        late = arrears_months(flags, 12, .3, rng.random(5000), rng.random((5000, 12)))
        np.testing.assert_array_equal(late.sum(1) > 0, flags)
        for row in late[flags]:
            idx = np.flatnonzero(row)
            self.assertTrue(np.all(np.diff(idx) == 1))      # one contiguous run
        mean_len = late[flags].sum(1).mean()
        self.assertTrue(1.2 < mean_len < 1.5)                 # about 1/(1-0.3) before truncation

    def test_persistence_extremes(self):
        f = np.array([1, 1]); u0 = np.array([.0, .5])
        np.testing.assert_array_equal(arrears_months(f, 4, 0., u0, np.zeros((2, 4))).sum(1), [1, 1])
        np.testing.assert_array_equal(arrears_months(f, 4, 1., u0, np.zeros((2, 4))).sum(1), [4, 2])


class Label(unittest.TestCase):
    def test_intercept_hits_target_rate(self):
        logit = np.random.default_rng(1).normal(-2, 1, 10000)
        a = nl.calibrate_intercept(logit, .07)
        self.assertAlmostEqual(expit(logit + a).mean(), .07, places=8)

    def test_conditional_odds_ratio_is_recovered(self):
        rng = np.random.default_rng(2)
        n = 400_000
        base = rng.normal(0, 1.2, n)
        bill = (rng.random(n) < expit(-2.5 + .8*base)).astype(int)   # arrears correlated with financial risk
        cf = rng.normal(0, 1, n)
        p = nl.effect_probability(base, bill, cf, CFG['bill_arrears_odds_ratio']['value'], 0., .10)
        y = nl.draw_labels(p, rng.random(n))
        strata = np.digitize(base, np.quantile(base, np.linspace(0, 1, 41)[1:-1]))
        or_mh = nl.mantel_haenszel_or(y, bill, strata)
        self.assertAlmostEqual(or_mh, 2.5, delta=.15)
        self.assertAlmostEqual(y.mean(), .10, delta=.003)
        crude = (y[bill == 1].mean()/(1-y[bill == 1].mean()))/(y[bill == 0].mean()/(1-y[bill == 0].mean()))
        self.assertGreater(crude, or_mh)                       # unadjusted association is larger, as in PERC

    def test_ineligible_customers_never_positive(self):
        rng = np.random.default_rng(3)
        base = rng.normal(0, 1, 1000); mask = rng.random(1000) < .35
        p = nl.effect_probability(base, np.zeros(1000), np.zeros(1000), 2.5, .15, .12, mask=mask)
        self.assertTrue((p[~mask] == 0).all())
        self.assertAlmostEqual(p[mask].mean(), .12, places=6)

    def test_cashflow_effect_is_weak(self):
        rng = np.random.default_rng(4)
        n = 200_000
        base = np.zeros(n); cf = rng.normal(0, 1, n)
        p = nl.effect_probability(base, np.zeros(n), cf, 2.5, CFG['cashflow_logit_per_sd']['value'], .10)
        ratio = p[cf > 1].mean() / p[cf < -1].mean()
        self.assertTrue(1.2 < ratio < 1.8)                     # weak gradient, far below the bill effect

    def test_base_logit_uses_only_fit_rows(self):
        rng = np.random.default_rng(5)
        x = rng.normal(size=(2000, 3)); y = (rng.random(2000) < expit(x[:, 0])).astype(int)
        mask = np.arange(2000) < 1000
        a = nl.base_logit(x, y, mask); y2 = y.copy(); y2[~mask] = 1 - y2[~mask]
        np.testing.assert_allclose(a, nl.base_logit(x, y2, mask))


if __name__ == '__main__':
    unittest.main()
