import unittest
from unittest.mock import patch

from equipment_upgrade import equipment_upgrade_plan, maximum_star_force, starforce_weighted_score


class EquipmentUpgradeTests(unittest.TestCase):
    def setUp(self):
        self.flame_weights = {
            'all_stat_pct_value': 10,
            'secondary_stat_per_main': 10,
            'attack_value': 3,
            'boss_damage_pct_value': 10,
        }

    def test_level_based_star_caps_and_superior_exclusion(self):
        self.assertEqual(maximum_star_force(100), 8)
        self.assertEqual(maximum_star_force(200), 30)
        self.assertEqual(maximum_star_force(150, 'Superior Gollux Belt'), 30)
        self.assertEqual(maximum_star_force(150, 'Tyrant Belt'), 15)

    def test_starforce_weighted_score_uses_level_band_bonuses(self):
        item = {
            'slot': 'hat', 'equipment_level': 200,
            'equipment_type': 'armor',
        }
        self.assertAlmostEqual(
            starforce_weighted_score(item, 16, 'STR', ('DEX',), 'ATT', self.flame_weights),
            55 * 1.1 + 12 * 3,
        )

    def test_badge_score_uses_class_stats_without_armor_attack_bonuses(self):
        badge = {'slot': 'badge', 'equipment_level': 160, 'equipment_type': 'armor'}
        self.assertEqual(
            starforce_weighted_score(badge, 16, 'STR', (), 'ATT', self.flame_weights),
            53,
        )

    def test_weapon_stat_table_gaps_are_not_extrapolated(self):
        weapon = {'slot': 'weapon', 'equipment_level': 250, 'equipment_type': 'weapon',
                  'base_weapon_offense': 500}
        with self.assertRaisesRegex(ValueError, 'not available at level 250'):
            starforce_weighted_score(weapon, 16, 'STR', (), 'ATT', self.flame_weights)

        weapon['equipment_level'] = 200
        with self.assertRaisesRegex(ValueError, 'not available above 25 stars'):
            starforce_weighted_score(weapon, 26, 'STR', (), 'ATT', self.flame_weights)

    def test_plan_returns_weakest_gain_and_efficiency_orders(self):
        result = equipment_upgrade_plan({
            'main_stat': 'STR',
            'secondary_stats': ('DEX',),
            'offense_stat': 'ATT',
            'cube_type': 'red',
            'flame_weights': self.flame_weights,
            'potential_weights': {
                'base_stat_pct_value': 10,
                'attack_pct_value': 10,
                'crit_damage_pct_value': 8,
            },
            'equipment': [{
                'name': 'Arcane Warrior Hat', 'slot': 'hat',
                'equipment_level': 200, 'equipment_type': 'armor',
                'potential_equipment_type': 'hat', 'current_star_force': 15,
                'current_potential': [{'effect': 'STR_PCT', 'value': 12}],
                'current_flames': [], 'boss_equipment': True,
            }, {
                'name': 'Tyrant Belt', 'slot': 'belt',
                'equipment_level': 150, 'equipment_type': 'armor',
                'potential_equipment_type': 'accessory', 'current_star_force': 15,
                'current_potential': [], 'current_flames': [],
            }],
        })

        self.assertEqual(result['excluded_superior_equipment'], [
            {'name': 'Tyrant Belt', 'slot': 'belt'},
        ])
        self.assertEqual(result['cost_assumptions_mesos']['black_flame'], 3_000_000)
        self.assertEqual(result['cost_assumptions_mesos']['red_cube'], 12_000_000)
        for category in ('starforce', 'flames', 'potential'):
            ranking = result['rankings'][category]
            self.assertEqual(len(ranking['weakest_first']), 1)
            self.assertEqual(len(ranking['largest_gain_first']), 1)
            self.assertEqual(len(ranking['gain_per_meso_first']), 1)
            self.assertIsNotNone(ranking['largest_gain_first'][0]['expected_score_gain'])

    def test_armor_attack_accumulates_through_22_stars(self):
        item = {'slot': 'hat', 'equipment_level': 200, 'equipment_type': 'armor'}
        self.assertAlmostEqual(
            starforce_weighted_score(item, 22, 'STR', ('DEX',), 'ATT', self.flame_weights),
            145 * 1.1 + 106 * 3,
        )

    def plan_request(self, **overrides):
        return {
            'main_stat': 'STR', 'secondary_stats': (), 'offense_stat': 'ATT',
            'cube_type': 'black', 'flame_weights': self.flame_weights,
            'potential_weights': {'base_stat_pct_value': 10, 'attack_pct_value': 10,
                                  'crit_damage_pct_value': 8},
            'equipment': [{'name': 'Superior Gollux Ring', 'slot': 'ring-1',
                           'equipment_level': 150, 'equipment_type': 'armor',
                           'potential_equipment_type': 'accessory', 'current_star_force': 15,
                           'current_potential': [{'effect': 'STR_PCT', 'value': 12}]}],
            **overrides,
        }

    @patch('equipment_upgrade._potential_score_distribution', return_value={0: .5, 200: .5})
    def test_cube_replacement_and_gollux_eligibility(self, distribution):
        for cube, expected_gain in [('red', -20), ('black', 40)]:
            result = equipment_upgrade_plan(self.plan_request(cube_type=cube))
            self.assertEqual(result['excluded_superior_equipment'], [])
            entry = result['rankings']['potential']['largest_gain_first'][0]
            self.assertEqual(entry['expected_score_gain'], expected_gain)
            self.assertEqual(entry['gain_per_meso'], expected_gain / entry['action_cost_mesos'])

    def test_missing_weapon_attack_and_invalid_stars_are_reported(self):
        weapon = {'name': 'Weapon', 'slot': 'weapon', 'equipment_level': 200,
                  'equipment_type': 'weapon', 'current_star_force': 15,
                  'base_weapon_offense': None}
        result = equipment_upgrade_plan(self.plan_request(equipment=[weapon]))
        for category in ('starforce', 'flames', 'potential'):
            self.assertEqual(result['rankings'][category]['largest_gain_first'], [])
            self.assertTrue(result['rankings'][category]['unavailable'][0]['note'])
        weapon.update(equipment_level=130, current_star_force=21)
        result = equipment_upgrade_plan(self.plan_request(equipment=[weapon]))
        self.assertIn('cap', result['rankings']['starforce']['unavailable'][0]['note'])

    def test_hp_potential_scoring_and_unsupported_starforce(self):
        result = equipment_upgrade_plan(self.plan_request(main_stat='HP'))
        self.assertIn('HP-based', result['rankings']['starforce']['unavailable'][0]['note'])
        self.assertGreater(result['rankings']['potential']['largest_gain_first'][0]['expected_score_gain'], 0)

    @patch('equipment_upgrade._potential_score_distribution', return_value={0: 1})
    def test_multiple_items_are_ordered_by_score_and_gain(self, distribution):
        request = self.plan_request(cube_type='red')
        first = request['equipment'][0]
        request['equipment'].append({**first, 'slot': 'ring-2', 'name': 'Weak Ring',
                                     'current_potential': []})
        for ranking in equipment_upgrade_plan(request)['rankings']['potential'].values():
            if ranking:
                self.assertEqual(ranking[0]['name'], 'Weak Ring')


if __name__ == '__main__':
    unittest.main()
