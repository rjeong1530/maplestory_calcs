"""HTTP validation and calculator integration tests."""
import unittest

from fastapi.testclient import TestClient

from api import app
import maplestory_potential as calculator
import maplestory_flames as flames


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
                config['weights'] = flames.ScoreWeights(**config['weights'])
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


if __name__ == '__main__':
    unittest.main()
