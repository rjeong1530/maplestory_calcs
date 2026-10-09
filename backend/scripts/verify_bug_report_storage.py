"""Check a real bug-report write/retry/read and delete only the test document.

Run from the repository root. Loads the ignored .env without printing secrets.
"""
from uuid import uuid4

from dotenv import load_dotenv

from backend.api.bug_reports import (
    BugReport, close_report_client, report_collection, submit_bug_report,
)


def main():
    load_dotenv('.env')
    report = BugReport(request_id=uuid4(), area='Other',
        summary='Temporary storage verification',
        steps='Automated connection verification; delete after checking.',
        expected='Report saved once and retrieved successfully.',
        actual='Temporary verification record.', environment='Development verification')
    collection = None
    failed = False
    try:
        collection = report_collection()
        result = submit_bug_report(report)
        retry = submit_bug_report(report)
        if result != retry or result['status'] != 'saved':
            raise RuntimeError('Unexpected submission result')
        document = collection.find_one({'_id': str(report.request_id)})
        if not document or document['summary'] != report.summary or document['status'] != 'new':
            raise RuntimeError('Stored document did not match')
        print('MongoDB report write, retry, and read verified.')
    except Exception as error:
        failed = True
        print(f'Verification failed: {type(error).__name__}; credentials and connection details omitted.')
    finally:
        if collection is not None:
            try:
                deleted = collection.delete_one({'_id': str(report.request_id)}).deleted_count
                print(f'Temporary test documents removed: {deleted}.')
            except Exception as error:
                failed = True
                print(f'Test cleanup failed: {type(error).__name__}. Test report ID: {report.request_id}')
        close_report_client()
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main())
