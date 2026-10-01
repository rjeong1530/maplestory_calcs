import { useEffect, useState } from 'react'
import { apiRequest } from './api'
import CalculatorForm from './components/CalculatorForm'
import FlameCalculator from './components/FlameCalculator'
import Results from './components/Results'
import StarForceCalculator from './components/StarForceCalculator'
import './App.css'

export default function App() {
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [calculator, setCalculator] = useState('potential')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/api/options', { signal: controller.signal })
      .then(setOptions)
      .catch(error => {
        if (!controller.signal.aborted) setOptionsError(error.message)
      })
    return () => controller.abort()
  }, [retry])

  async function calculate(payload) {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await apiRequest('/api/probability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }))
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <header className="page-header">
        <span className="eyebrow">MAPLESTORY · POTENTIAL LAB</span>
        <h1>Plan your next roll.</h1>
        <p>Choose a calculator to estimate your odds.</p>
        <nav aria-label="Calculator" className="calculator-tabs">
          <button
            type="button"
            aria-pressed={calculator === 'potential'}
            onClick={() => setCalculator('potential')}
          >
            Potential
          </button>
          <button
            type="button"
            aria-pressed={calculator === 'flame'}
            onClick={() => setCalculator('flame')}
          >
            Flames
          </button>
          <button
            type="button"
            aria-pressed={calculator === 'starforce'}
            onClick={() => setCalculator('starforce')}
          >
            Star Force
          </button>
          <button
            type="button"
            aria-pressed={calculator === 'equipment'}
            onClick={() => setCalculator('equipment')}
          >
            Equipment
          </button>
        </nav>
      </header>

      {calculator === 'starforce' ? (
        <StarForceCalculator />
      ) : calculator !== 'potential' ? (
        <FlameCalculator activeTab={calculator} onTabChange={setCalculator} />
      ) : optionsError ? (
        <div className="panel" role="alert">
          <p className="error">{optionsError}</p>
          <button onClick={() => {
            setOptionsError('')
            setRetry(value => value + 1)
          }}>
            Retry connection
          </button>
        </div>
      ) : !options ? (
        <p role="status">Loading calculator options…</p>
      ) : (
        <>
          <div className="calculator-grid">
            <CalculatorForm
              options={options}
              busy={busy}
              onCalculate={calculate}
              onChange={() => { setResult(null); setError('') }}
            />
            <Results result={result} busy={busy} error={error} />
          </div>
          <footer>
            Independent-roll estimates. Tier-ups, keep/replace decisions, and meso costs are not included.
          </footer>
        </>
      )}
    </main>
  )
}
