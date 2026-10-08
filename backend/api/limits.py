"""Per-process admission limits for CPU-heavy calculator requests."""
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
from math import isfinite
from threading import Lock
from time import monotonic
import os
import asyncio

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
    """Bounded FIFO admission; waiting happens asynchronously, not in worker threads."""

    def __init__(self, concurrent=2, per_minute=300, max_clients=1024, clock=monotonic,
                 max_waiting=8, wait_seconds=20):
        self.concurrent = concurrent
        self.active = 0
        self.waiting = deque()
        self.max_waiting = max_waiting
        self.wait_seconds = wait_seconds
        self.per_minute = per_minute
        self.max_clients = max_clients
        self.clock = clock
        self.clients = OrderedDict()
        self.lock = Lock()

    @asynccontextmanager
    async def admit(self, client, disconnected=None):
        ticket = object()
        acquired = False
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
            if self.active < self.concurrent and not self.waiting:
                self.active += 1
                acquired = True
            else:
                if len(self.waiting) >= self.max_waiting:
                    raise HTTPException(503, 'The calculation queue is full. Please try again shortly.', headers={'Retry-After': '2'})
                self.waiting.append(ticket)
            # Count admission once, including queued requests, rather than every poll.
            requests.append(now)
        deadline = monotonic() + self.wait_seconds
        try:
            while not acquired:
                if disconnected is not None and await disconnected():
                    raise HTTPException(499, 'Calculation request disconnected while waiting.')
                if monotonic() >= deadline:
                    raise HTTPException(503, 'The calculation queue wait timed out. Please try again.', headers={'Retry-After': '2'})
                with self.lock:
                    if self.waiting[0] is ticket and self.active < self.concurrent:
                        self.waiting.popleft()
                        self.active += 1
                        acquired = True
                if not acquired:
                    # Short asynchronous polling keeps admission independent of a
                    # particular event loop and leaves the thread pool available.
                    await asyncio.sleep(min(.05, max(0, deadline - monotonic())))
            yield
        finally:
            with self.lock:
                if acquired:
                    self.active -= 1
                else:
                    self.waiting.remove(ticket)


limiter = CalculationLimiter(
    concurrent=max(1, int(os.getenv('CALCULATION_CONCURRENCY', '2'))),
    per_minute=max(1, int(os.getenv('CALCULATIONS_PER_MINUTE', '300'))),
    max_waiting=max(0, int(os.getenv('CALCULATION_QUEUE_SIZE', '8'))),
    wait_seconds=max(0, float(os.getenv('CALCULATION_QUEUE_TIMEOUT_SECONDS', '20'))),
)


async def calculation_slot(request: Request):
    # Use the server's resolved client, not untrusted forwarded headers.
    async with limiter.admit(request.client.host if request.client else 'unknown', request.is_disconnected):
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
