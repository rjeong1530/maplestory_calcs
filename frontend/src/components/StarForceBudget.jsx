import { useState } from 'react'
import { budgetForChance, chanceForBudget } from '../data/starforceBudget'
import { count, mesoBreakdown } from '../data/numberFormat'

export default function StarForceBudget({ result }) {
  const distribution = result.budget_distribution
  const [chance, setChance] = useState(() => (distribution.mean_success_probability * 100).toFixed(3))
  const [budget, setBudget] = useState(() => String(Math.ceil(result.expected_cost)))
  const [message, setMessage] = useState('')

  function changeChance(value) {
    setChance(value)
    const percent = value.trim() === '' ? NaN : Number(value)
    const mesos = budgetForChance(distribution, percent)
    setBudget(mesos == null ? '' : String(mesos))
    setMessage(!Number.isFinite(percent) || percent < 0 || percent > 100
      ? 'Enter a success chance from 0 to 100%.'
      : mesos == null ? 'This chance is beyond the calculation limit. A finite budget cannot guarantee success.' : '')
  }

  function changeBudget(value) {
    setBudget(value)
    const mesos = value.trim() === '' ? NaN : Number(value)
    const percent = chanceForBudget(distribution, mesos)
    setChance(percent == null ? '' : percent.toFixed(3))
    setMessage(!Number.isFinite(mesos) || mesos < 0 ? 'Enter a nonnegative meso budget.'
      : percent == null ? 'This budget is beyond the calculation limit.' : '')
  }

  return <section className="budget-chance-picker" aria-label="Success chance and meso budget">
    <h3>Success chance & meso budget</h3>
    <p className="hint">Average cost: <strong>{count(result.expected_cost)} mesos</strong>. The inputs start at this average and its estimated success chance.</p>
    <div className="budget-inputs">
      <label>Success chance
        <span className="budget-input-field">
          <input type="number" min="0" max="100" step="any" value={chance}
            onChange={event => changeChance(event.target.value)} aria-describedby="budget-input-note" />
          <span aria-hidden="true">%</span>
        </span>
      </label>
      <span className="budget-input-arrow" aria-hidden="true">⇄</span>
      <label>Total meso budget
        <span className="budget-input-field">
          <input type="number" min="0" step="any" value={budget}
            onChange={event => changeBudget(event.target.value)} aria-describedby="budget-input-note" />
          <span aria-hidden="true">mesos</span>
        </span>
        <span className="budget-cost-breakdown">{mesoBreakdown(budget)}</span>
      </label>
    </div>
    <p id="budget-input-note" className="hint" aria-live="polite">
      {message || `Edit either input to update the other instantly. Budget: ${count(Number(budget))} mesos.`}
    </p>
    <p className="hint result-note">Approximate chance of reaching your target within the budget, including boom recovery and replacement costs. The average is not necessarily a 50% chance.
      {' '}Interactive budget steps: {count(distribution.step_mesos)} mesos; budgets round up and chances round down to the sampled cost grid.
      {' '}Calculation limit: {count(distribution.calculation_limit_mesos)} mesos.</p>
  </section>
}
