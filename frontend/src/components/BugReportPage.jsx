import { useRef, useState } from 'react'
import BugReportView from './BugReportView'
import './bug-workshop.css'
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

  return <BugReportView {...{fields, report, copyStatus, submission, change, prepare, submitReport, copyReport, downloadReport}} />
}
