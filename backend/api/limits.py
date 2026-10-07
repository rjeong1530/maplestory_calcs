"""Per-process admission limits for CPU-heavy calculator requests."""
from collections import OrderedDict, deque
from contextlib import contextmanager
from math import isfinite
from threading import BoundedSemaphore, Lock
from time import monotonic
import os

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse


class RequestBodyLimit:
    """Bound JSON input before parsing, including chunked or misleading lengths."""

    def __init__(self, app, max_bytes=262_144):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        rejected = JSONResponse({'detail': 'Request body exceeds 256 KiB.'}, status_code=413)
        for name, value in scope.get('headers', []):
            if name.lower() == b'content-length':
                try:
                    if int(value) > self.max_bytes:
                        return await rejected(scope, receive, send)
                except ValueError:
                    pass  # Actual received bytes are always checked below.
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            if len(body) + len(chunk) > self.max_bytes:
                return await rejected(scope, receive, send)
            body.extend(chunk)
            if not message.get('more_body', False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {'type': 'http.request', 'body': bytes(body), 'more_body': False}

        await self.app(scope, replay, send)


class CalculationLimiter:
    def __init__(self, concurrent=2, per_minute=300, max_clients=1024, clock=monotonic):
        self.slots = BoundedSemaphore(concurrent)
        self.per_minute = per_minute
        self.max_clients = max_clients
        self.clock = clock
        self.clients = OrderedDict()
        self.lock = Lock()

    @contextmanager
    def admit(self, client):
        with self.lock:
            now = self.clock()
            requests = self.clients.pop(client, deque())
            while requests and requests[0] <= now - 60:
                requests.popleft()
            self.clients[client] = requests
            while len(self.clients) > self.max_clients:
                self.clients.popitem(last=False)
            if len(requests) >= self.per_minute:
                raise HTTPException(429, 'Too many calculations. Try again shortly.', headers={'Retry-After': '60'})
            if not self.slots.acquire(blocking=False):
                raise HTTPException(503, 'Calculators are busy. Try again shortly.', headers={'Retry-After': '2'})
            requests.append(now)
        try:
            yield
        finally:
            self.slots.release()


limiter = CalculationLimiter(
    concurrent=max(1, int(os.getenv('CALCULATION_CONCURRENCY', '2'))),
    per_minute=max(1, int(os.getenv('CALCULATIONS_PER_MINUTE', '300'))),
)


def calculation_slot(request: Request):
    # Use the server's resolved client, not untrusted forwarded headers.
    with limiter.admit(request.client.host if request.client else 'unknown'):
        yield


def require_finite(value):
    """Prevent successful responses containing overflowed costs/probabilities."""
    if isinstance(value, float) and not isfinite(value):
        raise HTTPException(422, 'Inputs exceed the supported numeric calculation range.')
    if isinstance(value, dict):
        for item in value.values():
            require_finite(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            require_finite(item)
    return value
