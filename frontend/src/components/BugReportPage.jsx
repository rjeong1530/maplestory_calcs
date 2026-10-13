import { useRef, useState } from 'react'
import { formatBugReport } from '../data/bugReport'
import { apiRequest } from '../api'

export default function BugReportPage() {
  const [fields, setFields] = useState({ area: 'Star Force', summary: '', steps: '', expected: '', actual: '', environment: '', contact: '' })
  const [report, setReport] = useState(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [submission, setSubmission] = useState({})
  const requestId = useRef(null)
  const sending = useRef(false)

  function change(event) {
    setFields(current => ({ ...current, [event.target.name]: event.target.value }))
    setReport(null)
    setCopyStatus('')
    setSubmission({})
    requestId.current = null
  }

  function prepare(event) {
    event.preventDefault()
    setReport(formatBugReport(fields))
    setCopyStatus('')
    requestId.current ??= crypto.randomUUID()
  }

  async function submitReport() {
    if (sending.current || submission.saved) return
    sending.current = true
    setSubmission({ loading: true })
    try {
      const result = await apiRequest('/api/bug-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, request_id: requestId.current }),
      })
      setSubmission({ saved: result.report_id })
    } catch (error) {
      setSubmission({ error: error.message })
    } finally {
      sending.current = false
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report)
      setCopyStatus('Report copied.')
    } catch {
      setCopyStatus('Could not access the clipboard. Select and copy the report below, or download it.')
    }
  }

  function downloadReport() {
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'maplestory-bug-report.txt'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="panel mx-auto max-w-[760px] [&_.hint]:leading-[1.7]" aria-labelledby="bug-report-heading">
    <span className="eyebrow">FEEDBACK</span>
    <h2 id="bug-report-heading">Report a bug</h2>
    <p className="hint">Prepare your report, review the details, then submit it directly to the app's developer. No account or email app is needed.</p>
    <p className="hint">Include the inputs you used, such as equipment level, star range, modes, events, and replacement cost. For an incorrect result, include the result you expected and its source.</p>
    <form onSubmit={prepare}>
      <fieldset className="grid gap-4.5" disabled={submission.loading}>
      <label>Which part of the app?
        <select name="area" value={fields.area} onChange={change}>
          {['Star Force', 'Star Force strategies', 'Potential', 'Flames', 'Equipment upgrade', 'Navigation / display', 'Other'].map(area => <option key={area}>{area}</option>)}
        </select>
      </label>
      <label>Short summary
        <input name="summary" value={fields.summary} onChange={change} required maxLength={120} pattern=".*\S.*" placeholder="Example: Strategy comparison never finishes" />
      </label>
      {[
        ['steps', 'Steps to reproduce', '1. Open Star Force strategies\n2. Set level 200, 0–25 stars\n3. Click Compare strategies'],
        ['expected', 'What did you expect?', 'Describe what should happen.'],
        ['actual', 'What happened instead?', 'Include the result or exact error message.'],
      ].map(([name, label, placeholder]) => <label key={name}>{label}
        <textarea name={name} value={fields[name]} onChange={change} required maxLength={2000} rows={4} placeholder={placeholder} />
      </label>)}
      <label>Browser and device (optional)
        <input name="environment" value={fields.environment} onChange={change} maxLength={200} placeholder="Example: Firefox on Windows 11, or Safari on iPhone" />
      </label>
      <label>Contact information (optional)
        <input name="contact" value={fields.contact} onChange={change} maxLength={200}
          aria-describedby="bug-report-contact-hint" placeholder="Discord: username, Reddit: u/username, or X: @handle" />
      </label>
      <p id="bug-report-contact-hint" className="hint">Leave a Discord username, Reddit username, or X handle if you would like to be contacted about your report. Include the platform so we know where to reach you.</p>
      <p className="hint">Only the details you enter are included. Do not include passwords, account credentials, or other private information.</p>
      <button className="primary" type="submit">Prepare report</button>
      </fieldset>
    </form>
    {report && <section className="mt-7 border-t border-rule pt-3" aria-labelledby="report-preview-heading">
      <h3 id="report-preview-heading">Review your report</h3>
      <p className="hint">{submission.saved ? 'Your report has been saved. Thank you for helping improve the app.' : 'Review the details below before submitting your report.'}</p>
      <label>Report text<textarea readOnly value={report} rows={12} /></label>
      <div className="mt-4.5 flex flex-wrap gap-3">
        <button className="primary" type="button" disabled={submission.loading || !!submission.saved} onClick={submitReport}>
          {submission.loading ? 'Submitting…' : submission.saved ? 'Report submitted' : 'Submit report'}
        </button>
        <button type="button" onClick={copyReport}>Copy report</button>
        <button type="button" onClick={downloadReport}>Download report</button>
      </div>
      {submission.error && <p className="error" role="alert">{submission.error}</p>}
      {submission.saved && <p role="status">Report reference: {submission.saved}</p>}
      <p role="status">{copyStatus}</p>
    </section>}
  </section>
}
