import LoadingStatus from './LoadingStatus'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import useCalculationRequest from '../hooks/useCalculationRequest'
import StarForceStrategies from './StarForceStrategies'
import StarForceBudget from './StarForceBudget'
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
  const { busy, error, result, run, clear } = useCalculationRequest(JSON.stringify(form))
  const [costRows, setCostRows] = useState(null)
  const [costsBusy, setCostsBusy] = useState(true)
  const [costsError, setCostsError] = useState('')

  useEffect(() => {
    const level = Number(form.item_level)
    if (!Number.isInteger(level) || level <= 0 || level > 300) {
      return undefined
    }

    const controller = new AbortController()
    const query = new URLSearchParams({
      level: String(level),
      shining_starforce_sunday: String(form.shining_starforce_sunday),
      mvp_rank: form.mvp_rank,
      superior_item: String(form.superior_item),
    })
    // Wait for typing to settle instead of fetching a cost table per keystroke.
    const timer = setTimeout(() => {
      apiRequest(`/api/starforce-costs?${query}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setCostRows(data.costs_by_star) })
        .catch(requestError => {
          if (!controller.signal.aborted) {
            setCostRows(null)
            setCostsError(requestError.message)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setCostsBusy(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [form.item_level, form.shining_starforce_sunday, form.mvp_rank, form.superior_item])

  function update(event) {
    const { name, value, type, checked } = event.target
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    if (['item_level', 'shining_starforce_sunday', 'mvp_rank', 'superior_item'].includes(name)) {
      const level = Number(name === 'item_level' ? value : form.item_level)
      if (Number.isInteger(level) && level > 0 && level <= 300) {
        setCostsBusy(true)
        setCostsError('')
      } else {
        setCostRows(null)
        setCostsBusy(false)
        setCostsError('Enter an equipment level from 1 to 300 to view tap costs.')
      }
    }
    clear()
  }

  function updateStarSetting(name, star, value) {
    setForm(current => ({
      ...current,
      [name]: { ...current[name], [star]: value },
    }))
    clear()
  }

  async function submit(event) {
    event.preventDefault()

    const payload = {
      percentiles: SUCCESS_CHANCES.map(chance => chance / 100),
      include_budget_distribution: true,
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

    await run('/api/starforce-estimate', payload)
  }

  return (
    <>
      <div className="starforce-view-switch inline-flex gap-1 max-w-full mb-6 p-1.25 border border-solid border-rule rounded-sm
        bg-ink [&_>_button]:[flex:1] [&_>_button]:min-w-0 [&_>_button]:min-h-10 [&_>_button]:py-2.25 [&_>_button]:px-4
        [&_>_button]:border [&_>_button]:border-solid [&_>_button]:border-transparent [&_>_button]:rounded-sm
        [&_>_button]:bg-transparent [&_>_button]:text-muted [&_>_button]:text-[13px] [&_>_button]:font-semibold
        [&_>_button]:leading-[1.4] [&_>_button]:[transition:background-color_150ms_ease,_color_150ms_ease]
        [&_>_button:hover:not(:disabled)]:bg-[#302f29] [&_>_button:hover:not(:disabled)]:text-[#eeede6]
        [&_>_button[aria-pressed='true']]:bg-[#373022] [&_>_button[aria-pressed='true']]:border-[#826c44]
        [&_>_button[aria-pressed='true']]:text-maple [&_>_button[aria-pressed='true']]:[box-shadow:0_2px_5px_#0003]" role="group" aria-label="Star Force view">
        <button type="button" aria-pressed={view === 'estimate'} onClick={() => setView('estimate')}>Custom estimate</button>
        <button type="button" aria-pressed={view === 'strategies'} onClick={() => setView('strategies')}>Compare strategies</button>
      </div>
      <div hidden={view !== 'strategies'}><StarForceStrategies form={form} onChange={update} planner={planner} /></div>
      <div hidden={view !== 'estimate'}>
      <div className="calculator-grid grid grid-cols-[1.2fr_1fr] gap-6 items-start [@media(max-width:850px)]:grid-cols-1">
        <form className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5 starforce-form min-w-0" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend>Star Force settings</legend>
            <div className="starforce-fields grid grid-cols-2 gap-y-4 gap-x-3 [@media(max-width:480px)]:grid-cols-1">
              <label>Replacement cost per boom (mesos)
                <input name="replacement_cost_mesos" type="number" min="0" max="1000000000000000" step="any"
                  value={form.replacement_cost_mesos} onChange={update} required />
              </label>
              <label>Equipment level
                <input name="item_level" type="number" min="1" max="300" step="1"
                  value={form.item_level} onChange={update} required />
              </label>
              <label>Starting stars
                <input name="start_star" type="number" min="0" max="29" step="1"
                  value={form.start_star} onChange={update} required />
              </label>
              <label>Target stars
                <input name="target_star" type="number" min={Number(form.start_star) + 1} max="30" step="1"
                  value={form.target_star} onChange={update} required />
              </label>
              <label className="starforce-safeguard-control flex-row justify-center items-center gap-1.75 [@media(max-width:480px)]:gap-1
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-maple [&_input]:m-0">
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
              <label className="starforce-safeguard-control flex-row justify-center items-center gap-1.75 [@media(max-width:480px)]:gap-1
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-maple [&_input]:m-0">
                <input name="superior_item" type="checkbox" checked={form.superior_item}
                  onChange={update} />
                <span>Superior item (MVP discount excluded)</span>
              </label>
            </div>
            <div className="section-heading starforce-settings-heading flex items-center justify-between gap-2 mt-7 mx-0 mb-3
        [&_span]:text-[10px] [&_span]:text-maple [&_span]:tracking-[0] [&_h2]:m-0">
              <h2>Per-star settings</h2>
              <span>15★ TO 21★</span>
            </div>
            <div className="overflow-x-auto">
              <table className="starforce-mode-table min-w-110 m-0 [@media(max-width:480px)]:w-full [@media(max-width:480px)]:min-w-0
        [@media(max-width:480px)]:table-fixed [&_th]:py-2 [&_th]:px-2.5 [&_th]:[vertical-align:middle] [&_td]:py-2
        [&_td]:px-2.5 [&_td]:[vertical-align:middle] [&_th:last-child]:text-center [&_td:last-child]:text-center
        [&_td_select]:p-2 [@media(max-width:480px)]:[&_th]:py-2 [@media(max-width:480px)]:[&_th]:px-1
        [@media(max-width:480px)]:[&_td]:py-2 [@media(max-width:480px)]:[&_td]:px-1
        [@media(max-width:480px)]:[&_th:first-child]:w-[31.5%] [@media(max-width:480px)]:[&_td:first-child]:w-[31.5%]
        [@media(max-width:480px)]:[&_th:nth-child(2)]:w-[38.5%] [@media(max-width:480px)]:[&_td:nth-child(2)]:w-[38.5%]
        [@media(max-width:480px)]:[&_th:last-child]:w-[30%] [@media(max-width:480px)]:[&_td:last-child]:w-[30%]
        [@media(max-width:480px)]:[&_td_select]:py-2 [@media(max-width:480px)]:[&_td_select]:px-1
        [@media(max-width:480px)]:[&_td_select]:text-[12px]">
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
                          <label className="starforce-safeguard-control flex-row justify-center items-center gap-1.75 [@media(max-width:480px)]:gap-1
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-maple [&_input]:m-0">
                            <input type="checkbox" aria-label={`Safeguard attempt from ${star} stars`}
                              checked={form.safeguard_by_star[star]}
                              onChange={event => updateStarSetting(
                                'safeguard_by_star', star, event.target.checked,
                              )} />
                            <span>On</span>
                          </label>
                        ) : <span className="text-muted text-[12px]">N/A</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint text-[12px] text-muted mt-3 mx-0 mb-6">
              Safeguarding applies only to selected 15★–17★ attempts. Boom recovery follows the star-specific rules.
            </p>
            <button type="submit" className="primary w-full font-bold bg-maple text-[#201b12] border-maple p-3.5 [&:hover:not(:disabled)]:bg-[#f2ce91]" disabled={busy}>
              {busy ? 'Calculating…' : 'Calculate expected cost'}
            </button>
          </fieldset>
        </form>

        <section className="panel results bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5 [&_h2]:mt-3 [&_h2]:text-[22px] starforce-result" aria-live="polite" aria-busy={busy}>
          <span className="eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple">STAR FORCE ESTIMATE</span>
          <h2>Expected outcome</h2>
          {busy ? <LoadingStatus>Calculating expected costs…</LoadingStatus>
            : error ? <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{error}</p>
              : !result ? (
                <div className="empty pt-8.5 px-0 pb-3 border-t border-solid border-t-rule mt-6 text-muted text-[14px] [&_h3]:text-[#eeede6] [&_h3]:mt-5">
                  <span className="text-[56px] text-[#a0967c]" aria-hidden="true">☆</span>
                  <h3>Set your target</h3>
                  <p>Choose an item level and star range to estimate the cost and booms.</p>
                </div>
              ) : (
                <>
                  <dl className="starforce-metrics grid gap-4.5 mt-7.5 mx-0 mb-0 [&_div]:flex [&_div]:flex-wrap [&_div]:justify-between
        [&_div]:gap-y-2 [&_div]:gap-x-4 [&_div]:pb-3.5 [&_div]:border-b [&_div]:border-solid [&_div]:border-b-rule
        [&_dt]:text-muted [&_dt]:text-[13px] [&_dd]:m-0 [&_dd]:text-[19px] [&_dd]:font-bold [&_dd]:tabular-nums
        [&_dd]:[overflow-wrap:anywhere]">
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
                  {result.budget_distribution && <StarForceBudget result={result} />}
                  <p className="hint text-[12px] text-muted mt-5.5 mb-0">
                    Total mesos include enhancement costs and expected booms multiplied by your replacement cost.
                    The selected Shining Star Force Sunday and MVP discounts are applied to eligible enhancement costs.
                  </p>
                </>
              )}
        </section>
      </div>

      <section className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5 starforce-cost-panel mt-6">
        <div className="section-heading starforce-cost-heading flex items-center justify-between gap-2 mt-0 [&_span]:text-[10px]
        [&_span]:text-maple [&_span]:tracking-[0] [&_h2]:m-0">
          <h2>Cost per tap</h2>
          <span>{form.shining_starforce_sunday ? 'SHINING ON' : 'SHINING OFF'} · {form.item_level ? `LEVEL ${form.item_level}` : 'SET A LEVEL'}</span>
        </div>
        <p className="hint text-[12px] text-muted mb-4.5">Shining Star Force Sunday discounts costs at every star. The selected MVP rank discounts non-Superior
          equipment on attempts up to 17★. Discounts combine multiplicatively; on safeguarded attempts, they apply to the base-cost
          portion while the safeguard surcharge remains unchanged. MVP: {MVP_RANKS[form.mvp_rank]}
          {form.superior_item ? ' (excluded for this Superior item)' : ''}. The Mode 4 cost column shows safeguard costs from 15★ to 17★;
          Mode 4 rates are unavailable there.</p>
        {costsBusy ? <LoadingStatus>Loading tap costs…</LoadingStatus>
          : costsError ? <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{costsError}</p>
            : costRows && (
              <div className="starforce-table-wrap max-h-120 overflow-auto border border-solid border-rule rounded-sm">
                <table className="starforce-table min-w-175 m-0 tabular-nums [&_th]:py-2.75 [&_th]:px-3 [&_th]:text-right
        [&_th]:whitespace-nowrap [&_td]:py-2.75 [&_td]:px-3 [&_td]:text-right [&_td]:whitespace-nowrap
        [&_th:first-child]:text-left [&_td:first-child]:text-left [&_thead_th]:sticky [&_thead_th]:top-0
        [&_thead_th]:z-[1] [&_thead_th]:bg-surface">
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
      <section className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5 starforce-cost-panel mt-6">
        <div className="section-heading starforce-cost-heading flex items-center justify-between gap-2 mt-0 [&_span]:text-[10px]
        [&_span]:text-maple [&_span]:tracking-[0] [&_h2]:m-0">
          <h2>Success, fail and boom chances</h2>
          <span>{form.shining_starforce_sunday ? 'SHINING ON' : 'SHINING OFF'} · ALL FOUR MODES</span>
        </div>
        <p className="hint text-[12px] text-muted mb-4.5">Rates below reflect the selected Shining Star Force Sunday setting
          ({form.shining_starforce_sunday ? '30% lower boom chance at 15★–21★' : 'no event boom reduction'}).
          MVP rank changes costs, not success or boom chances. Compare modes without safeguard. Mode 4 is unavailable from 15★ to 17★.
          Rates outside 15★–21★ are identical across modes. Fail excludes booms;
          failures lose one star from 10★–14★ and 22★ onward, and otherwise keep the current star.</p>
        {costsBusy ? <LoadingStatus>Loading rates…</LoadingStatus>
          : costsError ? <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{costsError}</p>
            : costRows && <>
              <div className="starforce-table-wrap max-h-120 overflow-auto border border-solid border-rule rounded-sm" tabIndex="0" role="region" aria-label="Star Force rates by mode">
                <table className="starforce-table min-w-175 m-0 tabular-nums [&_th]:py-2.75 [&_th]:px-3 [&_th]:text-right
        [&_th]:whitespace-nowrap [&_td]:py-2.75 [&_td]:px-3 [&_td]:text-right [&_td]:whitespace-nowrap
        [&_th:first-child]:text-left [&_td:first-child]:text-left [&_thead_th]:sticky [&_thead_th]:top-0
        [&_thead_th]:z-[1] [&_thead_th]:bg-surface">
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
              <p className="hint text-[12px] text-muted mb-4.5">Safeguard overrides the selected mode with Mode 1 and removes booms:</p>
              <ul className="hint text-[12px] text-muted mb-4.5">{costRows.filter(row => row.safeguard_rates).map(row => (
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
