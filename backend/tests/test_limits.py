import unittest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.api.main import app
from backend.api.limits import CalculationLimiter, calculation_slot, require_finite


class CalculationLimitTests(unittest.TestCase):
    def test_slots_release_after_failure_and_reject_excess_concurrency(self):
        limiter = CalculationLimiter(concurrent=1)
        with self.assertRaises(RuntimeError):
            with limiter.admit('first'):
                with self.assertRaises(HTTPException) as rejected:
                    with limiter.admit('second'):
                        self.fail('Should not acquire a second slot')
                self.assertEqual(rejected.exception.status_code, 503)
                raise RuntimeError('calculation failed')
        with limiter.admit('third'):
            pass

    def test_rate_window_and_client_memory_are_bounded(self):
        now = [0]
        limiter = CalculationLimiter(per_minute=1, max_clients=2, clock=lambda: now[0])
        with limiter.admit('a'):
            pass
        with self.assertRaises(HTTPException) as rejected:
            with limiter.admit('a'):
                pass
        self.assertEqual(rejected.exception.status_code, 429)
        now[0] = 60
        for client in ('a', 'b', 'c'):
            with limiter.admit(client):
                pass
        self.assertEqual(len(limiter.clients), 2)

    def test_nonfinite_results_are_not_successful_responses(self):
        with self.assertRaises(HTTPException) as rejected:
            require_finite({'cost': float('inf')})
        self.assertEqual(rejected.exception.status_code, 422)
        self.assertEqual(require_finite({'cost': 123, 'unavailable': None}), {'cost': 123, 'unavailable': None})

    def test_api_numeric_limits_and_admission_response(self):
        client = TestClient(app, raise_server_exceptions=False)
        valid = {'item_level': 200, 'start_star': 15, 'target_star': 22, 'percentiles': []}
        for patch in ({'item_level': 10**200}, {'item_level': 301}, {'replacement_cost_mesos': 1e308}):
            self.assertEqual(client.post('/api/starforce-estimate', json={**valid, **patch}).status_code, 422)
        self.assertEqual(client.get('/api/starforce-costs?level=301').status_code, 422)
        limiter = CalculationLimiter(concurrent=1)
        def limited():
            with limiter.admit('test'):
                yield
        app.dependency_overrides[calculation_slot] = limited
        try:
            with limiter.admit('occupied'):
                response = client.post('/api/starforce-estimate', json=valid)
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.headers['retry-after'], '2')
            self.assertEqual(client.post('/api/starforce-estimate', json=valid).status_code, 200)
        finally:
            app.dependency_overrides.pop(calculation_slot, None)
