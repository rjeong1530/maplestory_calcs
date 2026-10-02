"""HTTP validation and calculator integration tests."""
import unittest

from fastapi.testclient import TestClient

from backend.api.main import app
from backend.calc import maplestory_potential as calculator
from backend.calc import maplestory_flames as flames
from backend.calc import starforce_calculator as starforce


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def calculate(self, **overrides):
        payload = {'targets': [{'effect': 'STR_PCT', 'target': 13}]}
        payload.update(overrides)
        return self.client.post('/api/probability', json=payload)

    def test_health_and_options(self):
        self.assertEqual(self.client.get('/api/health').json(), {'status': 'ok'})
        self.assertEqual(self.client.get('/api/options').json()['effects'], list(calculator.EFFECTS))
        self.assertEqual(self.client.get('/openapi.json').status_code, 200)

    def test_item_options_are_filtered_by_level_and_equipment_type(self):
        response = self.client.get('/api/item-options', params={
            'level': 150, 'potential_equipment_type': 'hat', 'flame_equipment_type': 'armor',
        })
        self.assertEqual(response.status_code, 200, response.text)
        options = response.json()
        self.assertEqual(options['flame_tier_ranges']['black'], [4, 7])
        self.assertTrue(options['potential']['available'])
        self.assertIn('COOLDOWN_SEC', options['potential']['effects'])
        self.assertIn('ALL_STAT_PCT', options['potential']['effects'])
        self.assertNotIn('ATT_PCT', options['potential']['effects'])
        potential_line_values = options['potential']['values_by_line']
        self.assertEqual([row['line'] for row in potential_line_values], [1, 2, 3])
        self.assertEqual(
            potential_line_values[0]['values']['STR_PCT'],
            sorted({
                value
                for option in calculator.get_potentials_by_line('hat', 150, 'black')[1]
                for effect, value in option.effects.items()
                if effect == 'STR_PCT' and '올스탯' not in option.name
            }),
        )
        self.assertEqual(potential_line_values[1]['values']['ALL_STAT_PCT'], [6.0, 9.0])
        for line_values in potential_line_values:
            for stat in ('STR_PCT', 'DEX_PCT', 'INT_PCT', 'LUK_PCT'):
                self.assertNotIn(6.0, line_values['values'][stat])
        self.assertIn('ALL_STAT_PCT', options['flame_options'])
        all_stat = next(row for row in options['flame_values'] if row['option'] == 'ALL_STAT_PCT')
        self.assertEqual(all_stat['values'][0], {
            'stage': 3, 'values': [{'stat': 'ALL_STAT_PCT', 'value': 3.0}],
        })

        response = self.client.get('/api/item-options', params={
            'level': 50, 'flame_equipment_type': 'armor',
        })
        self.assertEqual(response.status_code, 200, response.text)
        flame_options = response.json()['flame_options']
        self.assertNotIn('ATT', flame_options)
        self.assertNotIn('MATT', flame_options)
        self.assertNotIn('ALL_STAT_PCT', flame_options)

        response = self.client.get('/api/item-options', params={
            'level': 200, 'flame_equipment_type': 'weapon',
            'boss_equipment': True, 'offense_stat': 'MATT', 'base_weapon_offense': 347,
        })
        self.assertEqual(response.status_code, 200, response.text)
        weapon_values = response.json()['flame_values']
        self.assertNotIn('ATT', {row['option'] for row in weapon_values})
        magic_attack = next(row for row in weapon_values if row['option'] == 'MATT')
        self.assertGreater(magic_attack['values'][0]['values'][0]['value'], 0)

        response = self.client.get('/api/item-options', params={
            'level': 200, 'flame_equipment_type': 'armor', 'boss_equipment': True,
        })
        self.assertEqual(response.status_code, 200, response.text)
        options = response.json()
        defense = next(row for row in options['flame_values'] if row['option'] == 'DEF')
        self.assertEqual(defense['values'][0]['values'][0]['value'], 33.0)
        reduction = next(row for row in options['flame_values'] if row['option'] == 'LEVEL_REDUCTION')
        self.assertEqual(reduction['values'][0]['values'][0]['value'], -15.0)

        response = self.client.get('/api/item-options', params={
            'level': 250, 'potential_equipment_type': 'emblem',
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()['potential']['available'])
        self.assertEqual(response.json()['potential']['values_by_line'], [])

    def test_item_options_use_gms_potential_values(self):
        for cube in calculator.CUBE_TYPES:
            for level in (150, 160, 200, 250):
                with self.subTest(cube=cube, level=level):
                    response = self.client.get('/api/item-options', params={
                        'level': level, 'potential_equipment_type': 'hat', 'cube_type': cube,
                    })
                    self.assertEqual(response.status_code, 200, response.text)
                    rows = response.json()['potential']['values_by_line']
                    prime = 12.0 if level == 150 else 13.0
                    self.assertEqual(rows[0]['values']['STR_PCT'], [prime])
                    for row in rows[1:]:
                        self.assertEqual(row['values']['STR_PCT'], [prime - 3, prime])
                        self.assertEqual(row['values']['ALL_STAT_PCT'], [prime - 6, prime - 3])
                    self.assertEqual(rows[0]['values']['MAX_HP_PCT'],
                                     [13.0 if level == 250 else 12.0])

    def test_multiple_targets_and_estimates(self):
        for equipment, level, first, second in [
            ('hat', 250, ('STR_PCT', 13), ('COOLDOWN_SEC', 4)),
            ('gloves', 150, ('CRIT_DAMAGE_PCT', 8), ('STR_PCT', 12)),
            ('weapon', 200, ('ATT_PCT', 12), ('BOSS_DAMAGE_PCT', 40)),
        ]:
            with self.subTest(equipment=equipment):
                response = self.calculate(equipment_type=equipment, level=level,
                    targets=[{'effect': key, 'target': value} for key, value in (first, second)])
                self.assertEqual(response.status_code, 200, response.text)
                result = response.json()
                expected = calculator.probability_at_least(*first, *second,
                    equipment_type=equipment, level=level)
                self.assertAlmostEqual(result['probability'], expected)
                self.assertAlmostEqual(result['percentage'], expected * 100)
                self.assertAlmostEqual(result['one_in'], 1 / expected)
                self.assertEqual(result['cube_estimates'][0]['cubes'],
                                 calculator.cubes_for_probability(expected, .5))

    def test_impossible_and_certain(self):
        impossible = self.calculate(targets=[{'effect': 'STR_PCT', 'target': 1000}]).json()
        self.assertEqual(impossible['probability'], 0)
        self.assertIsNone(impossible['one_in'])
        self.assertTrue(all(item['cubes'] is None for item in impossible['cube_estimates']))
        certain = self.calculate(targets=[{'effect': 'STR_PCT', 'target': 0}]).json()
        self.assertAlmostEqual(certain['probability'], 1)
        self.assertTrue(all(item['cubes'] == 1 for item in certain['cube_estimates']))

    def test_invalid_requests(self):
        for overrides in [
            {'targets': []}, {'targets': [{'effect': 'bad', 'target': 1}]},
            {'targets': [{'effect': 'COOLDOWN_SEC', 'target': -4}]},
            {'targets': [{'effect': 'STR_PCT', 'target': 'Infinity'}]},
            {'targets': [{'effect': 'STR_PCT', 'target': True}]},
            {'targets': [{'effect': 'STR_PCT'}]},
            {'level': 99}, {'level': True}, {'level': 150.5},
            {'equipment_type': 'bad'}, {'cube_type': 'bad'},
            {'equipment_type': 'emblem', 'level': 250},
            {'percentiles': [1]}, {'percentiles': [0]}, {'typo': 123},
        ]:
            with self.subTest(overrides=overrides):
                self.assertEqual(self.calculate(**overrides).status_code, 422)

    def test_custom_percentiles(self):
        result = self.calculate(percentiles=[.8]).json()
        self.assertEqual(len(result['cube_estimates']), 1)
        self.assertEqual(result['cube_estimates'][0]['target_probability'], .8)

    def flame_payload(self, **overrides):
        config = {
            'equipment_level': 200, 'equipment_type': 'weapon',
            'boss_equipment': True, 'flame_type': 'black',
            'main_stat': 'STR', 'secondary_stats': ['DEX'], 'offense_stat': 'ATT',
            'weights': {'all_stat_pct_value': 10, 'secondary_stat_per_main': 10, 'attack_value': 3},
        }
        config.update(overrides)
        return {'config': config, 'target_score': 500}

    def test_flame_weapon_parameters(self):
        stages = flames.generate_weapon_offense_by_stage(200, 295)
        for overrides in [
            {'base_weapon_offense': 295},
            {'weapon_offense_by_stage': stages},
            {'base_weapon_offense': 1, 'weapon_offense_by_stage': stages},
            {'equipment_type': 'armor'},
        ]:
            with self.subTest(overrides=overrides):
                payload = self.flame_payload(**overrides)
                response = self.client.post('/api/flame-probability', json=payload)
                self.assertEqual(response.status_code, 200, response.text)
                config = dict(payload['config'])
                # The HTTP contract defaults omitted boss damage weight to zero.
                config['weights'] = flames.ScoreWeights(boss_damage_pct_value=0, **config['weights'])
                expected = flames.FlameProbabilityEngine(flames.FlameConfig(**config)).probability_at_least(500)
                self.assertAlmostEqual(response.json()['probability'], expected)

    def test_boss_damage_flame_weight(self):
        payload = self.flame_payload(base_weapon_offense=295, weights={
            'all_stat_pct_value': 0, 'secondary_stat_per_main': 10,
            'attack_value': 0, 'boss_damage_pct_value': 100,
        })
        # Only boss damage can reach 500; all its black-flame tiers do so.
        response = self.client.post('/api/flame-probability', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertAlmostEqual(response.json()['probability'], 4 / 19)
        payload['config']['weights']['boss_damage_pct_value'] = 0
        response = self.client.post('/api/flame-probability', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['probability'], 0)

    def test_invalid_boss_damage_weight(self):
        for value in [-1, 'Infinity', 'NaN']:
            with self.subTest(value=value):
                payload = self.flame_payload(base_weapon_offense=295)
                payload['config']['weights']['boss_damage_pct_value'] = value
                response = self.client.post('/api/flame-probability', json=payload)
                self.assertEqual(response.status_code, 422, response.text)

    def test_invalid_flame_weapon_parameters(self):
        for overrides in [
            {}, {'base_weapon_offense': 0}, {'base_weapon_offense': -1},
            {'base_weapon_offense': 'Infinity'},
            {'weapon_offense_by_stage': {'4': -1}},
            {'weapon_offense_by_stage': {'4': 'Infinity'}},
            {'weapon_offense_by_stage': {'invalid': 78}},
            {'weapon_offense_by_stage': {'4': 78}},
        ]:
            with self.subTest(overrides=overrides):
                response = self.client.post('/api/flame-probability', json=self.flame_payload(**overrides))
                self.assertEqual(response.status_code, 422, response.text)

    def test_starforce_costs_by_level_and_mode(self):
        response = self.client.get('/api/starforce-costs', params={'level': 200})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result['item_level'], 200)
        rows = result['costs_by_star']
        self.assertEqual(len(rows), 30)
        for row in rows:
            star = row['star']
            base_cost = starforce.starforce_base_cost(200, star)
            self.assertEqual(row['base_cost'], base_cost)
            self.assertEqual(row['mode_costs']['1'], base_cost)
        for star in (15, 16, 17):
            self.assertIsNone(rows[star]['mode_costs']['4'])
            self.assertIsNone(rows[star]['mode_rates']['4'])
            self.assertEqual(rows[star]['safeguard_rates']['boom'], 0)
        for row in rows:
            for rates in [*row['mode_rates'].values(), row['safeguard_rates']]:
                if rates is not None:
                    self.assertAlmostEqual(sum(rates.values()), 1)
        self.assertAlmostEqual(rows[18]['mode_rates']['4']['success'], .084)
        self.assertEqual(rows[18]['mode_rates']['4']['boom'], 0)
        self.assertEqual(rows[22]['mode_rates']['1']['downgrade'], 0)
        self.assertGreater(rows[22]['mode_rates']['1']['maintain'], 0)
        self.assertEqual(
            rows[18]['mode_costs']['4'],
            int(starforce.starforce_base_cost(200, 18) * 6.5),
        )
        self.assertEqual(self.client.get('/api/starforce-costs', params={'level': 0}).status_code, 422)

    def test_starforce_estimate(self):
        payload = {'item_level': 100, 'start_star': 0, 'target_star': 1}
        response = self.client.post('/api/starforce-estimate', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        expected = starforce.estimate_starforce(100, 0, 1)
        self.assertAlmostEqual(result['expected_cost'], expected.expected_cost)
        self.assertAlmostEqual(result['expected_attempts'], expected.expected_attempts)
        self.assertAlmostEqual(result['expected_booms'], expected.expected_booms)

    def test_starforce_estimate_accepts_per_star_modes_and_safeguards(self):
        payload = {
            'item_level': 200,
            'start_star': 15,
            'target_star': 18,
            'mode_by_star': {'15': 3, '16': 2, '17': 1},
            'safeguard_by_star': {'15': True, '16': False, '17': True},
        }
        response = self.client.post('/api/starforce-estimate', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        expected = starforce.estimate_starforce(
            200, 15, 18,
            mode_by_star={15: 3, 16: 2, 17: 1},
            safeguard_by_star={15: True, 16: False, 17: True},
        )
        self.assertAlmostEqual(response.json()['expected_cost'], expected.expected_cost)
        self.assertAlmostEqual(response.json()['expected_booms'], expected.expected_booms)

    def test_invalid_starforce_estimate(self):
        valid_request = {'item_level': 200, 'start_star': 15, 'target_star': 22}
        for overrides in (
            {'item_level': 0},
            {'target_star': 15},
            {'target_star': 31},
            {'mode_15_17': 4},
            {'mode_by_star': {'22': 2}},
            {'safeguard_15_17': 'true'},
            {'safeguard_by_star': {'18': True}},
            {'safeguard_by_star': {'15': 'true'}},
        ):
            with self.subTest(overrides=overrides):
                payload = {**valid_request, **overrides}
                response = self.client.post('/api/starforce-estimate', json=payload)
                self.assertEqual(response.status_code, 422, response.text)

    def test_equipment_upgrade_plan_endpoint(self):
        payload = {
            'main_stat': 'STR',
            'secondary_stats': ['DEX'],
            'offense_stat': 'ATT',
            'cube_type': 'red',
            'flame_weights': {
                'all_stat_pct_value': 10, 'secondary_stat_per_main': 10,
                'attack_value': 3, 'boss_damage_pct_value': 10,
            },
            'potential_weights': {
                'base_stat_pct_value': 10, 'attack_pct_value': 10,
                'crit_damage_pct_value': 8,
            },
            'equipment': [{
                'name': 'Arcane Warrior Hat', 'slot': 'hat',
                'equipment_level': 200, 'equipment_type': 'armor',
                'potential_equipment_type': 'hat', 'current_star_force': 15,
                'current_potential': [{'effect': 'STR_PCT', 'value': 12}],
                'current_flames': [], 'boss_equipment': True,
            }],
        }
        response = self.client.post('/api/equipment-upgrade-plan', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result['cube_type'], 'red')
        self.assertEqual(result['cost_assumptions_mesos']['black_flame'], 3_000_000)
        self.assertEqual(result['cost_assumptions_mesos']['red_cube'], 12_000_000)
        for category in ('starforce', 'flames', 'potential'):
            rankings = result['rankings'][category]
            count = 15 if category == 'starforce' else 1
            self.assertEqual(len(rankings['weakest_first']), count)
            self.assertEqual(len(rankings['largest_gain_first']), count)
            self.assertEqual(len(rankings['gain_per_meso_first']), count)
        sf_rows = result['rankings']['starforce']['gain_per_meso_first']
        self.assertEqual({row['start_star'] for row in sf_rows}, set(range(15, 30)))
        self.assertTrue(all(row['next_star'] == row['start_star'] + 1 for row in sf_rows))
        self.assertTrue(all(row['current_star_force'] == 15 for row in sf_rows))

        for secondary in (['DEX', 'DEX'], ['STR']):
            response = self.client.post('/api/equipment-upgrade-plan',
                                        json={**payload, 'secondary_stats': secondary})
            self.assertEqual(response.status_code, 422, response.text)

        payload['equipment'][0].update(slot='weapon', equipment_type='weapon',
                                       base_weapon_offense=None)
        response = self.client.post('/api/equipment-upgrade-plan', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['rankings']['starforce']['unavailable'][0]['note'])

    def test_equipment_upgrade_plan_rejects_bad_weights(self):
        payload = {
            'main_stat': 'STR', 'secondary_stats': ['DEX'], 'offense_stat': 'ATT',
            'flame_weights': {
                'all_stat_pct_value': 10, 'secondary_stat_per_main': 10,
                'attack_value': 3, 'boss_damage_pct_value': 10,
            },
            'potential_weights': {
                'base_stat_pct_value': -1, 'attack_pct_value': 10,
                'crit_damage_pct_value': 8,
            },
            'equipment': [{
                'name': 'Test Hat', 'slot': 'hat', 'equipment_level': 200,
                'equipment_type': 'armor', 'current_star_force': 0,
            }],
        }
        response = self.client.post('/api/equipment-upgrade-plan', json=payload)
        self.assertEqual(response.status_code, 422, response.text)


if __name__ == '__main__':
    unittest.main()
