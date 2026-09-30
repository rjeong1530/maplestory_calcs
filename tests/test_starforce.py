import unittest

from starforce_calculator import (
    attempt_rates,
    enhancement_mode_multiplier,
    estimate_starforce,
    starforce_base_cost,
)


class StarForceCalculatorTests(unittest.TestCase):
    def test_base_cost_rounds_to_nearest_hundred(self):
        self.assertEqual(starforce_base_cost(150, 0), 136_000)
        self.assertEqual(starforce_base_cost(150, 15) % 100, 0)

    def test_mode_multipliers_change_by_star_band(self):
        self.assertEqual(enhancement_mode_multiplier(15, 2), 1.5)
        self.assertEqual(enhancement_mode_multiplier(17, 4), 3.0)
        self.assertEqual(enhancement_mode_multiplier(18, 2), 2.0)
        self.assertEqual(enhancement_mode_multiplier(21, 4), 6.5)
        self.assertEqual(enhancement_mode_multiplier(22, 4), 1.0)
        self.assertEqual(enhancement_mode_multiplier(30, 4), 1.0)

    def test_mode_probabilities_match_supplied_table(self):
        rates = attempt_rates(19, 2)
        self.assertAlmostEqual(rates.success, 0.126)
        self.assertAlmostEqual(rates.boom, 0.06118)
        self.assertAlmostEqual(rates.maintain, 0.81282)
        self.assertEqual(rates.downgrade, 0.0)

        rates = attempt_rates(21, 4)
        self.assertAlmostEqual(rates.success, 0.084)
        self.assertEqual(rates.boom, 0.0)
        self.assertAlmostEqual(rates.maintain, 0.916)

    def test_all_available_probability_rows_sum_to_one(self):
        for star in range(30):
            modes = (1, 2, 3) if 15 <= star <= 17 else (1, 2, 3, 4)
            for mode in modes:
                with self.subTest(star=star, mode=mode):
                    rates = attempt_rates(star, mode)
                    self.assertAlmostEqual(
                        rates.success + rates.maintain + rates.downgrade + rates.boom,
                        1.0,
                    )

    def test_mode_four_is_not_available_from_15_through_17(self):
        for star in (15, 16, 17):
            with self.subTest(star=star), self.assertRaises(ValueError):
                attempt_rates(star, 4)

    def test_base_failures_drop_stars_in_the_standard_ranges(self):
        self.assertGreater(attempt_rates(10).downgrade, 0)
        self.assertGreater(attempt_rates(14).downgrade, 0)
        self.assertGreater(attempt_rates(22).downgrade, 0)
        self.assertEqual(attempt_rates(9).downgrade, 0)

    def test_expected_cost_for_one_transition_includes_retries(self):
        estimate = estimate_starforce(100, 0, 1)
        cost = starforce_base_cost(100, 0)
        self.assertAlmostEqual(estimate.expected_cost, cost / 0.9975)
        self.assertAlmostEqual(estimate.expected_attempts, 1 / 0.9975)
        self.assertEqual(estimate.expected_booms, 0.0)

    def test_mode_four_can_be_selected_for_18_to_21_band(self):
        estimate = estimate_starforce(200, 18, 19, mode_18_21=4)
        expected_cost = starforce_base_cost(200, 18) * 6.5 / 0.084
        self.assertAlmostEqual(estimate.expected_cost, expected_cost, delta=0.001)
        self.assertEqual(estimate.expected_booms, 0.0)

    def test_default_boom_resets_to_12_stars(self):
        default_reset = estimate_starforce(200, 21, 22)
        explicit_reset = estimate_starforce(200, 21, 22, boom_reset_star=12)
        self.assertEqual(default_reset, explicit_reset)

    def test_individual_star_mode_overrides_band_mode(self):
        individual_mode = estimate_starforce(
            200, 18, 19, mode_18_21=1, mode_by_star={18: 4})
        band_mode = estimate_starforce(200, 18, 19, mode_18_21=4)
        self.assertEqual(individual_mode, band_mode)

    def test_safeguard_disables_boom_and_costs_three_times_at_15_to_17(self):
        rates = attempt_rates(15, mode=3, safeguard=True)
        self.assertAlmostEqual(rates.success, 0.315)
        self.assertAlmostEqual(rates.maintain, 0.685)
        self.assertEqual(rates.boom, 0.0)
        self.assertEqual(enhancement_mode_multiplier(15, 3, safeguard=True), 3.0)

        estimate = estimate_starforce(
            200, 15, 16, mode_by_star={15: 3}, safeguard_15_17=True)
        self.assertAlmostEqual(
            estimate.expected_cost,
            starforce_base_cost(200, 15) * 3 / 0.315,
            delta=0.001,
        )
        self.assertEqual(estimate.expected_booms, 0.0)

    def test_invalid_requests_are_rejected(self):
        with self.assertRaises(ValueError):
            starforce_base_cost(0, 0)
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 31)
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 19, mode_15_17=4)
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 22, mode_by_star={15: 4})


if __name__ == '__main__':
    unittest.main()
