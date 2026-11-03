"""Fixed-fixture checks for the digital payment / social insurance rules and the v3.5.0 label terms.
No project generator is run and no project data is written."""
import json
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.special import expit
from generate import nonfinancial_sources as ns
from generate import nonfinancial_label as nl

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT/'reference/nonfinancial_sources.json').read_text(encoding='utf-8'))
SI = CFG['social_insurance']


class Calendar(unittest.TestCase):
    def test_due_date_is_tenth_of_next_month(self):
        d = ns.due_dates(['2025-12', '2026-08'], 10)
        self.assertEqual([x.strftime('%Y-%m-%d') for x in d], ['2026-01-10', '2026-09-10'])

    def test_active_days_bounds(self):
        np.testing.assert_array_equal(ns.active_days([0, 1, 3, 100], 30), [0, 1, 3, 29])
        self.assertTrue((ns.active_days(np.arange(1, 400), 30) <= 30).all())


class Payment(unittest.TestCase):
    def test_panel_rules_and_anchors(self):
        rng = np.random.default_rng(0)
        expense = np.full((20000, 12), 2_000_000.)
        p = ns.payment_panel(expense, [30]*12, CFG['digital_payment'], rng)
        self.assertTrue((p['amount'] <= expense).all())                         # subset of living expense
        self.assertTrue(((p['count'] == 0) == (p['amount'] == 0)).all())
        self.assertTrue((p['active_days'] <= p['count']).all())
        self.assertTrue((p['count'][~p['ever_used']] == 0).all())                # never-users never pay
        self.assertAlmostEqual(p['ever_used'].mean(), .85, delta=.01)
        self.assertAlmostEqual(p['active'].mean(), .58, delta=.01)
        t = p['amount'][p['count'] > 0] / p['count'][p['count'] > 0]
        self.assertAlmostEqual(np.median(t) / 31100, 1, delta=.08)

    def test_zero_expense_means_no_payment(self):
        p = ns.payment_panel(np.zeros((50, 12)), [30]*12, CFG['digital_payment'], np.random.default_rng(1))
        self.assertEqual(int(p['count'].sum()), 0)


class Coverage(unittest.TestCase):
    def test_pension_age_and_exempt(self):
        seg = np.array(['selfemp']*4); age = np.array([30, 59, 60, 70]); dec = np.array([1, 1, 1, 1])
        cov, payer = ns.pension_coverage(seg, age, dec, np.zeros(4, bool), SI['national_pension'], np.full(4, .5), np.zeros(4))
        self.assertEqual(list(cov), ['exempt', 'exempt', 'not_covered', 'not_covered'])   # u=0 -> exempt when regional
        self.assertEqual(list(payer[2:]), ['unknown', 'unknown'])

    def test_exempt_only_for_regional(self):
        seg = np.array(['wage']*1000); rng = np.random.default_rng(2)
        cov, payer = ns.pension_coverage(seg, np.full(1000, 40), np.full(1000, 1), np.ones(1000, bool), SI['national_pension'], rng.random(1000), np.zeros(1000))
        self.assertTrue((payer[cov == 'exempt'] == 'regional').all())

    def test_health_wage_never_dependent(self):
        rng = np.random.default_rng(3)
        cov, payer = ns.health_coverage(np.array(['wage']*500), np.full(500, 1), SI['health_insurance'], rng.random(500), np.zeros(500), np.ones(500))
        self.assertFalse((cov == 'dependent').any())
        cov, payer = ns.health_coverage(np.array(['freelance']*500), np.full(500, 2), SI['health_insurance'], rng.random(500), np.zeros(500), np.ones(500))
        self.assertTrue((cov == 'dependent').all() and (payer == 'household').all())


class Premiums(unittest.TestCase):
    def test_pension_limits_change_in_july_and_rate_by_year(self):
        months = ['2025-12', '2026-01', '2026-07']
        base = ns.pension_base(np.array([100_000., 7_000_000.]), months, SI['national_pension']['income_base_limits_krw'])
        np.testing.assert_array_equal(base, [[400000, 400000, 410000], [6370000, 6370000, 6590000]])
        np.testing.assert_allclose(ns.month_rate(SI['national_pension']['rate_by_year'], months), [.09, .095, .095])

    def test_workplace_pays_half_and_uncovered_pays_nothing(self):
        billed, indiv = ns.premiums(np.full((3, 1), 3_000_000.), np.array([.095]), np.array(['workplace', 'regional', 'regional']),
                                    np.array(['covered', 'covered', 'exempt']))
        np.testing.assert_array_equal(billed[:, 0], [285000, 285000, 0])
        np.testing.assert_array_equal(indiv[:, 0], [142500, 285000, 0])


