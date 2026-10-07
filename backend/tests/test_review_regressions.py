import asyncio
import unittest
from dataclasses import replace

from fastapi.testclient import TestClient
from backend.api.main import app, EquipmentUpgradePlanRequest
from backend.api.limits import RequestBodyLimit
from backend.calc import maplestory_flames as flames
from backend.calc.equipment_upgrade import equipment_upgrade_plan
from backend.tests.test_overall_upgrade import FLAME_WEIGHTS, POTENTIAL_WEIGHTS


class ReviewRegressionTests(unittest.TestCase):
    def request(self):
        return {
            'main_stat': 'STR', 'secondary_stats': ['DEX'], 'offense_stat': 'ATT',
            'categories': ['flames'], 'include_overall': True,
            'flame_weights': FLAME_WEIGHTS, 'potential_weights': POTENTIAL_WEIGHTS,
            'equipment': [{'name': 'Hat', 'slot': 'hat', 'equipment_level': 200,
                           'equipment_type': 'armor', 'boss_equipment': True, 'current_star_force': 0}],
        }

    def test_maximum_fractional_flame_score_has_no_phantom_upgrade(self):
        weights = {**FLAME_WEIGHTS, 'all_stat_pct_value': 10.1234567,
                   'secondary_stat_value': .1234567, 'attack_value': 3.1234567}
        config = flames.FlameConfig(200, 'armor', True, 'black', 'STR', weights=flames.ScoreWeights(**weights))
        best = sorted(flames.ARMOR_OPTION_TYPES,
                      key=lambda option: flames.score_option(option, 7, config).score, reverse=True)[:4]
        request = self.request()
        request['flame_weights'] = weights
        request['equipment'][0]['current_flames'] = [{'option': option, 'stage': 7} for option in best]
        result = equipment_upgrade_plan(EquipmentUpgradePlanRequest(**request).model_dump())
        self.assertEqual(result['rankings']['flames']['gain_per_meso_first'], [])
        self.assertEqual(result['overall_upgrade_order']['steps'], [])

    def test_flame_api_rejects_invalid_scoring_inputs(self):
        config = {'equipment_level': 200, 'equipment_type': 'armor', 'boss_equipment': True,
                  'flame_type': 'black', 'main_stat': 'STR', 'secondary_stats': ['DEX'],
                  'offense_stat': 'ATT', 'weights': FLAME_WEIGHTS}
        client = TestClient(app, raise_server_exceptions=False)
        invalid = [{'flame_type': 'invalid'}, {'offense_stat': 'invalid'}, {'main_stat': 'invalid'},
                   {'secondary_stats': ['DEX', 'DEX']}, {'secondary_stats': ['STR']},
                   {'secondary_stats': ['invalid']}, {'main_stat': ['STR', 'STR']}]
        for key in FLAME_WEIGHTS:
            for value in ('NaN', 'Infinity', -1):
                invalid.append({'weights': {**FLAME_WEIGHTS, key: value}})
        for patch in invalid:
            with self.subTest(patch=patch):
                response = client.post('/api/flame-probability', json={'config': {**config, **patch}, 'target_score': 170})
                self.assertEqual(response.status_code, 422, response.text)
        results = [client.post('/api/flame-probability', json={
            'config': {**config, 'main_stat': stat, 'secondary_stats': []}, 'target_score': 1000,
        }).json()['probability'] for stat in ('HP', 'MAX_HP')]
        self.assertGreater(results[0], 0)
        self.assertEqual(*results)

    def test_flame_engine_validates_direct_callers(self):
        config = flames.FlameConfig(200, 'armor', True, 'black', 'STR')
        for patch in ({'flame_type': 'invalid'}, {'secondary_stats': ('DEX', 'DEX')},
                      {'offense_stat': 'invalid'}, {'weights': flames.ScoreWeights(attack_value=float('nan'))}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                flames.FlameProbabilityEngine(replace(config, **patch))
        with self.assertRaises(ValueError):
            flames.FlameProbabilityEngine(replace(config, weights=flames.ScoreWeights(
                all_stat_pct_value=2e307, attack_value=2e307))).score_distribution()

    def test_equipment_text_fields_are_bounded(self):
        request = self.request()
        for patch in ({'name': 'X' * 201}, {'slot': 'hat' * 100}, {'slot': 'unknown'}, {'slot': 'ring-9'}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                EquipmentUpgradePlanRequest(**{**request, 'equipment': [{**request['equipment'][0], **patch}]})
        EquipmentUpgradePlanRequest(**request)

    def test_body_limit_handles_headers_and_streamed_bytes_before_parsing(self):
        async def check(chunks, headers, expected):
            called = []
            messages = []
            received = iter([{'type': 'http.request', 'body': chunk, 'more_body': index < len(chunks) - 1}
                             for index, chunk in enumerate(chunks)])
            async def receive():
                return next(received)
            async def send(message):
                messages.append(message)
            async def downstream(scope, receive, send):
                called.append((await receive())['body'])
            await RequestBodyLimit(downstream, max_bytes=8)(
                {'type': 'http', 'headers': headers}, receive, send)
            if expected == 413:
                self.assertEqual(called, [])
                self.assertEqual(messages[0]['status'], 413)
            else:
                self.assertEqual(called, [b''.join(chunks)])
        for headers in ([], [(b'content-length', b'2')], [(b'content-length', b'invalid')]):
            asyncio.run(check([b'12345', b'6789'], headers, 413))
        asyncio.run(check([], [(b'content-length', b'9')], 413))
        asyncio.run(check([b'1234', b'5678'], [], 200))
        client = TestClient(app)
        response = client.post('/api/probability', content=b' ' * 262_145)
        self.assertEqual(response.status_code, 413)
        self.assertEqual(client.get('/api/health').status_code, 200)
