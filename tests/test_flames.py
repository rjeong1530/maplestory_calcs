import unittest

from maplestory_flames import FlameConfig, ScoreWeights, score_option


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
