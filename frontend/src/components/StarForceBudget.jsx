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

  return <section className="budget-chance-picker mt-6 mx-0 mb-4 [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-1.5 [&_h3]:text-[15px]" aria-label="Success chance and meso budget">
    <h3>Success chance & meso budget</h3>
    <p className="hint text-[12px] text-muted mb-4.5">Average cost: <strong>{count(result.expected_cost)} mesos</strong>. The inputs start at this average and its estimated success chance.</p>
    <div className="budget-inputs grid grid-cols-[minmax(0,_1fr)_auto_minmax(0,_1.5fr)] items-start gap-3
        [@media(max-width:520px)]:grid-cols-1 [@media(max-width:520px)]:gap-2.5 [&_label]:m-0">
      <label>Success chance
        <span className="budget-input-field flex items-center gap-2 py-0 px-3 border border-solid border-rule rounded-sm bg-ink
        [&_input]:py-3 [&_input]:px-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:tabular-nums
        [&:focus-within]:border-maple [&:focus-within]:[box-shadow:inset_0_0_0_1px_var(--color-maple)]
        [&_input:focus-visible]:[outline:none] [&_>_span]:text-muted [&_>_span]:text-[12px]">
          <input type="number" min="0" max="100" step="any" value={chance}
            onChange={event => changeChance(event.target.value)} aria-describedby="budget-input-note" />
          <span aria-hidden="true">%</span>
        </span>
      </label>
      <span className="budget-input-arrow pt-7 text-maple text-[22px] [@media(max-width:520px)]:hidden" aria-hidden="true">⇄</span>
      <label>Total meso budget
        <span className="budget-input-field flex items-center gap-2 py-0 px-3 border border-solid border-rule rounded-sm bg-ink
        [&_input]:py-3 [&_input]:px-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:tabular-nums
        [&:focus-within]:border-maple [&:focus-within]:[box-shadow:inset_0_0_0_1px_var(--color-maple)]
        [&_input:focus-visible]:[outline:none] [&_>_span]:text-muted [&_>_span]:text-[12px]">
          <input type="number" min="0" step="any" value={budget}
            onChange={event => changeBudget(event.target.value)} aria-describedby="budget-input-note" />
          <span aria-hidden="true">mesos</span>
        </span>
        <span className="budget-cost-breakdown min-h-[1.4em] py-0 px-3 text-muted text-[12px] leading-[1.4] tabular-nums [overflow-wrap:anywhere]">{mesoBreakdown(budget)}</span>
      </label>
    </div>
    <p id="budget-input-note" className="hint text-[12px] text-muted mb-4.5" aria-live="polite">
      {message || `Edit either input to update the other instantly. Budget: ${count(Number(budget))} mesos.`}
    </p>
    <p className="hint text-[12px] text-muted mt-5.5 mb-0">Approximate chance of reaching your target within the budget, including boom recovery and replacement costs. The average is not necessarily a 50% chance.
      {' '}Interactive budget steps: {count(distribution.step_mesos)} mesos; budgets round up and chances round down to the sampled cost grid.
      {' '}Calculation limit: {count(distribution.calculation_limit_mesos)} mesos.</p>
  </section>
}
