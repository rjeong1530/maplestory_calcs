import unittest

from backend.calc.maplestory_flames import FlameConfig, FlameProbabilityEngine, ScoreWeights, score_option


class FlameScoreTests(unittest.TestCase):
    def test_boss_damage_tiers_and_weight(self):
        config = FlameConfig(
            equipment_level=200, equipment_type='weapon',
            boss_equipment=True, flame_type='black', main_stat='STR',
            weights=ScoreWeights(boss_damage_pct_value=2.5),
        )
        for tier in range(1, 8):
            with self.subTest(tier=tier):
                option = score_option('BOSS_DAMAGE_PCT', tier, config)
                self.assertEqual(option.values['BOSS_DAMAGE_PCT'], tier * 2)
                self.assertEqual(option.score, tier * 5)

    def test_aggregated_score_distribution_matches_outcome_enumerator(self):
        config = FlameConfig(
            equipment_level=200, equipment_type='armor', boss_equipment=False,
            flame_type='black', main_stat='STR',
        )
        engine = FlameProbabilityEngine(config)
        engine.option_pool = ('STR', 'DEX', 'ATT')
        engine.option_count_probabilities = lambda: {2: 1.0}

        expected = {}
        for outcome in engine.iter_outcomes():
            score = round(outcome.score, 4)
            expected[score] = expected.get(score, 0.0) + outcome.probability

        actual = engine.score_distribution()
        self.assertEqual(actual.keys(), expected.keys())
        for score in actual:
            self.assertAlmostEqual(actual[score], expected[score])

    def test_fractional_weights_are_rounded_after_combining_options(self):
        config = FlameConfig(
            equipment_level=200, equipment_type='armor', boss_equipment=False,
            flame_type='black', main_stat='STR', secondary_stats=(),
            weights=ScoreWeights(attack_value=0.00006, all_stat_pct_value=0.00006),
        )
        engine = FlameProbabilityEngine(config)
        engine.option_pool = ('ATT', 'ALL_STAT_PCT')
        engine.option_count_probabilities = lambda: {2: 1.0}
        expected = {}
        for outcome in engine.iter_outcomes():
            score = round(outcome.score, 4)
            expected[score] = expected.get(score, 0.0) + outcome.probability
        actual = engine.score_distribution()
        self.assertEqual(actual.keys(), expected.keys())
        self.assertAlmostEqual(sum(actual.values()), 1)
        for score in actual:
            self.assertAlmostEqual(actual[score], expected[score])
