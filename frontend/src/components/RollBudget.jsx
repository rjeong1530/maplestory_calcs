import { useId, useState } from 'react'
import { rollBudgetForChance, rollChanceForBudget } from '../data/rollBudget'
import { count, mesoBreakdown } from '../data/numberFormat'

const numberInput = value => value.trim() === '' ? NaN : Number(value)

export default function RollBudget({ probability, defaultCost, itemLabel, countOnly = false }) {
  const noteId = useId()
  const [cost, setCost] = useState(defaultCost == null ? '' : String(defaultCost))
  const average = Number.isFinite(probability) && probability > 0 && probability <= 1
    && numberInput(cost) > 0 ? numberInput(cost) / probability : null
  const [budget, setBudget] = useState(() => average != null && Number.isFinite(average) ? String(Math.ceil(average)) : '')
  const [chance, setChance] = useState(() => {
    const percent = rollChanceForBudget(probability, numberInput(budget), numberInput(cost))
    return percent == null ? '' : percent.toFixed(3)
  })
  const [message, setMessage] = useState('')
  const unit = countOnly ? 'flames' : 'mesos'
  const amountLabel = countOnly ? 'Number of flames' : 'Total meso budget'

  function changeChance(value) {
    setChance(value)
    const mesos = rollBudgetForChance(probability, numberInput(value), numberInput(cost))
    setBudget(mesos == null ? '' : String(mesos))
    setMessage(mesos == null ? (countOnly
      ? 'Enter a chance from 0 to 100%. Unreachable chances have no finite flame count.'
      : 'Enter a valid chance and a positive cost per roll. Unreachable chances have no finite budget.') : '')
  }
  function changeBudget(value) {
    setBudget(value)
    if (countOnly && !Number.isSafeInteger(numberInput(value))) {
      setChance('')
      setMessage('Enter a nonnegative whole number of flames within the supported numeric range.')
      return
    }
    const percent = rollChanceForBudget(probability, numberInput(value), numberInput(cost))
    setChance(percent == null ? '' : percent.toFixed(3))
    setMessage(percent == null ? (countOnly ? 'Enter a nonnegative flame count within the supported numeric range.'
      : 'Enter a nonnegative budget and a positive cost per roll within the supported numeric range.') : '')
  }
  function changeCost(value) {
    setCost(value)
    const price = numberInput(value)
    const mean = price > 0 && probability > 0 ? Math.ceil(price / probability) : NaN
    const percent = rollChanceForBudget(probability, mean, price)
    setBudget(percent == null ? '' : String(mean))
    setChance(percent == null ? '' : percent.toFixed(3))
    setMessage(percent == null ? 'Enter a positive cost per roll. Impossible targets have no finite average budget.' : '')
  }

  return <section className="budget-chance-picker mt-6 mx-0 mb-4 [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-1.5 [&_h3]:text-[15px]" aria-label={`${itemLabel} success chance and ${countOnly ? 'roll count' : 'meso budget'}`}>
    <h3>Success chance & {countOnly ? 'flame count' : 'meso budget'}</h3>
    {!countOnly && <label>Cost per {itemLabel.toLowerCase()} (mesos)
      <span className="budget-input-field flex items-center gap-2 py-0 px-3 border border-solid border-rule rounded-sm bg-ink
        [&_input]:py-3 [&_input]:px-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:tabular-nums
        [&:focus-within]:border-maple [&:focus-within]:[box-shadow:inset_0_0_0_1px_var(--color-maple)]
        [&_input:focus-visible]:[outline:none] [&_>_span]:text-muted [&_>_span]:text-[12px]">
        <input type="number" min="1" step="any" value={cost} placeholder="Enter cost per roll"
          onChange={event => changeCost(event.target.value)} aria-describedby={noteId} />
      </span>
    </label>}
    <p className="hint text-[12px] text-muted mb-4.5">{average != null && Number.isFinite(average)
      ? (countOnly ? `Average flames: ${count(average)}. Inputs start at the average rounded up to a whole flame and its success chance.`
        : `Average cost: ${count(average)} mesos. Inputs start at this average and the chance from the whole rolls it buys.`)
      : probability === 0 ? `This target is impossible; there is no finite average ${countOnly ? 'flame count' : 'cost'}.`
        : 'Enter a cost per roll to calculate meso budgets.'}</p>
    <div className="budget-inputs grid grid-cols-[minmax(0,_1fr)_auto_minmax(0,_1.5fr)] items-start gap-3
        [@media(max-width:520px)]:grid-cols-1 [@media(max-width:520px)]:gap-2.5 [&_label]:m-0">
      <label>Success chance
        <span className="budget-input-field flex items-center gap-2 py-0 px-3 border border-solid border-rule rounded-sm bg-ink
        [&_input]:py-3 [&_input]:px-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:tabular-nums
        [&:focus-within]:border-maple [&:focus-within]:[box-shadow:inset_0_0_0_1px_var(--color-maple)]
        [&_input:focus-visible]:[outline:none] [&_>_span]:text-muted [&_>_span]:text-[12px]">
          <input type="number" min="0" max="100" step="any" value={chance}
            onChange={event => changeChance(event.target.value)} aria-describedby={noteId} />
          <span aria-hidden="true">%</span>
        </span>
      </label>
      <span className="budget-input-arrow pt-7 text-maple text-[22px] [@media(max-width:520px)]:hidden" aria-hidden="true">⇄</span>
      <label>{amountLabel}
        <span className="budget-input-field flex items-center gap-2 py-0 px-3 border border-solid border-rule rounded-sm bg-ink
        [&_input]:py-3 [&_input]:px-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:tabular-nums
        [&:focus-within]:border-maple [&:focus-within]:[box-shadow:inset_0_0_0_1px_var(--color-maple)]
        [&_input:focus-visible]:[outline:none] [&_>_span]:text-muted [&_>_span]:text-[12px]">
          <input type="number" min="0" step={countOnly ? '1' : 'any'} value={budget}
            onChange={event => changeBudget(event.target.value)} aria-describedby={noteId} />
          <span aria-hidden="true">{unit}</span>
        </span>
        {!countOnly && <span className="budget-cost-breakdown min-h-[1.4em] py-0 px-3 text-muted text-[12px] leading-[1.4] tabular-nums [overflow-wrap:anywhere]">{mesoBreakdown(budget)}</span>}
      </label>
    </div>
    <p id={noteId} className="hint text-[12px] text-muted mb-4.5" aria-live="polite">{message || (budget !== ''
      ? `${amountLabel}: ${count(Number(budget))} ${unit}. Edit either input to update the other instantly.`
      : countOnly ? 'Enter a success chance or number of flames.' : 'Set your cost per roll, then edit either input.')}</p>
    <p className="hint text-[12px] text-muted mt-5.5 mb-0">{countOnly
      ? 'Uses independent rolls and whole flames. The average is not necessarily a 50% chance.'
      : 'Uses your price and independent rolls. Budgets round up to whole rolls; entered budgets buy only whole rolls. The average is not necessarily a 50% chance. Tier-ups and keep/replace decisions are excluded.'}</p>
  </section>
}
