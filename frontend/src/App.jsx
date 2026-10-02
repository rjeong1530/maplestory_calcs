import { useEffect, useState } from 'react'
import { apiRequest } from './api'
import CalculatorForm from './components/CalculatorForm'
import EquipmentPlanner from './components/EquipmentPlanner'
import Results from './components/Results'
import StarForceCalculator from './components/StarForceCalculator'
import Navigation from './components/Navigation'
import usePageRoute from './hooks/usePageRoute'
import './App.css'

export default function App() {
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [calculator, navigate] = usePageRoute()

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
      <Navigation activePage={calculator} onNavigate={navigate} />
      <header className="page-header">
        <span className="eyebrow">MAPLESTORY · POTENTIAL LAB</span>
        <h1>Plan your next roll.</h1>
        <p>Estimate your odds or plan your equipment upgrades.</p>
      </header>

      {!calculator && <section className="panel">
        <h2>Page not found</h2>
        <p>Choose a calculator or Equipment upgrade from the navigation.</p>
      </section>}
      <div hidden={calculator !== 'starforce'}><StarForceCalculator /></div>
      <EquipmentPlanner activeTab={calculator} />
      <div hidden={calculator !== 'potential'}>
      {optionsError ? (
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
      </div>
    </main>
  )
}
