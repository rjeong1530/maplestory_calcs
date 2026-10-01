import { useEffect, useState } from 'react'
import { apiRequest } from '../api'

const formatMesos = value => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
}).format(value)

const initialForm = {
  item_level: '200',
  start_star: '15',
  target_star: '22',
  mode_by_star: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index + 15, '1'])),
  safeguard_by_star: { 15: false, 16: false, 17: false },
}

export default function StarForceCalculator() {
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [costRows, setCostRows] = useState(null)
  const [costsBusy, setCostsBusy] = useState(true)
  const [costsError, setCostsError] = useState('')

  useEffect(() => {
    const level = Number(form.item_level)
    if (!Number.isInteger(level) || level <= 0) {
      return undefined
    }

    const controller = new AbortController()
    apiRequest(`/api/starforce-costs?level=${level}`, { signal: controller.signal })
      .then(data => setCostRows(data.costs_by_star))
      .catch(requestError => {
        if (!controller.signal.aborted) {
          setCostRows(null)
          setCostsError(requestError.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCostsBusy(false)
      })
    return () => controller.abort()
  }, [form.item_level])

  function update(event) {
    const { name, value, type, checked } = event.target
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    if (name === 'item_level') {
      const level = Number(value)
      if (Number.isInteger(level) && level > 0) {
        setCostsBusy(true)
        setCostsError('')
      } else {
        setCostRows(null)
        setCostsBusy(false)
        setCostsError('Enter a positive equipment level to view tap costs.')
      }
    }
    setResult(null)
    setError('')
  }

  function updateStarSetting(name, star, value) {
    setForm(current => ({
      ...current,
      [name]: { ...current[name], [star]: value },
    }))
    setResult(null)
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)

    const payload = {
      item_level: Number(form.item_level),
      start_star: Number(form.start_star),
      target_star: Number(form.target_star),
      mode_by_star: Object.fromEntries(
        Object.entries(form.mode_by_star).map(([star, mode]) => [star, Number(mode)]),
      ),
      safeguard_by_star: form.safeguard_by_star,
    }

    try {
      setResult(await apiRequest('/api/starforce-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="calculator-grid">
        <form className="panel starforce-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend>Star Force settings</legend>
            <div className="starforce-fields">
              <label>Equipment level
                <input name="item_level" type="number" min="1" step="1"
                  value={form.item_level} onChange={update} required />
              </label>
              <label>Starting stars
                <input name="start_star" type="number" min="0" max="29" step="1"
                  value={form.start_star} onChange={update} required />
              </label>
              <label>Target stars
                <input name="target_star" type="number" min="1" max="30" step="1"
                  value={form.target_star} onChange={update} required />
              </label>
            </div>
            <div className="section-heading starforce-settings-heading">
              <h2>Per-star settings</h2>
              <span>15★ TO 21★</span>
            </div>
            <div className="starforce-mode-wrap">
              <table className="starforce-mode-table">
                <thead>
                  <tr><th scope="col">Transition</th><th scope="col">Mode</th><th scope="col">Safeguard</th></tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }, (_, index) => index + 15).map(star => (
                    <tr key={star}>
                      <th scope="row">{star}★ to {star + 1}★</th>
                      <td>
                        <select aria-label={`Enhancement mode from ${star} stars`}
                          value={form.mode_by_star[star]}
                          onChange={event => updateStarSetting('mode_by_star', star, event.target.value)}>
                          {(star <= 17 ? [1, 2, 3] : [1, 2, 3, 4]).map(mode => (
                            <option key={mode} value={mode}>Mode {mode}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {star <= 17 ? (
                          <label className="starforce-safeguard-control">
                            <input type="checkbox" aria-label={`Safeguard attempt from ${star} stars`}
                              checked={form.safeguard_by_star[star]}
                              onChange={event => updateStarSetting(
                                'safeguard_by_star', star, event.target.checked,
                              )} />
                            <span>On</span>
                          </label>
                        ) : <span className="starforce-not-applicable">N/A</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint starforce-rules-note">
              Safeguarding applies only to selected 15★–17★ attempts. Boom recovery follows the star-specific rules.
            </p>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Calculating…' : 'Calculate expected cost'}
            </button>
          </fieldset>
        </form>

        <section className="panel results starforce-result" aria-live="polite" aria-busy={busy}>
          <span className="eyebrow">STAR FORCE ESTIMATE</span>
          <h2>Expected outcome</h2>
          {busy ? <p role="status">Calculating expected costs…</p>
            : error ? <p className="error" role="alert">{error}</p>
              : !result ? (
                <div className="empty">
                  <span className="empty-icon" aria-hidden="true">☆</span>
                  <h3>Set your target</h3>
                  <p>Choose an item level and star range to estimate the cost, attempts, and booms.</p>
                </div>
              ) : (
                <>
                  <dl className="starforce-metrics">
                    <div>
                      <dt>Expected mesos</dt>
                      <dd>{formatMesos(result.expected_cost)}</dd>
                    </div>
                    <div>
                      <dt>Expected attempts</dt>
                      <dd>{result.expected_attempts.toLocaleString('en-US', { maximumFractionDigits: 2 })}</dd>
                    </div>
                    <div>
                      <dt>Expected booms</dt>
                      <dd>{result.expected_booms.toLocaleString('en-US', { maximumFractionDigits: 3 })}</dd>
                    </div>
                  </dl>
                  <p className="hint result-note">
                    Expected mesos exclude item replacement costs, discounts, and event modifiers.
                  </p>
                </>
              )}
        </section>
      </div>

      <section className="panel starforce-cost-panel">
        <div className="section-heading starforce-cost-heading">
          <h2>Cost per tap</h2>
          <span>{form.item_level ? `LEVEL ${form.item_level}` : 'SET A LEVEL'}</span>
        </div>
        <p className="hint">Mode costs outside 15★–21★ match the base cost. Mode 4 is unavailable from 15★ to 17★.</p>
        {costsBusy ? <p role="status">Loading tap costs…</p>
          : costsError ? <p className="error" role="alert">{costsError}</p>
            : costRows && (
              <div className="starforce-table-wrap">
                <table className="starforce-table">
                  <caption>Mesos for each transition, based on level {form.item_level} equipment</caption>
                  <thead>
                    <tr>
                      <th scope="col">Transition</th>
                      <th scope="col">Base</th>
                      {[1, 2, 3, 4].map(mode => <th scope="col" key={mode}>Mode {mode}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {costRows.map(row => (
                      <tr key={row.star}>
                        <th scope="row">{row.star}★ to {row.star + 1}★</th>
                        <td>{formatMesos(row.base_cost)}</td>
                        {[1, 2, 3, 4].map(mode => (
                          <td key={mode}>
                            {row.mode_costs[String(mode)] === null
                              ? 'N/A' : formatMesos(row.mode_costs[String(mode)])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </section>
    </>
  )
}