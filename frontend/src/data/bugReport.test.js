import assert from 'node:assert/strict'
import test from 'node:test'
import { formatBugReport } from './bugReport.js'

test('report preview preserves multiline reports and special characters', () => {
  const fields = { summary: ' Stars & booms? #25 ', area: 'Star Force', steps: '1. Set 0–25\n2. Compare',
    expected: 'A result', actual: 'Error &bcc=other@example.com', environment: '' }
  const report = formatBugReport(fields)
  assert.ok(report.startsWith('# Stars & booms? #25\n'))
  assert.ok(report.includes(fields.steps))
  assert.ok(report.includes(fields.actual))
  assert.ok(report.endsWith('Not provided'))
  for (const contact of ['Discord: maple_user', 'Reddit: u/maple_user', 'X: @maple_user']) {
    assert.ok(formatBugReport({ ...fields, contact: ` ${contact} ` }).endsWith(`## Contact information\n${contact}`))
  }
})
