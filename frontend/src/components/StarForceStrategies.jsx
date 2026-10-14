import LoadingStatus from './LoadingStatus'
import { Fragment, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import { frontierPoints, nameCustomStrategies, strategySteps, percentDifference } from '../data/starforceStrategies'
import EquipmentStrategyApply from './EquipmentStrategyApply'

const number = value => value.toLocaleString('en-US', { maximumFractionDigits: 3 })
const mesos = value => `${number(value / 1e9)}B`
// Complete class names keep every chart and legend color visible to Tailwind's scanner.
const strategyColors = [
  'text-[#f57bb8]', 'text-[#b4f57b]', 'text-[#7bcef5]', 'text-[#f58a7b]',
  'text-[#7bf5b9]', 'text-[#dc7bf5]', 'text-[#f5de7b]', 'text-[#7b8ef5]',
]
const strategyColor = id => strategyColors[(id - 1) % strategyColors.length]
const defaultActions = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 15, '1']))

function Difference({ value, baseline }) {
  const difference = percentDifference(value, baseline)
  return <small className="block text-muted text-[11px] whitespace-normal mt-1">
    {difference == null ? 'N/A vs baseline' : `${difference > 0 ? '+' : ''}${difference.toFixed(1)}% vs baseline`}
  </small>
}

function Metrics({ row, baseline }) {
  return <dl className="strategy-metrics grid gap-2.5 [&_div]:flex [&_div]:justify-between [&_div]:gap-3 [&_dt]:text-muted [&_dd]:m-0 [&_dd]:tabular-nums">
    {[
      ['enhancement_cost_mesos', 'Enhancement mesos', mesos],
      ['expected_replacement_cost_mesos', 'Replacement mesos', mesos],
      ['total_cost_mesos', 'Total mesos', mesos],
      ['expected_spares', 'Expected spares', number],
      ['expected_attempts', 'Expected attempts', number],
    ].map(([field, label, format]) => <div key={field}><dt>{label}</dt><dd>{format(row[field])}
      <Difference value={row[field]} baseline={baseline?.[field]} />
    </dd></div>)}
  </dl>
}

