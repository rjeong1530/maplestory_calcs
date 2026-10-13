import './RollBudget.css'
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

  return <section className="budget-chance-picker" aria-label={`${itemLabel} success chance and ${countOnly ? 'roll count' : 'meso budget'}`}>
    <h3>Success chance & {countOnly ? 'flame count' : 'meso budget'}</h3>
    {!countOnly && <label>Cost per {itemLabel.toLowerCase()} (mesos)
      <span className="budget-input-field">
        <input type="number" min="1" step="any" value={cost} placeholder="Enter cost per roll"
          onChange={event => changeCost(event.target.value)} aria-describedby={noteId} />
      </span>
    </label>}
    <p className="hint">{average != null && Number.isFinite(average)
      ? (countOnly ? `Average flames: ${count(average)}. Inputs start at the average rounded up to a whole flame and its success chance.`
        : `Average cost: ${count(average)} mesos. Inputs start at this average and the chance from the whole rolls it buys.`)
      : probability === 0 ? `This target is impossible; there is no finite average ${countOnly ? 'flame count' : 'cost'}.`
        : 'Enter a cost per roll to calculate meso budgets.'}</p>
    <div className="budget-inputs">
      <label>Success chance
        <span className="budget-input-field">
          <input type="number" min="0" max="100" step="any" value={chance}
            onChange={event => changeChance(event.target.value)} aria-describedby={noteId} />
          <span aria-hidden="true">%</span>
        </span>
      </label>
      <span className="budget-input-arrow" aria-hidden="true">⇄</span>
      <label>{amountLabel}
        <span className="budget-input-field">
          <input type="number" min="0" step={countOnly ? '1' : 'any'} value={budget}
            onChange={event => changeBudget(event.target.value)} aria-describedby={noteId} />
          <span aria-hidden="true">{unit}</span>
        </span>
        {!countOnly && <span className="budget-cost-breakdown">{mesoBreakdown(budget)}</span>}
      </label>
    </div>
    <p id={noteId} className="hint" aria-live="polite">{message || (budget !== ''
      ? `${amountLabel}: ${count(Number(budget))} ${unit}. Edit either input to update the other instantly.`
      : countOnly ? 'Enter a success chance or number of flames.' : 'Set your cost per roll, then edit either input.')}</p>
    <p className="hint mt-5.5 mb-0">{countOnly
      ? 'Uses independent rolls and whole flames. The average is not necessarily a 50% chance.'
      : 'Uses your price and independent rolls. Budgets round up to whole rolls; entered budgets buy only whole rolls. The average is not necessarily a 50% chance. Tier-ups and keep/replace decisions are excluded.'}</p>
  </section>
}
