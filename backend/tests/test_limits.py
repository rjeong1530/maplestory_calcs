import unittest
import asyncio
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.api.main import app
from backend.api.limits import CalculationLimiter, calculation_slot, require_finite


class CalculationLimitTests(unittest.IsolatedAsyncioTestCase):
    async def test_http_calculation_waits_while_health_remains_available(self):
        from unittest.mock import patch
        limiter = CalculationLimiter(concurrent=1)
        client = TestClient(app)
        with patch('backend.api.limits.limiter', limiter):
            async with limiter.admit('occupied'):
                request = asyncio.create_task(asyncio.to_thread(client.post, '/api/starforce-estimate',
                    json={'item_level': 200, 'start_star': 0, 'target_star': 1}))
                await self.wait_for_queue(limiter, 1)
                self.assertFalse(request.done())
                health = await asyncio.to_thread(client.get, '/api/health')
                self.assertEqual(health.status_code, 200)
            response = await asyncio.wait_for(request, 3)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(limiter.active, 0)
            self.assertFalse(limiter.waiting)

    async def wait_for_queue(self, limiter, length):
        async def wait():
            while len(limiter.waiting) != length:
                await asyncio.sleep(.005)
        await asyncio.wait_for(wait(), 2)

    async def test_queued_requests_run_in_order_without_exceeding_concurrency(self):
        limiter = CalculationLimiter(concurrent=1, max_waiting=2)
        order = []
        async def calculate(name):
            async with limiter.admit(name):
                self.assertEqual(limiter.active, 1)
                order.append(name)
                await asyncio.sleep(.01)
        async with limiter.admit('occupied'):
            first = asyncio.create_task(calculate('first'))
            await self.wait_for_queue(limiter, 1)
            second = asyncio.create_task(calculate('second'))
            await self.wait_for_queue(limiter, 2)
            self.assertEqual(order, [])
            with self.assertRaises(HTTPException) as full:
                async with limiter.admit('overflow'):
                    self.fail('Queue capacity exceeded')
            self.assertEqual(full.exception.status_code, 503)
        await asyncio.wait_for(asyncio.gather(first, second), 2)
        self.assertEqual(order, ['first', 'second'])
        self.assertEqual(limiter.active, 0)
        self.assertFalse(limiter.waiting)

    async def test_queue_timeout_and_cancellation_free_waiting_capacity(self):
        limiter = CalculationLimiter(concurrent=1, max_waiting=1, wait_seconds=.03)
        async with limiter.admit('occupied'):
            with self.assertRaises(HTTPException) as timeout:
                async with limiter.admit('timeout'):
                    self.fail('Should time out')
            self.assertEqual(timeout.exception.status_code, 503)
            self.assertIn('timed out', timeout.exception.detail)
            self.assertFalse(limiter.waiting)
            limiter.wait_seconds = 2
            async def queued():
                async with limiter.admit('cancelled'):
                    self.fail('Cancelled request must not execute')
            task = asyncio.create_task(queued())
            await self.wait_for_queue(limiter, 1)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertFalse(limiter.waiting)
            self.assertEqual(limiter.active, 1)
        async with limiter.admit('next'):
            self.assertEqual(limiter.active, 1)

    async def test_disconnected_waiter_is_removed_and_rate_limit_counts_once(self):
        limiter = CalculationLimiter(concurrent=1, per_minute=1)
        async def disconnected():
            return True
        async with limiter.admit('occupied'):
            with self.assertRaises(HTTPException) as disconnected_error:
                async with limiter.admit('gone', disconnected):
                    self.fail('Disconnected request should not execute')
            self.assertEqual(disconnected_error.exception.status_code, 499)
            self.assertFalse(limiter.waiting)
            with self.assertRaises(HTTPException) as rate_error:
                async with limiter.admit('gone'):
                    self.fail('Already admitted request counts toward rate limit')
            self.assertEqual(rate_error.exception.status_code, 429)

    async def test_slots_release_after_failure_and_reject_excess_concurrency(self):
        limiter = CalculationLimiter(concurrent=1, max_waiting=0)
        with self.assertRaises(RuntimeError):
            async with limiter.admit('first'):
                with self.assertRaises(HTTPException) as rejected:
                    async with limiter.admit('second'):
                        self.fail('Should not acquire a second slot')
                self.assertEqual(rejected.exception.status_code, 503)
                raise RuntimeError('calculation failed')
        async with limiter.admit('third'):
            pass

    async def test_rate_window_and_client_memory_are_bounded(self):
        now = [0]
        limiter = CalculationLimiter(per_minute=1, max_clients=2, clock=lambda: now[0])
        async with limiter.admit('a'):
            pass
        with self.assertRaises(HTTPException) as rejected:
            async with limiter.admit('a'):
                pass
        self.assertEqual(rejected.exception.status_code, 429)
        now[0] = 60
        for client in ('a', 'b', 'c'):
            async with limiter.admit(client):
                pass
        self.assertEqual(len(limiter.clients), 2)

    async def test_nonfinite_results_are_not_successful_responses(self):
        with self.assertRaises(HTTPException) as rejected:
            require_finite({'cost': float('inf')})
        self.assertEqual(rejected.exception.status_code, 422)
        self.assertEqual(require_finite({'cost': 123, 'unavailable': None}), {'cost': 123, 'unavailable': None})

    async def test_api_numeric_limits_and_admission_response(self):
        client = TestClient(app, raise_server_exceptions=False)
        valid = {'item_level': 200, 'start_star': 15, 'target_star': 22, 'percentiles': []}
        for patch in ({'item_level': 10**200}, {'item_level': 301}, {'replacement_cost_mesos': 1e308}):
            self.assertEqual(client.post('/api/starforce-estimate', json={**valid, **patch}).status_code, 422)
        self.assertEqual(client.get('/api/starforce-costs?level=301').status_code, 422)
        limiter = CalculationLimiter(concurrent=1, max_waiting=0)
        async def limited():
            async with limiter.admit('test'):
                yield
        app.dependency_overrides[calculation_slot] = limited
        try:
            async with limiter.admit('occupied'):
                response = client.post('/api/starforce-estimate', json=valid)
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.headers['retry-after'], '2')
            self.assertEqual(client.post('/api/starforce-estimate', json=valid).status_code, 200)
        finally:
            app.dependency_overrides.pop(calculation_slot, None)
