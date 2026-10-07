"""Per-process admission limits for CPU-heavy calculator requests."""
from collections import OrderedDict, deque
from contextlib import contextmanager
from math import isfinite
from threading import BoundedSemaphore, Lock
from time import monotonic
import os

from fastapi import HTTPException, Request


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
