import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import SuccessChances from './SuccessChances'
import StarForceStrategies from './StarForceStrategies'
import { SUCCESS_CHANCES } from '../data/successChances'

import { count as formatMesos } from '../data/numberFormat'
import { MVP_RANKS } from '../data/equipmentUpgrade.js'
const rateFormat = new Intl.NumberFormat('en-US', {
  style: 'percent', maximumFractionDigits: 4,
})
const formatRate = value => rateFormat.format(value)

const initialForm = {
  item_level: '200',
  start_star: '15',
  target_star: '22',
  replacement_cost_mesos: '0',
  shining_starforce_sunday: true,
  mvp_rank: 'none',
  superior_item: false,
  mode_by_star: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index + 15, '1'])),
  safeguard_by_star: { 15: false, 16: false, 17: false },
}

export default function StarForceCalculator({ planner, view, setView }) {
  const [form, setForm] = useState(initialForm)
  const [selectedChances, setSelectedChances] = useState(SUCCESS_CHANCES)
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
    const query = new URLSearchParams({
      level: String(level),
      shining_starforce_sunday: String(form.shining_starforce_sunday),
      mvp_rank: form.mvp_rank,
      superior_item: String(form.superior_item),
    })
    apiRequest(`/api/starforce-costs?${query}`, { signal: controller.signal })
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
  }, [form.item_level, form.shining_starforce_sunday, form.mvp_rank, form.superior_item])

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
    } else if (['shining_starforce_sunday', 'mvp_rank', 'superior_item'].includes(name)) {
      setCostsBusy(true)
      setCostsError('')
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
      percentiles: selectedChances.map(chance => chance / 100),
      item_level: Number(form.item_level),
      start_star: Number(form.start_star),
      target_star: Number(form.target_star),
      replacement_cost_mesos: Number(form.replacement_cost_mesos),
      shining_starforce_sunday: Boolean(form.shining_starforce_sunday),
      mvp_rank: form.mvp_rank,
      superior_item: form.superior_item,
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
      <div className="calculator-tabs" role="group" aria-label="Star Force view">
        <button type="button" aria-pressed={view === 'estimate'} onClick={() => setView('estimate')}>Custom estimate</button>
        <button type="button" aria-pressed={view === 'strategies'} onClick={() => setView('strategies')}>Compare strategies</button>
      </div>
      <div hidden={view !== 'strategies'}><StarForceStrategies form={form} onChange={update} planner={planner} /></div>
      <div hidden={view !== 'estimate'}>
      <div className="calculator-grid">
        <form className="panel starforce-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend>Star Force settings</legend>
            <div className="starforce-fields">
              <label>Replacement cost per boom (mesos)
                <input name="replacement_cost_mesos" type="number" min="0" step="any"
                  value={form.replacement_cost_mesos} onChange={update} required />
              </label>
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
              <label className="starforce-safeguard-control">
                <input name="shining_starforce_sunday" type="checkbox"
                  checked={form.shining_starforce_sunday}
                  onChange={update} />
                <span>Shining Star Force Sunday</span>
              </label>
              <label>MVP rank
                <select name="mvp_rank" value={form.mvp_rank} onChange={update}>
                  {Object.entries(MVP_RANKS).map(([rank, label]) => (
                    <option value={rank} key={rank}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="starforce-safeguard-control">
                <input name="superior_item" type="checkbox" checked={form.superior_item}
                  onChange={update} />
                <span>Superior item (MVP discount excluded)</span>
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
            <SuccessChances estimateLabel="total meso budgets" selected={selectedChances} onChange={chances => {
              setSelectedChances(chances)
              setResult(null)
              setError('')
            }} />
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
                  <p>Choose an item level and star range to estimate the cost and booms.</p>
                </div>
              ) : (
                <>
                  <dl className="starforce-metrics">
                    <div>
                      <dt>Expected total mesos</dt>
                      <dd>{formatMesos(result.expected_cost)}</dd>
                    </div>
                    <div>
                      <dt>Expected replacement mesos</dt>
                      <dd>{formatMesos(result.expected_replacement_cost)}</dd>
                    </div>
                    <div>
                      <dt>Expected booms</dt>
                      <dd>{result.expected_booms.toLocaleString('en-US', { maximumFractionDigits: 3 })}</dd>
                    </div>
                  </dl>
                  {result.meso_estimates?.length > 0 && <>
                    <table>
                      <caption>Total meso budget to reach your target stars</caption>
                      <thead><tr><th scope="col">Success chance</th><th scope="col">Estimated total mesos</th></tr></thead>
                      <tbody>{result.meso_estimates.map(estimate => (
                        <tr key={estimate.target_probability}>
                          <td>{formatRate(estimate.target_probability)}</td>
                          <td>{estimate.mesos == null ? 'Beyond calculation limit' : formatMesos(estimate.mesos)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    <p className="hint result-note">Approximate budgets for reaching the target at each success chance, including enhancement, boom recovery, and replacement costs with your selected discounts. Costs are rounded up during calculation for conservative estimates. These are budget percentiles, not averages or guarantees.</p>
                  </>}
                  <p className="hint result-note">
                    Total mesos include enhancement costs and expected booms multiplied by your replacement cost.
                    The selected Shining Star Force Sunday and MVP discounts are applied to eligible enhancement costs.
                  </p>
                </>
              )}
        </section>
      </div>

      <section className="panel starforce-cost-panel">
        <div className="section-heading starforce-cost-heading">
          <h2>Cost per tap</h2>
          <span>{form.shining_starforce_sunday ? 'SHINING ON' : 'SHINING OFF'} · {form.item_level ? `LEVEL ${form.item_level}` : 'SET A LEVEL'}</span>
        </div>
        <p className="hint">Shining Star Force Sunday discounts costs at every star. The selected MVP rank discounts non-Superior
          equipment on attempts up to 17★. Discounts combine multiplicatively; on safeguarded attempts, they apply to the base-cost
          portion while the safeguard surcharge remains unchanged. MVP: {MVP_RANKS[form.mvp_rank]}
          {form.superior_item ? ' (excluded for this Superior item)' : ''}. The Mode 4 cost column shows safeguard costs from 15★ to 17★;
          Mode 4 rates are unavailable there.</p>
        {costsBusy ? <p role="status">Loading tap costs…</p>
          : costsError ? <p className="error" role="alert">{costsError}</p>
            : costRows && (
              <div className="starforce-table-wrap">
                <table className="starforce-table">
                  <caption>Mesos per tap for level {form.item_level}; mode costs include the selected event and eligible MVP discount</caption>
                  <thead>
                    <tr>
                      <th scope="col">Transition</th>
                      <th scope="col">Base (no discounts)</th>
                      {[1, 2, 3, 4].map(mode => (
                        <th scope="col" key={mode}>
                          {mode === 4 ? 'Mode 4 / Safeguard 15★–17★' : `Mode ${mode}`}
                        </th>
                      ))}
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
      <section className="panel starforce-cost-panel">
        <div className="section-heading starforce-cost-heading">
          <h2>Success, fail and boom chances</h2>
          <span>{form.shining_starforce_sunday ? 'SHINING ON' : 'SHINING OFF'} · ALL FOUR MODES</span>
        </div>
        <p className="hint">Rates below reflect the selected Shining Star Force Sunday setting
          ({form.shining_starforce_sunday ? '30% lower boom chance at 15★–21★' : 'no event boom reduction'}).
          MVP rank changes costs, not success or boom chances. Compare modes without safeguard. Mode 4 is unavailable from 15★ to 17★.
          Rates outside 15★–21★ are identical across modes. Fail excludes booms;
          failures lose one star from 10★–14★ and 22★ onward, and otherwise keep the current star.</p>
        {costsBusy ? <p role="status">Loading rates…</p>
          : costsError ? <p className="error" role="alert">{costsError}</p>
            : costRows && <>
              <div className="starforce-table-wrap" tabIndex="0" role="region" aria-label="Star Force rates by mode">
                <table className="starforce-table">
                  <caption>Per-attempt chances with Shining Star Force Sunday {form.shining_starforce_sunday ? 'enabled' : 'disabled'}</caption>
                  <thead>
                    <tr>
                      <th scope="col" rowSpan="2">Transition</th>
                      {[1, 2, 3, 4].map(mode => <th scope="colgroup" colSpan="3" key={mode}>Mode {mode}</th>)}
                    </tr>
                    <tr>{[1, 2, 3, 4].flatMap(mode => ['Success', 'Fail', 'Boom'].map(outcome => (
                      <th scope="col" key={`${mode}-${outcome}`}>{outcome}</th>
                    )))}</tr>
                  </thead>
                  <tbody>{costRows.map(row => (
                    <tr key={row.star}>
                      <th scope="row">{row.star}★ to {row.star + 1}★</th>
                      {[1, 2, 3, 4].flatMap(mode => {
                        const rates = row.mode_rates[String(mode)]
                        return rates
                          ? [rates.success, rates.maintain + rates.downgrade, rates.boom].map((rate, index) => (
                            <td key={`${mode}-${index}`}>{formatRate(rate)}</td>
                          ))
                          : [<td key={mode} colSpan="3">N/A</td>]
                      })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="hint">Safeguard overrides the selected mode with Mode 1 and removes booms:</p>
              <ul className="hint">{costRows.filter(row => row.safeguard_rates).map(row => (
                <li key={row.star}>{row.star}★ to {row.star + 1}★: success {formatRate(row.safeguard_rates.success)},
                  {' '}fail {formatRate(row.safeguard_rates.maintain + row.safeguard_rates.downgrade)},
                  {' '}boom {formatRate(row.safeguard_rates.boom)}.</li>
              ))}</ul>
            </>}
      </section>
      </div>
    </>
  )
}
