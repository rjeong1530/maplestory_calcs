import unittest
from math import ceil, log1p

from backend.calc.starforce_calculator import (
    _meso_percentiles,
    attempt_rates,
    boom_recovery_star,
    enhancement_mode_multiplier,
    estimate_starforce,
    starforce_base_cost,
    starforce_costs_by_star,
)


class StarForceCalculatorTests(unittest.TestCase):
    def test_meso_percentiles_charge_replacements_only_on_booms(self):
        # Half succeed for 10; half boom, pay 100 extra, then retry.
        rows = _meso_percentiles([[(1, .5, 10), (0, .5, 110)]], 0, [.5, .75, .875], 120)
        self.assertEqual([row['mesos'] for row in rows], [10, 120, 230])

    def test_meso_percentiles_accumulate_different_costs_and_recovery(self):
        # First tap costs 10; at state 1, success costs 20, recovery costs 120.
        edges = [[(1, 1, 10)], [(2, .5, 20), (0, .5, 120)]]
        rows = _meso_percentiles(edges, 0, [.5, .75, .875], 160)
        self.assertEqual([row['mesos'] for row in rows], [30, 160, 290])
        self.assertEqual(_meso_percentiles(edges, 0, [], 160), ())

    def test_meso_percentiles_match_constant_cost_geometric_quantiles(self):
        for settings in ({}, {'shining_starforce_sunday': True, 'mvp_rank': 'gold'}):
            result = estimate_starforce(200, 18, 19, mode_18_21=4, percentiles=[.5, .99], **settings)
            tap = starforce_base_cost(200, 18) * enhancement_mode_multiplier(18, 4, **settings)
            for attempts, budget in zip(result.attempt_estimates, result.meso_estimates):
                exact = attempts['attempts'] * tap
                self.assertGreaterEqual(budget['mesos'], exact)
                self.assertLess(budget['mesos'], exact * 1.002)

    def test_replacement_cost_includes_all_booms_without_changing_attempts(self):
        for start, target, settings in ((15, 22, {}), (0, 1, {}),
                (15, 16, {'safeguard_15_17': True}), (18, 19, {'mode_18_21': 4})):
            with self.subTest(start=start, target=target, settings=settings):
                base = estimate_starforce(200, start, target, percentiles=[.5], **settings)
                paid = estimate_starforce(200, start, target, percentiles=[.5],
                                          replacement_cost_mesos=1_000_000_000, **settings)
                self.assertAlmostEqual(paid.expected_cost,
                                       base.expected_cost + base.expected_booms * 1_000_000_000)
                self.assertEqual(paid.expected_replacement_cost, base.expected_booms * 1_000_000_000)
                self.assertEqual(paid.expected_booms, base.expected_booms)
                self.assertEqual(paid.expected_attempts, base.expected_attempts)
                self.assertEqual(paid.attempt_estimates, base.attempt_estimates)
        for value in (-1, float('inf'), float('nan'), True, '100'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                estimate_starforce(200, 15, 22, replacement_cost_mesos=value)

    def test_success_chances_match_single_step_geometric_distribution(self):
        chances = [.5, .75, .9, .95, .99]
        result = estimate_starforce(200, 18, 19, mode_by_star={18: 4}, percentiles=chances)
        for row in result.attempt_estimates:
            self.assertEqual(row['attempts'], ceil(log1p(-row['target_probability']) / log1p(-.084)))
        self.assertEqual(estimate_starforce(200, 0, 1).attempt_estimates, ())
        for chance in (0, 1, float('nan'), float('inf'), -1):
            with self.assertRaises(ValueError):
                estimate_starforce(200, 0, 1, percentiles=[chance])

    def test_success_chances_match_stepwise_probability_with_boom_recovery(self):
        for safeguards in ({}, {15: True, 16: True, 17: True}):
            chances = [.5, .75, .9, .99]
            result = estimate_starforce(200, 15, 18, safeguard_by_star=safeguards, percentiles=chances)
            pending = iter(result.attempt_estimates)
            row = next(pending)
            states = {15: 1.0}
            cumulative = 0
            for attempts in range(1, 10000):
                next_states = {}
                previous = cumulative
                for star, mass in states.items():
                    rates = attempt_rates(star, safeguard=safeguards.get(star, False))
                    for destination, probability in ((star + 1, rates.success), (star, rates.maintain),
                            (star - 1, rates.downgrade), (boom_recovery_star(star), rates.boom)):
                        if not probability:
                            continue
                        if destination >= 18:
                            cumulative += mass * probability
                        else:
                            next_states[destination] = next_states.get(destination, 0) + mass * probability
                states = next_states
                while row and cumulative >= row['target_probability']:
                    self.assertLess(previous, row['target_probability'])
                    self.assertEqual(row['attempts'], attempts)
                    row = next(pending, None)
                if row is None:
                    break
            self.assertIsNone(row)

    def test_base_cost_rounds_to_nearest_hundred(self):
        self.assertEqual(starforce_base_cost(150, 0), 136_000)
        self.assertEqual(starforce_base_cost(150, 15) % 100, 0)

    def test_costs_by_star_returns_base_cost_for_each_tap(self):
        costs = starforce_costs_by_star(150)
        self.assertEqual(set(costs), set(range(30)))
        for star, cost in costs.items():
            with self.subTest(star=star):
                self.assertEqual(cost, starforce_base_cost(150, star))

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

    def test_shining_starforce_sunday_reduces_booms_and_discount_costs(self):
        rates = attempt_rates(18, 1, shining_starforce_sunday=True)
        self.assertAlmostEqual(rates.boom, 0.0674 * 0.7)
        self.assertAlmostEqual(rates.maintain, 1.0 - rates.success - rates.boom)
        self.assertAlmostEqual(enhancement_mode_multiplier(18, 1, shining_starforce_sunday=True), 0.7)
        self.assertAlmostEqual(enhancement_mode_multiplier(15, 2, shining_starforce_sunday=True), 1.05)
        self.assertAlmostEqual(enhancement_mode_multiplier(15, 1, safeguard=True, shining_starforce_sunday=True), 2.7)
        self.assertAlmostEqual(enhancement_mode_multiplier(0, 1, shining_starforce_sunday=True), 0.7)
        self.assertAlmostEqual(enhancement_mode_multiplier(22, 4, shining_starforce_sunday=True), 0.7)
        self.assertEqual(
            attempt_rates(22, 1, shining_starforce_sunday=True).boom,
            attempt_rates(22, 1).boom,
        )

    def test_mvp_rank_discounts_apply_through_17_stars_except_superior(self):
        discounts = {
            'none': 0.0, 'silver': 0.03, 'gold': 0.05, 'diamond_plus': 0.10,
        }
        for rank, discount in discounts.items():
            with self.subTest(rank=rank):
                self.assertAlmostEqual(
                    enhancement_mode_multiplier(16, 1, mvp_rank=rank),
                    1 - discount,
                )
                self.assertEqual(enhancement_mode_multiplier(17, 1, mvp_rank=rank), 1)
                self.assertEqual(
                    enhancement_mode_multiplier(16, 1, mvp_rank=rank, superior_item=True),
                    1,
                )
        self.assertAlmostEqual(
            enhancement_mode_multiplier(
                0, 1, shining_starforce_sunday=True, mvp_rank='diamond_plus',
            ),
            0.63,
        )
        self.assertAlmostEqual(
            enhancement_mode_multiplier(
                0, 1, shining_starforce_sunday=True, mvp_rank='gold',
            ),
            0.665,
        )
        self.assertAlmostEqual(
            enhancement_mode_multiplier(
                15, 1, safeguard=True, shining_starforce_sunday=True, mvp_rank='diamond_plus',
            ),
            2.63,
        )
        self.assertEqual(
            int(
                starforce_base_cost(250, 16)
                * enhancement_mode_multiplier(
                    16, 1, safeguard=True, shining_starforce_sunday=True,
                    mvp_rank='diamond_plus',
                )
            ),
            431_479_904,
        )
        self.assertAlmostEqual(
            enhancement_mode_multiplier(
                15, 1, safeguard=True, mvp_rank='diamond_plus',
            ),
            2.9,
        )
        self.assertAlmostEqual(
            enhancement_mode_multiplier(
                17, 1, safeguard=True, shining_starforce_sunday=True, mvp_rank='diamond_plus',
            ),
            2.7,
        )
        with self.assertRaises(ValueError):
            enhancement_mode_multiplier(0, 1, mvp_rank='platinum')
        with self.assertRaises(ValueError):
            enhancement_mode_multiplier(0, 1, superior_item=1)

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

    def test_non_destructive_failures_always_maintain_stars(self):
        for star in range(30):
            with self.subTest(star=star):
                rates = attempt_rates(star)
                self.assertEqual(rates.downgrade, 0)
                self.assertAlmostEqual(rates.maintain, 1 - rates.success - rates.boom)

    def test_standard_estimates_match_lostara_reference(self):
        # https://lostara.com/sf/index.html, checked 2026-10-01:
        # level 200, Mode 1, Star Catch on, no events or MVP discounts.
        # These fixtures cover low-star retries, boom recovery, and 22+ failures.
        for start, target, cost, booms in (
            (0, 15, 995_038_089.6920172, 0.0),
            (15, 22, 31_922_944_103.602966, 7.380757762983629),
            (22, 23, 34_688_255_377.368706, 8.821938459931166),
        ):
            with self.subTest(start=start, target=target):
                estimate = estimate_starforce(200, start, target)
                self.assertAlmostEqual(estimate.expected_cost, cost, delta=0.01)
                self.assertAlmostEqual(estimate.expected_booms, booms, places=9)

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

    def test_boom_recovery_star_matches_supplied_ranges(self):
        for destroyed_star, expected_star in (
            (15, 12), (19, 12), (20, 15), (21, 17), (22, 17),
            (23, 19), (25, 19), (26, 20), (30, 20),
        ):
            with self.subTest(destroyed_star=destroyed_star):
                self.assertEqual(boom_recovery_star(destroyed_star), expected_star)

    def test_boom_reset_star_can_override_recovery_table(self):
        table_default = estimate_starforce(200, 21, 22)
        explicit_reset = estimate_starforce(200, 21, 22, boom_reset_star=12)
        self.assertNotEqual(table_default, explicit_reset)

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

    def test_safeguard_can_be_selected_per_star(self):
        estimate = estimate_starforce(200, 15, 16, mode_by_star={15: 3},
                                      safeguard_by_star={15: True})
        self.assertAlmostEqual(
            estimate.expected_cost,
            starforce_base_cost(200, 15) * 3 / 0.315,
            delta=0.001,
        )
        self.assertEqual(estimate.expected_booms, 0.0)

        unguarded = estimate_starforce(200, 15, 16, safeguard_by_star={15: False})
        self.assertGreater(unguarded.expected_booms, 0.0)

    def test_invalid_requests_are_rejected(self):
        with self.assertRaises(ValueError):
            starforce_base_cost(0, 0)
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 31)
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 19, mode_15_17=4)
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 22, mode_by_star={15: 4})
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 22, safeguard_by_star={18: True})
        with self.assertRaises(ValueError):
            estimate_starforce(150, 0, 22, safeguard_by_star={15: 1})


if __name__ == '__main__':
    unittest.main()
