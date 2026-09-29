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