class Propensity(unittest.TestCase):
    def test_tilt(self):
        u = np.random.default_rng(4).random(200000)
        np.testing.assert_allclose(ns.tilt_uniform(u, 1), u)
        self.assertAlmostEqual((ns.tilt_uniform(u, 3) > .9).mean(), 1 - .9**3, delta=.005)

    def test_calibrated_weighted_mean_hits_target(self):
        rng = np.random.default_rng(5)
        p0 = ns.base_propensity(.283, 1.0, rng.random(5000)); w = rng.uniform(1, 5, 5000)
        s = ns.calibrate_shift(p0, np.ones(5000), w, .283)
        self.assertAlmostEqual(np.sum(w*ns.shifted(p0, np.ones(5000), s))/w.sum(), .283, places=6)


class Status(unittest.TestCase):
    OUT = dict(late=.5, partial=.1, unpaid=.4, chronic_threshold=.8, late_days=[5, 40], partial_paid_fraction=[.3, .9])

    def test_not_due_and_chronic(self):
        due = ns.due_dates(['2026-08', '2026-09'], 10)
        st, frac, paid = ns.draw_status(np.array([0.9, 0.0]), np.ones((2, 2), bool), due, '2026-09-18', self.OUT, [0, 9], np.random.default_rng(6))
        self.assertEqual(st[0, 0], 'unpaid')                  # chronic payer never pays
        self.assertEqual(st[1, 0], 'on_time')
        self.assertTrue((st[:, 1] == 'not_due').all())        # 2026-09 is due 2026-10-10, after the as-of date

    def test_late_after_as_of_stays_unpaid(self):
        due = ns.due_dates(['2026-08'], 10)
        out = dict(self.OUT, late=1.0, partial=0.0, unpaid=0.0, late_days=[20, 20])
        st, _, paid = ns.draw_status(np.array([.5]), np.ones((1, 1), bool), due, '2026-09-18', out, [0, 9], np.random.default_rng(7))
        flag = np.random.default_rng(7).random((1, 1))[0, 0] < .5
        self.assertEqual(st[0, 0], 'unpaid' if flag else 'on_time')   # 09-10 + 20 days > 09-18

    def test_check_catches_exempt_with_status(self):
        row = dict(customer_id='A', month='2025-09', insurance_type='national_pension', coverage_status='exempt', payer_type='regional',
                   billed_amount_krw=0, individual_responsibility_krw=0, paid_amount_krw=0, due_date='', paid_date='2025-10-01', payment_status='on_time')
        e = ns.check_insurance(pd.DataFrame([row]), ['2025-09'], '2026-09-18')
        self.assertIn('insurance: no duty must be not_applicable', e)


class LabelTerms(unittest.TestCase):
    def test_regularity_z_neutral_for_never_users(self):
        z = nl.payment_regularity_z([0, 0, 6, 12, 3], [0, 0, 1, 1, 1])
        self.assertEqual(list(z[:2]), [0.0, 0.0])
        self.assertAlmostEqual(z[2:].mean(), 0.0, places=12)

    def test_extra_logit_none_is_previous_formula(self):
        rng = np.random.default_rng(8)
        b = rng.normal(-2, 1, 3000); bill = rng.random(3000) < .1; cf = rng.normal(size=3000)
        p0 = nl.effect_probability(b, bill, cf, 2.5, .15, .1)
        p1 = nl.effect_probability(b, bill, cf, 2.5, .15, .1, extra_logit=np.zeros(3000))
        np.testing.assert_allclose(p0, p1)

    def test_social_insurance_conditional_odds_ratio(self):
        rng = np.random.default_rng(9); n = 200000
        b = rng.normal(-2.5, .8, n); si = (rng.random(n) < .2).astype(int)
        p = nl.effect_probability(b, np.zeros(n), np.zeros(n), 2.5, 0, .1, extra_logit=np.log(2.0)*si)
        y = (rng.random(n) < p).astype(int)
        strata = np.digitize(b, np.quantile(b, np.linspace(0, 1, 11)[1:-1]))
        self.assertAlmostEqual(nl.mantel_haenszel_or(y, si, strata), 2.0, delta=.15)


if __name__ == '__main__':
    unittest.main()


class SummaryFolder(unittest.TestCase):
    # v3.5.5: 요약 JSON에 생성 PC의 절대경로를 남기지 않는다
    def test_folder_label_is_relative_or_name(self):
        from generate import build_nonfinancial_sources as bns
        self.assertEqual(bns.folder_label(ROOT/'data'), 'data')
        self.assertEqual(bns.folder_label(ROOT/'thinfile'), 'thinfile')
        self.assertEqual(bns.folder_label(Path('/tmp/some/elsewhere/out_dir')), 'out_dir')
