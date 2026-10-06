"""Verify policy search against the calculator's independent linear solver."""
import contextlib
import csv
import io
from itertools import product
import json
from pathlib import Path
import random
import tempfile
import unittest

from backend.calc.starforce_calculator import estimate_starforce
from backend.examples.starforce_strategies import (
    _evaluate, _policy, _terms, analyze_strategies, main,
)


class StarforceStrategyTests(unittest.TestCase):
    def test_fast_search_matches_calculator_including_recovery_below_start(self):
        rng = random.Random(123)
        for level, start, target in ((150, 0, 17), (200, 17, 22), (250, 22, 25), (200, 29, 30)):
            terms = _terms(level, target)
            policies = [(1,) * 7, (4,) * 7] + [tuple(rng.randint(1, 4) for _ in range(7)) for _ in range(12)]
            for choices in policies:
                with self.subTest(level=level, start=start, target=target, choices=choices):
                    row = _evaluate(choices, start, target, terms)
                    expected = estimate_starforce(level, start, target, **_policy(choices),
                        shining_starforce_sunday=True, mvp_rank='none')
                    for value, reference in ((row['enhancement_cost_mesos'], expected.expected_cost),
                                             (row['expected_spares'], expected.expected_booms),
                                             (row['expected_attempts'], expected.expected_attempts)):
                        self.assertAlmostEqual(value / reference, 1, places=8) if reference else self.assertEqual(value, 0)

    def test_optimal_policies_match_exhaustive_calculator_search(self):
        value = 5_000_000_000
        report = analyze_strategies(200, 17, 18, value)
        expected = [estimate_starforce(200, 17, 18, **_policy(actions + (1,) * 4),
                    shining_starforce_sunday=True, mvp_rank='none', replacement_cost_mesos=value)
                    for actions in product(range(1, 5), repeat=3)]
        self.assertEqual(report['assumptions']['policies_evaluated'], 64)
        winners = report['recommendations']
        self.assertAlmostEqual(winners[0]['enhancement_cost_mesos'] / min(
            row.expected_cost - row.expected_replacement_cost for row in expected), 1)
        self.assertEqual(winners[1]['expected_spares'], min(row.expected_booms for row in expected))
        self.assertAlmostEqual(winners[2]['total_cost_mesos'] / min(row.expected_cost for row in expected), 1)
        self.assertEqual(winners[3]['name'], 'Best balanced tradeoff')

    def test_presets_frontier_and_spare_valuation(self):
        report = analyze_strategies()
        self.assertTrue(report['assumptions']['shining_starforce_sunday'])
        self.assertEqual(report['assumptions']['mvp_rank'], 'none')
        self.assertEqual(report['assumptions']['policies_evaluated'], 16384)
        self.assertEqual(
            [row['name'] for row in report['recommendations']],
            ['Lowest enhancement spending', 'Fewest expected spares',
             'Lowest total cost at your spare value', 'Best balanced tradeoff'],
        )
        policies = [
            (tuple(sorted(row['mode_by_star'].items())),
             tuple(sorted(row['safeguard_by_star'].items())))
            for row in report['scenarios']
        ]
        self.assertEqual(len(policies), len(set(policies)))
        self.assertEqual(len(report['scenarios']), 3)
        self.assertIn(
            'Lowest enhancement spending + Lowest total cost at your spare value',
            report['scenarios'][0]['name'],
        )
        self.assertTrue(all(row['on_efficient_frontier'] for row in report['scenarios']))
        balanced = report['recommendations'][3]
        cost_range = (report['efficient_frontier'][-1]['enhancement_cost_mesos']
                      - report['efficient_frontier'][0]['enhancement_cost_mesos'])
        spare_range = (report['efficient_frontier'][0]['expected_spares']
                       - report['efficient_frontier'][-1]['expected_spares'])
        balanced_score = (
            (balanced['enhancement_cost_mesos'] - report['efficient_frontier'][0]['enhancement_cost_mesos'])
            / cost_range
            + (balanced['expected_spares'] - report['efficient_frontier'][-1]['expected_spares'])
            / spare_range
        )
        for row in report['efficient_frontier']:
            score = (
                (row['enhancement_cost_mesos'] - report['efficient_frontier'][0]['enhancement_cost_mesos'])
                / cost_range
                + (row['expected_spares'] - report['efficient_frontier'][-1]['expected_spares'])
                / spare_range
            )
            self.assertLessEqual(balanced_score, score + 1e-12)
        self.assertGreater(report['scenarios'][0]['expected_spares'], 0)
        frontier = report['efficient_frontier']
        self.assertTrue(all(row['on_efficient_frontier'] for row in frontier))
        for previous, current in zip(frontier, frontier[1:]):
            self.assertGreater(current['enhancement_cost_mesos'], previous['enhancement_cost_mesos'])
            self.assertLess(current['expected_spares'], previous['expected_spares'])
        for row in report['scenarios'] + report['recommendations'] + frontier:
            self.assertAlmostEqual(row['total_cost_mesos'], row['enhancement_cost_mesos'] + 1e9 * row['expected_spares'])
        self.assertLessEqual(report['recommendations'][2]['total_cost_mesos'],
                             min(row['total_cost_mesos'] for row in report['scenarios']))

    def test_short_ranges_and_invalid_inputs(self):
        report = analyze_strategies(150, 0, 10, 0)
        self.assertEqual(report['assumptions']['policies_evaluated'], 1)
        self.assertEqual(len(report['efficient_frontier']), 1)
        self.assertTrue(all(row['expected_spares'] == 0 for row in report['scenarios']))
        for args in ((0, 0, 22, 0), (200, 22, 22, 0), (200, 0, 31, 0),
                     (200, 0, 22, -1), (200, 0, 22, float('inf')), (200, 0, 22, True)):
            with self.assertRaises(ValueError):
                analyze_strategies(*args)

    def test_cli_exports_machine_readable_reports(self):
        with tempfile.TemporaryDirectory() as directory:
            json_path, csv_path = Path(directory) / 'report.json', Path(directory) / 'report.csv'
            with contextlib.redirect_stdout(io.StringIO()) as output:
                main(['--start', '15', '--target', '17', '--spare-value', '0',
                      '--json', str(json_path), '--csv', str(csv_path)])
            report = json.loads(json_path.read_text(encoding='utf-8'))
            with csv_path.open(encoding='utf-8', newline='') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), sum(len(report[key]) for key in
                             ('scenarios', 'recommendations', 'efficient_frontier')))
            self.assertIn('Shining Star Force | MVP: none', output.getvalue())
            self.assertEqual(report['assumptions']['spare_value_mesos'], 0)


if __name__ == '__main__':
    unittest.main()
