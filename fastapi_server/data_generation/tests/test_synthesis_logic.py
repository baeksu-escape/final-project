"""Fixed-fixture regressions only: no generator calls, RNG draws, or file writes."""
import unittest
import numpy as np
from generate.synthesis_logic import income_latent, allocate_card_components, card_subsets, quantize_rate, amortization_rows


class LogicRegressionTests(unittest.TestCase):
    def test_constant_debt_does_not_shrink_noise(self):
        noise = np.array([-2., -1., 0., 1., 2.])
        for rho in (0., .5, 1., -1.):
            np.testing.assert_array_equal(income_latent(np.zeros(5), rho, noise, np.full(5, .5)), noise)

    def test_tied_debt_uses_full_tie_interval(self):
        z = income_latent([0, 0, 10, 20], 1., np.zeros(4), [.25, .75, .5, .5])
        from scipy.stats import norm
        np.testing.assert_allclose(norm.cdf(z), [.125, .375, .625, .875])

    def test_zero_rho_returns_noise(self):
        np.testing.assert_array_equal(income_latent([0, 0, 1], 0, [-1., 0., 1.], [.2, .5, .8]), [-1., 0., 1.])

    def test_single_qualifying_card_keeps_all_usage(self):
        single = np.array([[400., 120., 0.]])
        cash = np.array([[30., 0., 20.]])
        parts = allocate_card_components(single, np.zeros_like(single), cash,
                                        np.ones((1, 1, 3), bool), np.ones((1, 1, 3)))
        _, qualified, main, qualifying, counts = card_subsets(*parts, np.array([[7]]))
        self.assertTrue(qualified[0, 0])
        np.testing.assert_array_equal(qualifying[0], single)
        np.testing.assert_array_equal(qualifying[2], cash)
        np.testing.assert_array_equal(main[0], single)
        self.assertEqual(counts[0], 1)

    def test_customer_total_does_not_qualify_individual_cards(self):
        single = np.array([[[200., 100.], [200., 100.]]])
        zeros = np.zeros_like(single)
        _, qualified, _, parts, _ = card_subsets(single, zeros, zeros, np.array([[1, 2]]))
        self.assertFalse(qualified.any())
        self.assertEqual(sum(x.sum() for x in parts), 0.)

    def test_cash_institutions_deduplicate_and_require_cash(self):
        cash = np.array([[[10., 0.], [20., 0.], [0., 50.]],
                         [[10., 0.], [20., 0.], [5., 0.]]])
        zeros = np.zeros_like(cash)
        *_, counts = card_subsets(zeros, zeros, cash, np.array([[1, 1, 2], [1, 1, 2]]))
        np.testing.assert_array_equal(counts, [1, 2])

    def test_allocation_preserves_components_and_opening_boundary(self):
        available = np.array([[[True, True, True], [True, False, False]]])
        components = [np.array([[100., 60., 30.]]), np.array([[10., 3., 0.]]), np.array([[5., 0., 1.]])]
        parts = allocate_card_components(*components, available, np.ones((1, 2, 3)))
        for actual, expected in zip(parts, components):
            np.testing.assert_allclose(actual.sum(axis=1), expected)
            self.assertTrue((actual[~available] == 0).all())

    def test_no_cards_and_no_use(self):
        empty = np.zeros((1, 2))
        parts = allocate_card_components(empty, empty, empty, np.zeros((1, 2, 2), bool), np.ones((1, 2, 2)))
        *_, counts = card_subsets(*parts, np.array([[1, 1]]))
        self.assertEqual(counts[0], 0)
        self.assertTrue(all((p == 0).all() for p in parts))

    def test_reject_unfunded_card_allocation(self):
        with self.assertRaises(ValueError):
            allocate_card_components(np.ones((1, 1)), np.zeros((1, 1)), np.zeros((1, 1)),
                                     np.zeros((1, 1, 1), bool), np.ones((1, 1, 1)))

    def test_quantize_rate_half_up_and_boundaries(self):
        # 딱 중간인 값은 올림, 경계값은 그대로, 4자리를 넘는 입력은 4자리로 고정한다.
        self.assertEqual(quantize_rate(0.00005), 0.0001)
        self.assertEqual(quantize_rate(0.02), 0.02)
        self.assertEqual(quantize_rate(0.195), 0.195)
        self.assertEqual(quantize_rate(0.0812345678), 0.0812)
        self.assertEqual(quantize_rate(0.08125), 0.0813)
        self.assertEqual(quantize_rate(np.float64(0.0812999)), 0.0813)

    def test_amortization_methods_fixed_examples(self):
        # 방식별로 원금 보존, 마지막 잔액 0, 만기일시의 마지막 달, 원리금균등 납입액 동일을 확인한다.
        for method in ('bullet', 'equal_payment', 'equal_principal'):
            rows = amortization_rows(1_000_003, 7, 0.0812, method)
            self.assertEqual(len(rows), 7)
            self.assertEqual(sum(p for p, _ in rows), 1_000_003)
        bullet = amortization_rows(1_000_000, 6, 0.06, 'bullet')
        self.assertEqual([p for p, _ in bullet], [0, 0, 0, 0, 0, 1_000_000])
        self.assertTrue(all(i == 5000 for _, i in bullet))
        eq = amortization_rows(1_200_000, 12, 0.12, 'equal_payment')
        pays = [p + i for p, i in eq]
        self.assertEqual(len(set(pays[:-1])), 1)
        self.assertEqual(pays[0], 106_619)
        ep = amortization_rows(10, 4, 0.0, 'equal_principal')
        self.assertEqual([p for p, _ in ep], [3, 3, 2, 2])
        self.assertEqual(sum(p for p, _ in amortization_rows(500_000, 5, 0.0, 'equal_payment')), 500_000)
        with self.assertRaises(ValueError):
            amortization_rows(1, 1, 0.1, 'unknown')


if __name__ == '__main__':
    unittest.main()
