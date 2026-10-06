import unittest
from fastapi.testclient import TestClient
from backend.api.main import app, cached_strategies


class StrategyApiTests(unittest.TestCase):
    def test_strategy_report_and_cache(self):
        cached_strategies.cache_clear()
        with TestClient(app) as client:
            payload = dict(item_level=200, start_star=15, target_star=18, replacement_cost_mesos=1e9)
            first = client.post('/api/starforce-strategies', json=payload)
            self.assertEqual(first.status_code, 200, first.text)
            report = first.json()
            self.assertLessEqual(len(report['scenarios']), 3)
            policies = [
                (tuple(sorted(row['mode_by_star'].items())),
                 tuple(sorted(row['safeguard_by_star'].items())))
                for row in report['scenarios']
            ]
            self.assertEqual(len(policies), len(set(policies)))
            self.assertTrue(all(row['on_efficient_frontier'] for row in report['scenarios']))
            self.assertEqual(len(report['recommendations']), 4)
            self.assertTrue(report['assumptions']['shining_starforce_sunday'])
            self.assertEqual(report['assumptions']['mvp_rank'], 'none')
            self.assertEqual(report['assumptions']['policies_evaluated'], 64)
            self.assertEqual(client.post('/api/starforce-strategies', json=payload).json(), report)
            self.assertEqual(cached_strategies.cache_info().hits, 1)
            changed = client.post('/api/starforce-strategies', json={**payload, 'replacement_cost_mesos': 0}).json()
            self.assertTrue(all(row['expected_replacement_cost_mesos'] == 0 for row in changed['scenarios']))

    def test_invalid_strategy_requests(self):
        with TestClient(app) as client:
            payload = dict(item_level=200, start_star=15, target_star=22)
            for patch in ({'item_level': 0}, {'item_level': 301}, {'start_star': True},
                          {'target_star': 15}, {'target_star': 31}, {'replacement_cost_mesos': -1},
                          {'replacement_cost_mesos': True}, {'replacement_cost_mesos': 'Infinity'},
                          {'replacement_cost_mesos': 1e16}, {'mvp_rank': 'gold'},
                          {'shining_starforce_sunday': False}, {'superior_item': True}):
                with self.subTest(patch=patch):
                    self.assertEqual(client.post('/api/starforce-strategies', json={**payload, **patch}).status_code, 422)
