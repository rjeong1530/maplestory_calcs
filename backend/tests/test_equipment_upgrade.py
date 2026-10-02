import unittest
from unittest.mock import patch

from backend.calc.equipment_upgrade import equipment_upgrade_plan, maximum_star_force, starforce_weighted_score
from backend.calc import starforce_calculator as starforce


class EquipmentUpgradeTests(unittest.TestCase):
    def test_level_110_secondary_potential_upgrade(self):
        request = self.plan_request(categories=['potential'])
        request['equipment'][0].update(name='Maple Treasure Controller', slot='secondary',
            equipment_level=110, potential_equipment_type='secondary weapon', current_star_force=0)
        result = equipment_upgrade_plan(request)['rankings']['potential']
        self.assertFalse(result['unavailable'])
        self.assertGreater(result['gain_per_meso_first'][0]['improvement_probability'], 0)

    def test_xenon_upgrade_scores_use_three_primary_stats(self):
        from backend.calc.equipment_upgrade import _potential_current_score
        from backend.api.main import EquipmentUpgradePlanRequest
        request = self.plan_request(main_stat=['STR', 'DEX', 'LUK'], secondary_stats=[])
        request = EquipmentUpgradePlanRequest(**request).model_dump()
        item = request['equipment'][0]
        item.update(name='Hat', slot='hat', potential_equipment_type='hat', boss_equipment=True)
        item['current_flames'] = [{'option': stat, 'stage': 5} for stat in ('STR', 'DEX', 'LUK')]
        settings = request['potential_weights']
        for secondary_weight in (1, 100):
            weights = {**self.flame_weights, 'secondary_stat_per_main': secondary_weight}
            single = starforce_weighted_score(item, 10, 'STR', (), 'ATT', weights)
            triple = starforce_weighted_score(item, 10, ('STR', 'DEX', 'LUK'), (), 'ATT', weights)
            self.assertEqual(triple, 3 * single)
            for stat in ('STR', 'DEX', 'LUK'):
                score = _potential_current_score([{'effect': f'{stat}_PCT', 'value': 12}],
                    ('STR', 'DEX', 'LUK'), (), 'ATT', weights, settings)
                self.assertEqual(score, 12 * settings['base_stat_pct_value'])
            score = _potential_current_score([{'effect': 'ALL_STAT_PCT', 'value': 7}],
                ('STR', 'DEX', 'LUK'), (), 'ATT', weights, settings)
            self.assertEqual(score, 21 * settings['base_stat_pct_value'])
        result = equipment_upgrade_plan(request)
        for category in ('flames', 'potential', 'starforce'):
            self.assertFalse(result['rankings'][category]['unavailable'])

    def test_selected_maximum_limits_all_starforce_rankings(self):
        request = self.plan_request(categories=['starforce'])
        request['equipment'][0].update(current_star_force=10, max_star_force=17)
        rankings = equipment_upgrade_plan(request)['rankings']['starforce']
        rows = rankings['gain_per_meso_first']
        self.assertEqual(sorted(row['next_star'] for row in rows), list(range(11, 18)))
        for limit in (0, 10):
            request['equipment'][0]['max_star_force'] = limit
            rankings = equipment_upgrade_plan(request)['rankings']['starforce']
            self.assertEqual(rankings['gain_per_meso_first'], [])
            self.assertIn('selected maximum', rankings['unavailable'][0]['note'])

    @patch('backend.calc.equipment_upgrade.starforce.estimate_starforce')
    @patch('backend.calc.equipment_upgrade._potential_score_distribution')
    def test_selected_flames_use_abyssal_rates_and_skip_other_calculations(self, potential, sf):
        request = self.plan_request(categories=['flames'])
        request['equipment'][0].update(name='Hat', slot='hat')
        request['equipment'][0]['current_flames'] = [{'option': 'STR', 'stage': 5}]
        black = equipment_upgrade_plan(request)
        abyssal = black
        self.assertEqual(set(abyssal['rankings']), {'flames'})
        self.assertEqual(set(abyssal['flame_rankings']), {'black', 'abyssal'})
        black_row = black['rankings']['flames']['gain_per_meso_first'][0]
        row = abyssal['flame_rankings']['abyssal']['largest_gain_first'][0]
        self.assertEqual(row['current_score'], black_row['current_score'])
        self.assertGreater(row['improvement_probability'], black_row['improvement_probability'])
        self.assertIsNone(row['action_cost_mesos'])
        self.assertIsNone(row['gain_per_meso'])
        self.assertAlmostEqual(black_row['action_cost_mesos'], 3_000_000 / black_row['improvement_probability'])
        self.assertEqual(equipment_upgrade_plan(request)['rankings'], black['rankings'])
        potential.assert_not_called()
        sf.assert_not_called()

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

    def test_item_modes_apply_to_upgrade_and_recovery_costs(self):
        modes = {15: 3, 18: 4}
        safeguards = {15: True, 16: False, 17: True}
        result = equipment_upgrade_plan({
            'main_stat': 'STR', 'secondary_stats': (), 'offense_stat': 'ATT',
            'cube_type': 'black', 'flame_weights': self.flame_weights,
            'potential_weights': {'base_stat_pct_value': 10, 'attack_pct_value': 10,
                                  'crit_damage_pct_value': 8},
            'equipment': [{'name': 'Arcane Hat', 'slot': 'hat', 'equipment_level': 200,
                           'equipment_type': 'armor', 'current_star_force': 15,
                           'mode_by_star': modes, 'safeguard_by_star': safeguards}],
        })
        rows = result['rankings']['starforce']['gain_per_meso_first']
        row = next(row for row in rows if row['start_star'] == 18)
        expected = starforce.estimate_starforce(
            item_level=200, start_star=18, target_star=19, mode_by_star=modes,
            safeguard_by_star=safeguards)
        self.assertAlmostEqual(row['action_cost_mesos'], expected.expected_cost)
        self.assertEqual(row['enhancement_mode'], 4)
        protected = next(row for row in rows if row['start_star'] == 15)
        self.assertTrue(protected['safeguard'])
        self.assertEqual(protected['enhancement_mode'], 1)
        self.assertAlmostEqual(protected['action_cost_mesos'], starforce.estimate_starforce(
            item_level=200, start_star=15, target_star=16, mode_by_star=modes,
            safeguard_by_star=safeguards).expected_cost)
        self.assertNotEqual(row['action_cost_mesos'], starforce.estimate_starforce(
            item_level=200, start_star=18, target_star=19).expected_cost)

    def test_starforce_weighted_score_uses_level_band_bonuses(self):
        item = {
            'slot': 'hat', 'equipment_level': 200,
            'equipment_type': 'armor',
        }
        self.assertAlmostEqual(
            starforce_weighted_score(item, 16, 'STR', ('DEX',), 'ATT', self.flame_weights),
            55 * 1.1 + 12 * 3,
        )

    def test_badges_do_not_support_starforce(self):
        badge = {'slot': 'badge', 'equipment_level': 160, 'equipment_type': 'armor'}
        with self.assertRaisesRegex(ValueError, 'badge equipment cannot be Star Forced'):
            starforce_weighted_score(badge, 16, 'STR', (), 'ATT', self.flame_weights)

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
            count = 15 if category == 'starforce' else 1
            self.assertEqual(len(ranking['weakest_first']), count)
            self.assertEqual(len(ranking['largest_gain_first']), count)
            self.assertEqual(len(ranking['gain_per_meso_first']), count)
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

    @patch('backend.calc.equipment_upgrade._potential_score_distribution', return_value={0: .5, 200: .5})
    def test_cubes_cost_until_better_roll_and_gollux_eligibility(self, distribution):
        for cube, cost in [('red', 24_000_000), ('black', 44_000_000)]:
            result = equipment_upgrade_plan(self.plan_request(cube_type=cube))
            self.assertEqual(result['excluded_superior_equipment'], [])
            entry = result['rankings']['potential']['largest_gain_first'][0]
            self.assertEqual(entry['expected_score_gain'], 80)
            self.assertEqual(entry['action_cost_mesos'], cost)
            self.assertEqual(entry['expected_attempts'], 2)
            self.assertEqual(entry['gain_per_meso'], 80 / cost)

    @patch('backend.calc.equipment_upgrade._potential_score_distribution', return_value={0: 1})
    def test_starforce_cost_includes_retries_and_boom_recovery(self, distribution):
        request = self.plan_request()
        request['equipment'][0]['current_star_force'] = 20
        entries = equipment_upgrade_plan(request)['rankings']['starforce']['largest_gain_first']
        entry = next(entry for entry in entries if entry['start_star'] == 20)
        estimate = starforce.estimate_starforce(item_level=150, start_star=20, target_star=21)
        self.assertAlmostEqual(entry['action_cost_mesos'], estimate.expected_cost)
        self.assertGreater(entry['action_cost_mesos'], starforce.starforce_base_cost(150, 20))
        self.assertAlmostEqual(entry['expected_score_gain'], 11 + 14 * 3)

    def test_starforce_ranks_multiple_marginal_steps_across_items(self):
        items = [
            {'name': 'Magic Eyepatch', 'slot': 'eye', 'equipment_level': 160,
             'equipment_type': 'armor', 'current_star_force': 15},
            {'name': 'Twilight Mark', 'slot': 'face', 'equipment_level': 140,
             'equipment_type': 'armor', 'current_star_force': 17},
        ]
        with patch('backend.calc.equipment_upgrade._flame_score_distribution', return_value={0: 1}):
            result = equipment_upgrade_plan(self.plan_request(equipment=items))
        rows = result['rankings']['starforce']['gain_per_meso_first']
        self.assertEqual(len(rows), 28)
        self.assertEqual(len({(row['slot'], row['start_star']) for row in rows}), 28)
        self.assertEqual([row['gain_per_meso'] for row in rows],
                         sorted((row['gain_per_meso'] for row in rows), reverse=True))
        for item in items:
            for start in range(item['current_star_force'], 30):
                row = next(row for row in rows
                           if row['slot'] == item['slot'] and row['start_star'] == start)
                expected = starforce.estimate_starforce(item['equipment_level'], start, start + 1)
                score_before = starforce_weighted_score(
                    item, start, 'STR', (), 'ATT', self.flame_weights)
                score_after = starforce_weighted_score(
                    item, start + 1, 'STR', (), 'ATT', self.flame_weights)
                self.assertEqual(row['current_star_force'], item['current_star_force'])
                self.assertEqual(row['next_star'], start + 1)
                self.assertEqual(row['current_score'], score_before)
                self.assertAlmostEqual(row['expected_score_gain'], score_after - score_before)
                self.assertAlmostEqual(row['action_cost_mesos'], expected.expected_cost)
                self.assertAlmostEqual(row['gain_per_meso'],
                                       (score_after - score_before) / expected.expected_cost)
        self.assertEqual(items[0]['current_star_force'], 15)

    def test_starforce_steps_stop_at_caps_and_preserve_supported_weapon_steps(self):
        for item, targets, unavailable in (
            ({'name': 'Ghost Ship Exorcist', 'slot': 'badge', 'equipment_level': 150,
              'equipment_type': 'armor', 'current_star_force': 20}, [], True),
            ({'name': 'Ghost Ship Exorcist', 'slot': 'badge', 'equipment_level': 150,
              'equipment_type': 'armor', 'current_star_force': 22}, [], True),
            ({'name': 'Weapon', 'slot': 'weapon', 'equipment_level': 200,
              'equipment_type': 'weapon', 'base_weapon_offense': 300,
              'current_star_force': 23}, [24, 25], True),
        ):
            with self.subTest(item=item), patch(
                'backend.calc.equipment_upgrade._flame_score_distribution', return_value={0: 1}
            ):
                ranking = equipment_upgrade_plan(self.plan_request(equipment=[item]))['rankings']['starforce']
                self.assertEqual(sorted(row['next_star'] for row in ranking['largest_gain_first']), targets)
                self.assertEqual(bool(ranking['unavailable']), unavailable)

    @patch('backend.calc.equipment_upgrade._current_flame_score', return_value=100)
    @patch('backend.calc.equipment_upgrade._flame_score_distribution',
           return_value={0: .5, 100: .25, 120: .125, 160: .125})
    @patch('backend.calc.equipment_upgrade._potential_score_distribution', return_value={0: 1})
    def test_flames_exclude_equal_and_worse_rolls(self, *mocks):
        request = self.plan_request()
        request['equipment'][0]['slot'] = 'hat'
        entry = equipment_upgrade_plan(request)['rankings']['flames']['largest_gain_first'][0]
        self.assertEqual(entry['action_cost_mesos'], 12_000_000)
        self.assertEqual(entry['expected_attempts'], 4)
        self.assertEqual(entry['expected_score_gain'], 40)

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

    @patch('backend.calc.equipment_upgrade._potential_score_distribution', return_value={0: .5, 200: .5})
    def test_multiple_items_are_ordered_by_score_and_gain(self, distribution):
        request = self.plan_request(cube_type='red')
        first = request['equipment'][0]
        request['equipment'].append({**first, 'slot': 'ring-2', 'name': 'Weak Ring',
                                     'current_potential': []})
        for ranking in equipment_upgrade_plan(request)['rankings']['potential'].values():
            if ranking:
                self.assertEqual(ranking[0]['name'], 'Weak Ring')

    @patch('backend.calc.equipment_upgrade._potential_score_distribution', return_value={0: .5, 120: .5})
    def test_no_better_potential_is_unavailable(self, distribution):
        ranking = equipment_upgrade_plan(self.plan_request())['rankings']['potential']
        self.assertEqual(ranking['largest_gain_first'], [])
        self.assertEqual(ranking['gain_per_meso_first'], [])
        self.assertIsNone(ranking['unavailable'][0]['action_cost_mesos'])
        self.assertIn('No better', ranking['unavailable'][0]['note'])


if __name__ == '__main__':
    unittest.main()
