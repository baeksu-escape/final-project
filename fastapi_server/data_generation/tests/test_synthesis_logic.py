"""Fixed-fixture regressions only: no generator calls, RNG draws, or file writes."""
import unittest
import numpy as np
from generate.synthesis_logic import income_latent, allocate_card_components, card_subsets


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


if __name__ == '__main__':
    unittest.main()
