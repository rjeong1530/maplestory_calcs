import LoadingStatus from './LoadingStatus'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import CalculatorForm from './CalculatorForm'
import Results from './Results'

export default function PotentialCalculator() {
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/api/options', { signal: controller.signal })
      .then(setOptions)
      .catch(error => {
        if (!controller.signal.aborted) setOptionsError(error.message)
      })
    return () => controller.abort()
  }, [retry])

  async function calculate({ cube_sale, ...payload }) {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const calculated = await apiRequest('/api/probability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setResult({ ...calculated, cube_type: payload.cube_type, cube_sale })
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {optionsError ? (
        <div className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5" role="alert">
          <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]">{optionsError}</p>
          <button onClick={() => {
            setOptionsError('')
            setRetry(value => value + 1)
          }}>
            Retry connection
          </button>
        </div>
      ) : !options ? (
        <LoadingStatus>Loading calculator options…</LoadingStatus>
      ) : (
        <>
          <div className="calculator-grid grid grid-cols-[1.2fr_1fr] gap-6 items-start [@media(max-width:850px)]:grid-cols-1">
            <CalculatorForm
              options={options}
              busy={busy}
              onCalculate={calculate}
              onChange={() => { setResult(null); setError('') }}
            />
            <Results result={result} busy={busy} error={error} />
          </div>
          <footer>
            Independent-roll estimates. Meso budgets use your cost per cube; tier-ups and keep/replace decisions are not included.
          </footer>
        </>
      )}
    </>
  )
}
