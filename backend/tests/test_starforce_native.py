"""Exact parity checks for the native kernel and its portable reference."""
import random
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from backend.calc import starforce_calculator as sf


@unittest.skipIf(sf._native_budget_cdf is None, 'Native kernel is not installed')
class NativeStarForceTests(unittest.TestCase):
    def test_every_bin_matches_reference_for_cyclic_chains(self):
        rng = random.Random(250)
        for size in (1, 5, 30):
            for _ in range(10):
                edges = []
                for state in range(size):
                    success, boom = rng.uniform(.05, .6), rng.uniform(0, .3)
                    edges.append([(state + 1, success, rng.randint(1, 20)),
                                  (state, 1 - success - boom, rng.randint(1, 20)),
                                  (rng.randrange(size), boom, rng.choice([1, 17, 10**30]))])
                states = list(range(size))
                with self.subTest(size=size):
                    self.assertEqual(sf._native_budget_cdf(edges, states, 0, 256),
                                     sf._python_budget_cdf(edges, states, 0, 256))

    def test_noncontiguous_reachable_states_and_absorption(self):
        edges = [[], [(3, .5, 10), (1, .5, 3)], [], [(4, .9, 11), (1, .1, 27)]]
        self.assertEqual(sf._native_budget_cdf(edges, [1, 3], 1, 256),
                         sf._python_budget_cdf(edges, [1, 3], 1, 256))

    def test_complete_estimates_match_fallback(self):
        cases = [dict(start_star=0, target_star=25),
                 dict(start_star=0, target_star=25, shining_starforce_sunday=True,
                      replacement_cost_mesos=1e9, safeguard_by_star={15: True, 17: True},
                      mode_by_star={18: 4, 21: 2}, mvp_rank='gold'),
                 dict(start_star=25, target_star=30, boom_reset_star=0),
                 dict(start_star=18, target_star=19, mode_18_21=4)]
        for settings in cases:
            kwargs = dict(item_level=200, percentiles=[.5, .75, .9, .95, .99],
                          include_budget_distribution=True, **settings)
            native = sf.estimate_starforce(**kwargs)
            with patch.object(sf, '_native_budget_cdf', None):
                reference = sf.estimate_starforce(**kwargs)
            with self.subTest(settings=settings):
                self.assertEqual(native, reference)

    def test_concurrent_requests_have_independent_buffers(self):
        def calculate(start):
            return sf.estimate_starforce(200, start, 25, include_budget_distribution=True)
        expected = [calculate(start) for start in (0, 15, 22)]
        with ThreadPoolExecutor(max_workers=3) as executor:
            self.assertEqual(list(executor.map(calculate, (0, 15, 22))), expected)


if __name__ == '__main__':
    unittest.main()
