import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import { frontierPoints, nameCustomStrategies, strategySteps } from '../data/starforceStrategies'
import './StarForceStrategies.css'

const number = value => value.toLocaleString('en-US', { maximumFractionDigits: 3 })
const mesos = value => `${number(value / 1e9)}B`
const defaultActions = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 15, '1']))

function Metrics({ row }) {
  return <dl className="strategy-metrics">
    <div><dt>Enhancement mesos</dt><dd>{mesos(row.enhancement_cost_mesos)}</dd></div>
    <div><dt>Replacement mesos</dt><dd>{mesos(row.expected_replacement_cost_mesos)}</dd></div>
    <div><dt>Total mesos</dt><dd>{mesos(row.total_cost_mesos)}</dd></div>
    <div><dt>Expected spares</dt><dd>{number(row.expected_spares)}</dd></div>
    <div><dt>Expected attempts</dt><dd>{number(row.expected_attempts)}</dd></div>
  </dl>
}

export default function StarForceStrategies({ form, onChange }) {
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
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      })
      if (!controller.signal.aborted) {
        const id = nextCustomId.current++
        const strategy = { id, key, color: `hsl(${(330 + (id - 1) * 137.5) % 360} 85% 72%)`, mode_by_star: modes,
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
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      })
      if (!controller.signal.aborted) {
        setSelection({ section: 'efficient_frontier', index: 0 })
        setRequest({ key, report })
      }
    } catch (error) {
      if (!controller.signal.aborted) setRequest({ key, error: error.message })
    }
  }

  return <section className="panel strategy-view" aria-labelledby="strategy-heading">
    <span className="eyebrow">PLAN YOUR UPGRADES</span>
    <h2 id="strategy-heading">Compare Star Force strategies</h2>
    <p>Shining Star Force: <strong>on</strong> · MVP: <strong>none</strong> · Standard equipment</p>
    <form onSubmit={submit}>
      <div className="starforce-fields">
        {[
          ['item_level', 'Equipment level', 1, 300], ['start_star', 'Starting stars', 0, 29],
          ['target_star', 'Target stars', 1, 30],
          ['replacement_cost_mesos', 'Replacement cost per spare (mesos)', 0, 1e15],
        ].map(([name, label, min, max]) => <label key={name}>{label}
          <input name={name} type="number" required min={min} max={max} step={name === 'replacement_cost_mesos' ? 'any' : '1'}
            value={form[name]} onChange={onChange} />
        </label>)}
      </div>
      <p className="hint">Total mesos include the replacement cost of each expected boom. Set it to zero to compare enhancement spending only. Choose a target your item supports.</p>
      <button className="primary" disabled={busy}>{busy ? 'Comparing…' : 'Compare strategies'}</button>
    </form>
    <div aria-live="polite">
      {busy && <p role="status">Searching per-star mode and safeguard combinations…</p>}
      {current?.error && <p className="error" role="alert">{current.error}</p>}
      {request && !current && <p>Inputs changed. Compare again to refresh the comparison.</p>}
    </div>
    {report && <>
      <p className="hint">Compared {number(report.assumptions.policies_evaluated)} policies for level {report.assumptions.item_level}, {report.assumptions.start_star} → {report.assumptions.target_star} stars.</p>
      <details className="custom-strategy-editor" open>
        <summary>Add your own strategy</summary>
        <form onSubmit={submitCustom}>
          <div className="starforce-fields">
            {Object.keys(actions).filter(star => Number(star) < report.assumptions.target_star).map(star => <label key={star}>
              {star} &rarr; {Number(star) + 1} stars
              <select value={actions[star]} onChange={event => setActions(current => ({ ...current, [star]: event.target.value }))}>
                {(Number(star) <= 17 ? [1, 2, 3] : [1, 2, 3, 4]).map(mode => <option key={mode} value={mode}>Mode {mode}</option>)}
                {Number(star) <= 17 && <option value="safeguard">Safeguard (Mode 1)</option>}
              </select>
            </label>)}
          </div>
          <p className="hint">These choices also apply during boom recovery below your starting stars. Outside 15&ndash;21, standard rates apply.</p>
          <p className="hint">Add multiple strategies to compare them together. Changing these choices keeps your plotted strategies.</p>
          <button className="primary" disabled={customCurrent?.loading}>{customCurrent?.loading ? 'Calculating...' : 'Add strategy to comparison'}</button>
          <div aria-live="polite">
            {customCurrent?.loading && <p role="status">Calculating your strategy&hellip;</p>}
            {customCurrent?.error && <p className="error" role="alert">{customCurrent.error}</p>}
          </div>
        </form>
      </details>
      <h3>Choose your cost and spare tradeoff</h3>
      <p className="hint">Each point is an efficient strategy: reducing spare usage costs more enhancement mesos. Select a point or use the list below. Chart costs exclude replacement spending.</p>
      <svg className="strategy-chart" viewBox="0 0 720 335" role="group" aria-label="Expected spares versus enhancement mesos">
        <path d="M75 35V280H675" fill="none" stroke="currentColor" />
        {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}>
          <text x={75 + fraction * 590} y="301" textAnchor="middle">{number(fraction * chart.maxSpares)}</text>
          <text x="67" y={284 - fraction * 240} textAnchor="end">{mesos(fraction * chart.maxCost)}</text>
        </g>)}
        <text x="370" y="328" textAnchor="middle">Expected spares consumed</text>
        <text x="75" y="20">Enhancement mesos</text>
        <polyline points={chart.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#67d8c4" />
        {chart.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y}
          r={selection.section === 'efficient_frontier' && selection.index === index ? 7 : 4}
          fill={selection.section === 'efficient_frontier' && selection.index === index ? '#ffd279' : '#67d8c4'}
          onClick={() => setSelection({ section: 'efficient_frontier', index })}>
          <title>{mesos(report.efficient_frontier[index].enhancement_cost_mesos)} mesos; {number(report.efficient_frontier[index].expected_spares)} spares</title>
        </circle>)}
        {chart.extraPoints.map((point, index) => {
          const custom = customs[index]
          return <g key={custom.id} role="button" tabIndex="0" aria-label={`View ${custom.name}`}
            onClick={() => setSelection({ section: 'custom', id: custom.id })}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection({ section: 'custom', id: custom.id }) } }}>
            <circle cx={point.x} cy={point.y} r={selection.section === 'custom' && selection.id === custom.id ? 10 : 7}
              fill={custom.color} stroke="#fff" strokeWidth="2" />
            <title>{custom.name}: {mesos(custom.enhancement_cost_mesos)} mesos; {number(custom.expected_spares)} spares</title>
          </g>
        })}
      </svg>
      <div aria-label="Your plotted strategies" aria-live="polite">
        {customs.map(custom => <div className="custom-strategy-row" key={custom.id}>
          <span style={{ color: custom.color }} aria-hidden="true">&#9679;</span>
          <span>{custom.name} &middot; {mesos(custom.enhancement_cost_mesos)} mesos &middot; {number(custom.expected_spares)} spares</span>
          <button type="button" aria-label={`View my steps for ${custom.name}`}
            aria-pressed={selection.section === 'custom' && selection.id === custom.id}
            onClick={() => setSelection({ section: 'custom', id: custom.id })}>View my steps</button>
          <button type="button" aria-label={`Remove ${custom.name}`} onClick={() => removeCustom(custom.id)}>Remove</button>
        </div>)}
      </div>
      <label>Explore an efficient strategy
        <select value={selection.section === 'efficient_frontier' ? selection.index : ''}
          onChange={event => setSelection({ section: 'efficient_frontier', index: Number(event.target.value) })}>
          <option value="" disabled>Select a tradeoff</option>
          {report.efficient_frontier.map((point, index) => <option value={index} key={index}>
            {mesos(point.enhancement_cost_mesos)} enhancement mesos · {number(point.expected_spares)} expected spares
          </option>)}
        </select>
      </label>
      {row && <section className="strategy-detail" aria-live="polite" aria-label="Selected strategy">
        <h3>{row.name}</h3>
        <Metrics row={row} />
        <p>Follow these steps, including when recovering after a boom:</p>
        <ul>{strategySteps(row, report.assumptions.target_star).map(step => <li key={step.from}>
          {step.from} → {step.to} stars: <strong>{step.action}</strong>
        </li>)}</ul>
        {row.on_efficient_frontier === false && <p className="hint">Another policy improves cost or spare usage without worsening the other.</p>}
      </section>}
      <details className="strategy-comparison" open>
        <summary>Compare optimized approaches and your strategies</summary>
        <p className="hint" id="strategy-comparison-help">Steps include boom recovery below your starting stars. Scroll within longer step lists to see every transition.</p>
        {!customs.length && <p className="hint">Add your own strategy above to compare it alongside these optimized approaches.</p>}
        <div className="starforce-table-wrap strategy-comparison-scroll" tabIndex="0"
          role="region" aria-label="Optimized and custom strategy comparison" aria-describedby="strategy-comparison-help">
          <table className="strategy-comparison-table">
            <colgroup><col className="strategy-name-column" /><col /><col /><col /><col className="strategy-steps-column" /></colgroup>
            <thead><tr><th scope="col">Strategy</th><th scope="col">Enhancement mesos</th>
              {[['expected_spares', 'Expected spares'], ['total_cost_mesos', 'Total mesos']].map(([field, label]) => {
                const direction = comparisonSort?.field === field ? comparisonSort.direction : null
                const nextDirection = direction === 'descending' ? 'ascending' : 'descending'
                return <th key={field} scope="col" aria-sort={direction || undefined}>
                  <button type="button" className="strategy-sort-button"
                    aria-label={`Sort ${label.toLowerCase()}, ${nextDirection === 'descending' ? 'highest' : 'lowest'} first`}
                    onClick={() => setComparisonSort({ field, direction: nextDirection })}>
                    {label}<span aria-hidden="true">{direction === 'descending' ? '↓' : direction === 'ascending' ? '↑' : '↕'}</span>
                  </button>
                </th>
              })}<th scope="col">Steps</th></tr></thead>
            <tbody>{comparisonRows.map(scenario => <tr key={scenario.id != null ? `custom-${scenario.id}` : scenario.name}
              className={scenario.id != null ? 'strategy-comparison-custom' : undefined}>
              <th scope="row">
                {scenario.color && <span className="strategy-comparison-marker" style={{ color: scenario.color }} aria-hidden="true">&#9679; </span>}
                {scenario.name}
              </th>
              <td>{mesos(scenario.enhancement_cost_mesos)}</td>
              <td>{number(scenario.expected_spares)}</td><td>{mesos(scenario.total_cost_mesos)}</td>
              <td><div className="strategy-comparison-steps" tabIndex="0" role="region" aria-label={`Steps for ${scenario.name}`}>
                <ul>{strategySteps(scenario, report.assumptions.target_star).map(step => <li key={step.from}>
                  <span>{step.from} &rarr; {step.to} stars</span><strong>{step.action}</strong>
                </li>)}</ul>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
      <p className="hint">The balanced tradeoff gives equal weight to enhancement mesos and expected spares after normalizing each between the efficient frontier's extremes.</p>
      <p className="hint">Expected spares count booms and exclude the original item. Averages assume replacement availability; they are not guarantees or success chances for a fixed spare budget. Above 22 stars, no strategy here removes all boom risk.</p>
    </>}
  </section>
}
