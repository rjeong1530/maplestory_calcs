import unittest
from math import fsum
from backend.api.flame_histogram import flame_histogram
from backend.calc.maplestory_flames import FlameConfig, FlameProbabilityEngine


class FlameHistogramTests(unittest.TestCase):
    def test_real_distribution_preserves_mass_and_range_membership(self):
        distribution = FlameProbabilityEngine(FlameConfig(
            equipment_level=150, equipment_type='armor', boss_equipment=False,
            flame_type='powerful', main_stat='STR',
        )).score_distribution(decimals=None)
        bins = flame_histogram(distribution)
        self.assertEqual(len(bins), 40)
        self.assertAlmostEqual(fsum(row['probability'] for row in bins), 1)
        for index, row in enumerate(bins):
            expected = fsum(p for score, p in distribution.items()
                            if row['lower'] <= score and
                            (score < row['upper'] or index == len(bins) - 1 and score == row['upper']))
            self.assertAlmostEqual(row['probability'], expected)

    def test_boundary_and_single_score_distributions(self):
        bins = flame_histogram({0: .1, 1: .2, 2: .3, 4: .4}, bin_count=4)
        self.assertEqual([row['probability'] for row in bins], [.1, .2, .3, .4])
        self.assertEqual(flame_histogram({0: 1}), [{'lower': 0, 'upper': 0, 'probability': 1}])
        self.assertEqual(len(flame_histogram({0: .5, 5e-324: .5})), 1)
