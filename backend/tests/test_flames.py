import unittest
from math import fsum, nextafter, inf
from unittest.mock import patch

from backend.calc.maplestory_flames import FlameConfig, FlameProbabilityEngine, ScoreWeights, score_option


class FlameScoreTests(unittest.TestCase):
    def test_fast_threshold_probability_matches_enumeration(self):
        for flame_type in ('powerful', 'black', 'abyssal'):
            for boss_equipment in (False, True):
                for equipment_type in ('armor', 'weapon'):
                    with self.subTest(flame_type=flame_type, boss=boss_equipment,
                                      equipment_type=equipment_type):
                        engine = FlameProbabilityEngine(FlameConfig(
                            equipment_level=200, equipment_type=equipment_type,
                            boss_equipment=boss_equipment, flame_type=flame_type,
                            main_stat='STR', base_weapon_offense=295,
                            weights=ScoreWeights(secondary_stat_per_main=3,
                                                 attack_value=0.00006),
                        ))
                        engine.option_pool = ('STR', 'DEX', 'ATT', 'ALL_STAT_PCT')
                        outcomes = list(engine.iter_outcomes())
                        scores = sorted({outcome.score for outcome in outcomes})
                        boundary = scores[len(scores) // 2]
                        thresholds = (0, scores[0], boundary,
                                      nextafter(boundary, -inf), nextafter(boundary, inf),
                                      scores[-1], nextafter(scores[-1], inf))
                        with patch.object(engine, 'iter_outcomes',
                                          side_effect=AssertionError('Must not enumerate outcomes')):
                            for target in thresholds:
                                expected = fsum(outcome.probability for outcome in outcomes
                                                if outcome.score >= target)
                                self.assertAlmostEqual(engine.probability_at_least(target), expected)

    def test_threshold_probability_does_not_round_small_scores(self):
        engine = FlameProbabilityEngine(FlameConfig(
            equipment_level=200, equipment_type='armor', boss_equipment=False,
            flame_type='black', main_stat='STR', secondary_stats=(),
            weights=ScoreWeights(attack_value=0.00000000000006),
        ))
        engine.option_pool = ('ATT',)
        engine.option_count_probabilities = lambda: {1: 1.0}
        self.assertAlmostEqual(engine.probability_at_least(0.00000000000013), 0.71)

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
