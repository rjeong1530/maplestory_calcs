import os
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from backend.api.main import app
from backend.api import bug_reports as reports


class BugReportTests(unittest.TestCase):
    def setUp(self):
        reports._clients.clear()
        self.client = TestClient(app)
        self.payload = dict(request_id=str(uuid4()), area='Star Force', summary='Wrong total',
                            steps='Choose 0–25', expected='A result', actual='An error', environment='Firefox')

    def test_saved_document_and_reference(self):
        collection = MagicMock()
        with patch.object(reports, 'report_collection', return_value=collection):
            response = self.client.post('/api/bug-reports', json=self.payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'saved', 'report_id': self.payload['request_id']})
        document = collection.insert_one.call_args.args[0]
        self.assertEqual(document['_id'], self.payload['request_id'])
        self.assertEqual(document['status'], 'new')
        self.assertIsNotNone(document['created_at'].tzinfo)
        self.assertNotIn('request_id', document)
        self.assertNotIn('ip', document)
        self.assertEqual(document['contact'], '')
        for contact in ('Discord: maple_user', 'Reddit: u/maple_user', 'X: @maple_user'):
            with patch.object(reports, 'report_collection', return_value=collection):
                response = self.client.post('/api/bug-reports', json={**self.payload, 'contact': f' {contact} '})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(collection.insert_one.call_args.args[0]['contact'], contact)

    def test_retry_is_idempotent_but_conflicting_payload_is_rejected(self):
        collection = MagicMock()
        collection.insert_one.side_effect = DuplicateKeyError('duplicate')
        collection.find_one.return_value = self.payload
        with patch.object(reports, 'report_collection', return_value=collection):
            self.assertEqual(self.client.post('/api/bug-reports', json=self.payload).status_code, 200)
            self.assertEqual(self.client.post('/api/bug-reports', json={**self.payload, 'summary': 'Changed'}).status_code, 409)

    def test_validation_rejects_empty_oversized_and_extra_fields(self):
        for changes in ({'summary': '  '}, {'steps': '\n '}, {'actual': 'x' * 2001},
                        {'area': 'Unknown'}, {'request_id': 'invalid'}, {'status': 'closed'}, {'summary': 123},
                        {'contact': 'x' * 201}, {'contact': 123}):
            reports._clients.clear()
            with patch.object(reports, 'report_collection') as storage:
                response = self.client.post('/api/bug-reports', json={**self.payload, **changes})
                self.assertEqual(response.status_code, 422, response.text)
                storage.assert_not_called()

    def test_unconfigured_database_does_not_break_health(self):
        with patch.dict(os.environ, {'MONGODB_URI': ''}), patch.object(reports, 'MongoClient') as factory:
            self.assertEqual(self.client.post('/api/bug-reports', json=self.payload).status_code, 503)
            self.assertEqual(self.client.get('/api/health').status_code, 200)
            factory.assert_not_called()

    def test_database_errors_do_not_expose_connection_details(self):
        collection = MagicMock()
        collection.insert_one.side_effect = ServerSelectionTimeoutError('secret-password@example.com')
        with patch.object(reports, 'report_collection', return_value=collection), self.assertLogs(reports.logger, 'WARNING') as logs:
            response = self.client.post('/api/bug-reports', json=self.payload)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('secret-password', response.text + str(logs.output))

    def test_rate_limit_and_no_public_read_endpoint(self):
        with patch.object(reports, 'report_collection', return_value=MagicMock()):
            for _ in range(5):
                self.assertEqual(self.client.post('/api/bug-reports', json=self.payload).status_code, 200)
            response = self.client.post('/api/bug-reports', json=self.payload)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers['retry-after'], '60')
        self.assertEqual(self.client.get('/api/bug-reports').status_code, 405)

    def test_client_reuse_and_shutdown(self):
        with patch.dict(os.environ, {'MONGODB_URI': 'mongodb://example.invalid', 'MONGODB_DATABASE': 'reports_test'}), \
                patch.object(reports, '_client', None), patch.object(reports, 'MongoClient') as factory:
            reports.report_collection()
            reports.report_collection()
            factory.assert_called_once()
            self.assertEqual(factory.call_args.kwargs['w'], 'majority')
            factory.return_value.__getitem__.assert_called_with('reports_test')
            reports.close_report_client()
            factory.return_value.close.assert_called_once()
            self.assertIsNone(reports._client)
