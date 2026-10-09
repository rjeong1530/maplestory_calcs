"""Private MongoDB storage behind the public, write-only report endpoint."""
from collections import OrderedDict, deque
from datetime import datetime, timezone
import logging
import os
from threading import Lock
from time import monotonic
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

router = APIRouter()
logger = logging.getLogger(__name__)
_client = None
_client_lock = Lock()
_clients = OrderedDict()
_rate_lock = Lock()


class BugReport(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    request_id: UUID
    area: Literal['Star Force', 'Star Force strategies', 'Potential', 'Flames',
                  'Equipment upgrade', 'Navigation / display', 'Other']
    summary: str = Field(min_length=1, max_length=120, strict=True)
    steps: str = Field(min_length=1, max_length=2000, strict=True)
    expected: str = Field(min_length=1, max_length=2000, strict=True)
    actual: str = Field(min_length=1, max_length=2000, strict=True)
    environment: str = Field(default='', max_length=200, strict=True)


def report_limit(request: Request):
    # Transient per-worker abuse limit; IP addresses are never stored in MongoDB.
    key = request.client.host if request.client else 'unknown'
    with _rate_lock:
        now = monotonic()
        recent = _clients.pop(key, deque())
        while recent and recent[0] <= now - 60:
            recent.popleft()
        _clients[key] = recent
        while len(_clients) > 1024:
            _clients.popitem(last=False)
        if len(recent) >= 5:
            raise HTTPException(429, 'Too many bug reports. Please wait a minute.',
                                headers={'Retry-After': '60'})
        recent.append(now)


def report_collection():
    global _client
    uri = os.getenv('MONGODB_URI', '').strip()
    if not uri:
        raise HTTPException(503, 'Bug reporting is not available yet. Please try again later.')
    with _client_lock:
        if _client is None:
            _client = MongoClient(uri, connect=False, maxPoolSize=5, minPoolSize=0,
                serverSelectionTimeoutMS=5000, connectTimeoutMS=5000,
                waitQueueTimeoutMS=5000, timeoutMS=10000, w='majority')
    return _client[os.getenv('MONGODB_DATABASE', 'maplestory')]['bug_reports']


def close_report_client():
    global _client
    with _client_lock:
        if _client is not None:
            _client.close()
            _client = None


@router.post('/api/bug-reports', dependencies=[Depends(report_limit)])
def submit_bug_report(report: BugReport):
    report_id = str(report.request_id)
    fields = report.model_dump(exclude={'request_id'})
    document = {**fields, '_id': report_id, 'status': 'new',
                'created_at': datetime.now(timezone.utc)}
    try:
        collection = report_collection()
        try:
            collection.insert_one(document)
        except DuplicateKeyError:
            # A retry after a lost HTTP response must not create a second report.
            existing = collection.find_one({'_id': report_id})
            if existing is None or any(existing.get(key) != value for key, value in fields.items()):
                raise HTTPException(409, 'This report ID is already in use. Prepare a new report.') from None
    except (PyMongoError, ValueError) as error:
        # Driver errors can include connection details; log only the error class.
        logger.warning('Bug report storage failed (%s)', type(error).__name__)
        raise HTTPException(503, 'Could not confirm your report was saved. Please retry; your text is still available.') from None
    return {'report_id': report_id, 'status': 'saved'}