export default function StarForceStrategies({ form, onChange, planner }) {
  const [request, setRequest] = useState(null)
  const [selection, setSelection] = useState({ section: 'efficient_frontier', index: 0 })
  const [actions, setActions] = useState(defaultActions)
  const [customRequest, setCustomRequest] = useState(null)
  const [customStrategies, setCustomStrategies] = useState([])
  const [comparisonSort, setComparisonSort] = useState(null)
  const nextCustomId = useRef(1)
  const customControllerRef = useRef(null)
  const controllerRef = useRef(null)
  const key = JSON.stringify({ item_level: Number(form.item_level), start_star: Number(form.start_star),
    target_star: Number(form.target_star), replacement_cost_mesos: Number(form.replacement_cost_mesos) })
  const current = request?.key === key ? request : null
  const report = current?.report
  const busy = current?.loading
  const customKey = JSON.stringify([key, actions])
  const customCurrent = customRequest?.key === customKey ? customRequest : null
  const customs = nameCustomStrategies(customStrategies.filter(strategy => strategy.key === key))
  const comparisonRows = [...(report?.scenarios || []), ...customs]
  if (comparisonSort) {
    const direction = comparisonSort.direction === 'descending' ? -1 : 1
    comparisonRows.sort((a, b) => direction * (a[comparisonSort.field] - b[comparisonSort.field]))
  }
  const row = selection.section === 'custom' ? customs.find(strategy => strategy.id === selection.id)
    : report?.[selection.section]?.[selection.index]
  const chart = report ? frontierPoints(report.efficient_frontier, customs) : null
  useEffect(() => () => customControllerRef.current?.abort(), [customKey])
  useEffect(() => () => controllerRef.current?.abort(), [key])

  async function submitCustom(event) {
    event.preventDefault()
    customControllerRef.current?.abort()
    const controller = new AbortController()
    customControllerRef.current = controller
    const modes = Object.fromEntries(Object.entries(actions).map(([star, action]) => [star, action === 'safeguard' ? 1 : Number(action)]))
    const safeguards = Object.fromEntries([15, 16, 17].map(star => [star, actions[star] === 'safeguard']))
    setCustomRequest({ key: customKey, loading: true })
    try {
      const estimate = await apiRequest('/api/starforce-estimate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...JSON.parse(key), mode_by_star: modes, safeguard_by_star: safeguards,
          shining_starforce_sunday: true, mvp_rank: 'none', percentiles: [] }),
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        const id = nextCustomId.current++
        const strategy = { id, key, mode_by_star: modes,
          safeguard_by_star: safeguards, enhancement_cost_mesos: estimate.expected_cost - estimate.expected_replacement_cost,
          expected_replacement_cost_mesos: estimate.expected_replacement_cost, total_cost_mesos: estimate.expected_cost,
          expected_spares: estimate.expected_booms, expected_attempts: estimate.expected_attempts }
        setCustomStrategies(current => [...current.filter(item => item.key === key), strategy])
        setCustomRequest({ key: customKey })
        setSelection({ section: 'custom', id })
      }
    } catch (error) {
      if (!controller.signal.aborted) setCustomRequest({ key: customKey, error: error.message })
    }
  }

  function removeCustom(id) {
    setCustomStrategies(current => current.filter(strategy => strategy.id !== id))
    if (selection.section === 'custom' && selection.id === id) {
      setSelection({ section: 'efficient_frontier', index: 0 })
    }
  }

  async function submit(event) {
    event.preventDefault()
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRequest({ key, loading: true })
    try {
      const report = await apiRequest('/api/starforce-strategies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setSelection({ section: 'efficient_frontier', index: 0 })
        setRequest({ key, report })
      }
    } catch (error) {
      if (!controller.signal.aborted) setRequest({ key, error: error.message })
    }
  }

  return <section className="panel strategy-view bg-surface border border-solid border-rule rounded-sm p-6 mt-5
        [@media(max-width:480px)]:p-5 [&_summary]:cursor-pointer [&_summary]:py-4 [&_summary]:px-0
        [&_button[aria-pressed='true']]:[outline:2px_solid_#67d8c4]" aria-labelledby="strategy-heading">
    <span className="eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple">PLAN YOUR UPGRADES</span>
    <h2 id="strategy-heading">Compare Star Force strategies</h2>
    <p>Shining Star Force: <strong>on</strong> · MVP: <strong>none</strong> · Standard equipment</p>
    <form onSubmit={submit}>
      <div className="starforce-fields grid grid-cols-2 gap-y-4 gap-x-3 [@media(max-width:480px)]:grid-cols-1">
        {[
          ['item_level', 'Equipment level', 1, 300], ['start_star', 'Starting stars', 0, 29],
          ['target_star', 'Target stars', Number(form.start_star) + 1, 30],
          ['replacement_cost_mesos', 'Replacement cost per spare (mesos)', 0, 1e15],
        ].map(([name, label, min, max]) => <label key={name}>{label}
          <input name={name} type="number" required min={min} max={max} step={name === 'replacement_cost_mesos' ? 'any' : '1'}
            value={form[name]} onChange={onChange} />
        </label>)}
      </div>
      <p className="hint text-[12px] text-muted mb-4.5">Total mesos include the replacement cost of each expected boom. Set it to zero to compare enhancement spending only. Choose a target your item supports.</p>
      <button className="primary w-full font-bold bg-maple text-[#201b12] border-maple p-3.5 [&:hover:not(:disabled)]:bg-[#f2ce91]" disabled={busy}>{busy ? 'Comparing…' : 'Compare strategies'}</button>
    </form>
    <div aria-live="polite">
      {busy && <LoadingStatus>Searching per-star mode and safeguard combinations…</LoadingStatus>}
      {current?.error && <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{current.error}</p>}
      {request && !current && <p>Inputs changed. Compare again to refresh the comparison.</p>}
    </div>
    {report && <>
      <p className="hint text-[12px] text-muted mb-4.5">Compared {number(report.assumptions.policies_evaluated)} policies for level {report.assumptions.item_level}, {report.assumptions.start_star} → {report.assumptions.target_star} stars.</p>
      <details className="custom-strategy-editor mt-5" open>
        <summary>Add your own strategy</summary>
        <form onSubmit={submitCustom}>
          <div className="starforce-fields grid grid-cols-2 gap-y-4 gap-x-3 [@media(max-width:480px)]:grid-cols-1">
            {Object.keys(actions).filter(star => Number(star) < report.assumptions.target_star).map(star => <label key={star}>
              {star} &rarr; {Number(star) + 1} stars
              <select value={actions[star]} onChange={event => setActions(current => ({ ...current, [star]: event.target.value }))}>
                {(Number(star) <= 17 ? [1, 2, 3] : [1, 2, 3, 4]).map(mode => <option key={mode} value={mode}>Mode {mode}</option>)}
                {Number(star) <= 17 && <option value="safeguard">Safeguard (Mode 1)</option>}
              </select>
            </label>)}
          </div>
          <p className="hint text-[12px] text-muted mb-4.5">These choices also apply during boom recovery below your starting stars. Outside 15&ndash;21, standard rates apply.</p>
          <p className="hint text-[12px] text-muted mb-4.5">Add multiple strategies to compare them together. Changing these choices keeps your plotted strategies.</p>
          <button className="primary w-full font-bold bg-maple text-[#201b12] border-maple p-3.5 [&:hover:not(:disabled)]:bg-[#f2ce91]" disabled={customCurrent?.loading}>{customCurrent?.loading ? 'Calculating...' : 'Add strategy to comparison'}</button>
          <div aria-live="polite">
            {customCurrent?.loading && <LoadingStatus>Calculating your strategy&hellip;</LoadingStatus>}
            {customCurrent?.error && <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{customCurrent.error}</p>}
          </div>
        </form>
      </details>
      <h3>Choose your cost and spare tradeoff</h3>
      <p className="hint text-[12px] text-muted mb-4.5">Each point is an efficient strategy: reducing spare usage costs more enhancement mesos. Select a point or use the list below. Chart costs exclude replacement spending.</p>
      <svg className="strategy-chart w-full max-h-107.5 text-[#d0cec3] overflow-visible my-4 mx-0 [&_text]:fill-current
        [&_text]:text-[12px] [&_circle]:cursor-pointer [&_circle:hover]:stroke-white
        [&_circle:hover]:[stroke-width:3px]" viewBox="0 0 720 335" role="group" aria-label="Expected spares versus enhancement mesos">
        <path d="M75 35V280H675" className="fill-none stroke-current" />
        {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}>
          <text x={75 + fraction * 590} y="301" className="[text-anchor:middle]">{number(fraction * chart.maxSpares)}</text>
          <text x="67" y={284 - fraction * 240} className="[text-anchor:end]">{mesos(fraction * chart.maxCost)}</text>
        </g>)}
        <text x="370" y="328" className="[text-anchor:middle]">Expected spares consumed</text>
        <text x="75" y="20">Enhancement mesos</text>
        <polyline points={chart.points.map(point => `${point.x},${point.y}`).join(' ')} className="fill-none stroke-[#67d8c4]" />
        {chart.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y}
          r={selection.section === 'efficient_frontier' && selection.index === index ? 7 : 4}
          className={selection.section === 'efficient_frontier' && selection.index === index ? 'fill-[#ffd279]' : 'fill-[#67d8c4]'}
          onClick={() => setSelection({ section: 'efficient_frontier', index })}>
          <title>{mesos(report.efficient_frontier[index].enhancement_cost_mesos)} mesos; {number(report.efficient_frontier[index].expected_spares)} spares</title>
        </circle>)}
        {chart.extraPoints.map((point, index) => {
          const custom = customs[index]
          return <g key={custom.id} role="button" tabIndex="0" aria-label={`View ${custom.name}`}
            onClick={() => setSelection({ section: 'custom', id: custom.id })}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection({ section: 'custom', id: custom.id }) } }}>
            <circle cx={point.x} cy={point.y} r={selection.section === 'custom' && selection.id === custom.id ? 10 : 7}
              className={`fill-current stroke-white stroke-2 ${strategyColor(custom.id)}`} />
            <title>{custom.name}: {mesos(custom.enhancement_cost_mesos)} mesos; {number(custom.expected_spares)} spares</title>
          </g>
        })}
      </svg>
      <div aria-label="Your plotted strategies" aria-live="polite">
        {customs.map(custom => <div className="flex items-center flex-wrap gap-2.5 my-3 mx-0" key={custom.id}>
          <span className={strategyColor(custom.id)} aria-hidden="true">&#9679;</span>
          <span>{custom.name} &middot; {mesos(custom.enhancement_cost_mesos)} mesos &middot; {number(custom.expected_spares)} spares</span>
          <button type="button" aria-label={`View my steps for ${custom.name}`}
            aria-pressed={selection.section === 'custom' && selection.id === custom.id}
            onClick={() => setSelection({ section: 'custom', id: custom.id })}>View my steps</button>
          <button type="button" aria-label={`Remove ${custom.name}`} onClick={() => removeCustom(custom.id)}>Remove</button>
        </div>)}
      </div>
      <label>Inspect or apply an approach
        <select value={`${selection.section}:${selection.id ?? selection.index}`}
          onChange={event => {
            const [section, value] = event.target.value.split(':')
            setSelection(section === 'custom' ? { section, id: Number(value) } : { section, index: Number(value) })
          }}>
          <optgroup label="Optimized approaches">
            {report.scenarios.map((scenario, index) => <option key={index} value={`scenarios:${index}`}>{scenario.name}</option>)}
          </optgroup>
          {customs.length > 0 && <optgroup label="Your approaches">
            {customs.map(custom => <option key={custom.id} value={`custom:${custom.id}`}>{custom.name}</option>)}
          </optgroup>}
          <optgroup label="Efficient tradeoffs">
          {report.efficient_frontier.map((point, index) => <option value={`efficient_frontier:${index}`} key={index}>
            {mesos(point.enhancement_cost_mesos)} enhancement mesos · {number(point.expected_spares)} expected spares
          </option>)}
          </optgroup>
        </select>
      </label>
      {row && <section className="strategy-detail my-5 mx-0 border border-solid border-rule rounded-sm p-4.5 bg-ink [&_li]:my-2 [&_li]:mx-0" aria-live="polite" aria-label="Selected strategy">
        <h3>{row.name}</h3>
        <Metrics row={row} baseline={report.baseline} />
        {planner && <EquipmentStrategyApply key={`${selection.section}-${selection.index ?? selection.id}`}
          equipment={planner.equipment} strategy={row} onApply={planner.applyEquipmentStrategy} />}
        <p>Follow these steps, including when recovering after a boom:</p>
        <ul>{strategySteps(row, report.assumptions.target_star).map(step => <li key={step.from}>
          {step.from} → {step.to} stars: <strong>{step.action}</strong>
        </li>)}</ul>
        {row.on_efficient_frontier === false && <p className="hint text-[12px] text-muted mb-4.5">Another policy improves cost or spare usage without worsening the other.</p>}
      </section>}
      <details className="strategy-comparison mt-6 mx-0 mb-4" open>
        <summary>Compare optimized approaches and your strategies</summary>
        <p className="hint text-[12px] text-muted mb-4.5">Percentage differences compare against full Mode 1 with no safeguards, using the same level,
          star range, spare cost, Shining event, and MVP settings. Negative means less spending or fewer spares.
          N/A means the baseline is zero and a percentage cannot be calculated.</p>
        {report.baseline && <p className="hint text-[12px] text-muted mb-4.5">Baseline: {mesos(report.baseline.enhancement_cost_mesos)} enhancement mesos,
          {' '}{number(report.baseline.expected_spares)} expected spares, {mesos(report.baseline.total_cost_mesos)} total mesos.</p>}
        <p className="hint text-[12px] text-muted mb-4.5" id="strategy-comparison-help">Steps include boom recovery below your starting stars.</p>
        {!customs.length && <p className="hint text-[12px] text-muted mb-4.5">Add your own strategy above to compare it alongside these optimized approaches.</p>}
        <div className="p-2 border border-rule rounded-sm"
          role="region" aria-label="Optimized and custom strategy comparison" aria-describedby="strategy-comparison-help">
          <table className="strategy-comparison-table table-fixed m-0 [@media(max-width:760px)]:block [&_th]:py-4 [&_th]:px-3.5
        [&_th]:text-left [&_th]:[vertical-align:top] [&_th]:leading-[1.5] [&_th]:[overflow-wrap:anywhere] [&_td]:py-4
        [&_td]:px-3.5 [&_td]:text-left [&_td]:[vertical-align:top] [&_td]:leading-[1.5] [&_td]:[overflow-wrap:anywhere]
        [&_thead_th]:bg-surface [&_thead_th]:text-[11px] [&_thead_th]:whitespace-normal [&_th[scope='row']]:text-[13px]
        [&_th[scope='row']]:font-semibold [&_th[scope='row']]:normal-case [&_th[scope='row']]:tracking-[normal]
        [&_td:not(:last-child)]:whitespace-normal [&_td:not(:last-child)]:tabular-nums
        [@media(max-width:760px)]:[&_thead]:block [@media(max-width:760px)]:[&_tbody]:block
        [@media(max-width:760px)]:[&_colgroup]:hidden [@media(max-width:760px)]:[&_tr]:grid
        [@media(max-width:760px)]:[&_tr]:grid-cols-2 [@media(max-width:760px)]:[&_th]:py-3
        [@media(max-width:760px)]:[&_th]:px-2 [@media(max-width:760px)]:[&_th]:min-w-0
        [@media(max-width:760px)]:[&_td]:py-3 [@media(max-width:760px)]:[&_td]:px-2
        [@media(max-width:760px)]:[&_td]:min-w-0 [@media(max-width:760px)]:[&_thead_th:first-child]:hidden
        [@media(max-width:760px)]:[&_thead_th:nth-child(2)]:hidden
        [@media(max-width:760px)]:[&_thead_th:last-child]:hidden
        [@media(max-width:760px)]:[&_th[scope='row']]:col-span-full
        [@media(max-width:760px)]:[&_.strategy-steps-cell]:col-span-full
        [@media(max-width:760px)]:[&_td[colspan]]:col-span-full
        [@media(max-width:760px)]:[&_td[data-label]::before]:[content:attr(data-label)]
        [@media(max-width:760px)]:[&_td[data-label]::before]:block
        [@media(max-width:760px)]:[&_td[data-label]::before]:mb-1.5
        [@media(max-width:760px)]:[&_td[data-label]::before]:text-muted
        [@media(max-width:760px)]:[&_td[data-label]::before]:text-[11px]
        [@media(max-width:760px)]:[&_td[data-label]::before]:font-semibold">
            <colgroup><col className="w-[24%]" /><col /><col /><col /><col className="w-[34%]" /></colgroup>
            <thead><tr><th scope="col">Strategy</th><th scope="col">Enhancement mesos</th>
              {[['expected_spares', 'Expected spares'], ['total_cost_mesos', 'Total mesos']].map(([field, label]) => {
                const direction = comparisonSort?.field === field ? comparisonSort.direction : null
                const nextDirection = direction === 'descending' ? 'ascending' : 'descending'
                return <th key={field} scope="col" aria-sort={direction || undefined}>
                  <button type="button" className="strategy-sort-button flex items-center justify-between gap-1.5 w-full py-1 px-0 border-0 rounded-[3px]
        bg-transparent text-inherit text-left [text-transform:inherit] tracking-[inherit] [&_span]:shrink-0
        [&_span]:text-[16px] [&:hover]:text-[#67d8c4] [th[aria-sort]_&]:text-[#67d8c4]"
                    aria-label={`Sort ${label.toLowerCase()}, ${nextDirection === 'descending' ? 'highest' : 'lowest'} first`}
                    onClick={() => setComparisonSort({ field, direction: nextDirection })}>
                    {label}<span aria-hidden="true">{direction === 'descending' ? '↓' : direction === 'ascending' ? '↑' : '↕'}</span>
                  </button>
                </th>
              })}<th scope="col">Steps</th></tr></thead>
            <tbody>{comparisonRows.map(scenario => <Fragment key={scenario.id != null ? `custom-${scenario.id}` : scenario.name}>
              <tr
              className={scenario.id != null ? "strategy-comparison-custom bg-[#302f29]" : undefined}>
              <th scope="row">
                {scenario.id != null && <span className={`text-[16px] ${strategyColor(scenario.id)}`} aria-hidden="true">&#9679; </span>}
                {scenario.name}
              </th>
              <td data-label="Enhancement mesos">{mesos(scenario.enhancement_cost_mesos)}<Difference value={scenario.enhancement_cost_mesos} baseline={report.baseline?.enhancement_cost_mesos} /></td>
              <td data-label="Expected spares">{number(scenario.expected_spares)}<Difference value={scenario.expected_spares} baseline={report.baseline?.expected_spares} /></td>
              <td data-label="Total mesos">{mesos(scenario.total_cost_mesos)}<Difference value={scenario.total_cost_mesos} baseline={report.baseline?.total_cost_mesos} /></td>
              <td className="strategy-steps-cell" data-label="Steps"><div className="strategy-comparison-steps text-[12px] [&_ul]:list-none [&_ul]:p-0 [&_ul]:m-0 [&_li]:grid
        [&_li]:grid-cols-[minmax(0,_1fr)_minmax(0,_1.4fr)] [&_li]:gap-2 [&_li]:py-1.25 [&_li]:px-0 [&_li_+_li]:border-t
        [&_li_+_li]:border-solid [&_li_+_li]:border-t-rule [&_strong]:font-medium [&_strong]:text-[#c7e9df]" role="region" aria-label={`Steps for ${scenario.name}`}>
                <ul>{strategySteps(scenario, report.assumptions.target_star).map(step => <li key={step.from}>
                  <span>{step.from} &rarr; {step.to} stars</span><strong>{step.action}</strong>
                </li>)}</ul>
              </div></td>
              </tr>
              {planner && <tr className={scenario.id != null ? "strategy-comparison-custom bg-[#302f29]" : undefined}>
                <td colSpan={5}><div className="strategy-row-apply text-left whitespace-normal [&_.equipment-strategy-apply]:m-0 [&_.equipment-strategy-apply]:p-2.5">
                <EquipmentStrategyApply equipment={planner.equipment} strategy={scenario} onApply={planner.applyEquipmentStrategy} />
                </div></td>
              </tr>}
            </Fragment>)}</tbody>
          </table>
        </div>
      </details>
      <p className="hint text-[12px] text-muted mb-4.5">The balanced tradeoff gives equal weight to enhancement mesos and expected spares after normalizing each between the efficient frontier's extremes.</p>
      <p className="hint text-[12px] text-muted mb-4.5">Best value versus baseline gives the most percentage reduction in expected booms per percentage increase in enhancement spending compared with Full Mode 1. It can favor a small, efficient improvement. It is only shown when a boom reduction is available.</p>
      <p className="hint text-[12px] text-muted mb-4.5">Expected spares count booms and exclude the original item. Averages assume replacement availability; they are not guarantees or success chances for a fixed spare budget. Above 22 stars, no strategy here removes all boom risk.</p>
    </>}
  </section>
}
