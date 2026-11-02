import { ResultCard, StatCard } from '../ui/layout'
import { EmptyState } from '../ui/feedback'
import { CalculatorLoadingOverlay } from '../ui/loading'
import AnimatedNumber from '../ui/AnimatedNumber'
import { cubeCost } from '../data/cubeCosts'
import RollBudget from './RollBudget'
import { count, percentage } from '../data/numberFormat'

export default function Results({ result, busy, error }) {
  const cost = result ? cubeCost(result.cube_type, result.cube_sale) : null
  const average = result?.probability > 0 && cost > 0 ? cost / result.probability : null
  return <ResultCard title="Roll outcome" busy={busy} className="potential-results mw-budget-surface">
    <CalculatorLoadingOverlay loading={busy} label="Calculating your potential combination...">
      <div className="potential-result-content">
        {!busy && (error ? <p className="potential-error" role="alert">{error}</p> : !result ? <EmptyState title="Ready when you are" description="Set your potential targets, then calculate the odds and cube budget." /> : <>
          <div className="potential-metrics">
            <StatCard label="Success Probability" value={<AnimatedNumber initialValue={0} value={result.percentage} format={percentage} />} unit="%" />
            <StatCard label="Expected Cubes" value={result.probability === 0 ? 'No finite average' : <AnimatedNumber initialValue={0} value={result.one_in} format={count} />} />
            <StatCard label="Expected Cost" value={average != null && Number.isFinite(average) ? <AnimatedNumber initialValue={0} value={average} format={count} /> : 'No finite average'} unit={average != null && Number.isFinite(average) ? 'mesos' : undefined} />
          </div>
          <p className="mw-help">{result.probability === 0 ? 'This combination cannot occur.' : result.probability === 1 ? 'Guaranteed on every roll.' : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
          {result.probability === 0 && <p className="mw-help">Try lowering a target or changing the equipment.</p>}
          <RollBudget probability={result.probability} defaultCost={cost} itemLabel="Cube" />
          <p className="mw-help">All targets must occur together. Estimates describe the chance of at least one successful roll, not a guaranteed number of cubes.</p>
        </>)}
      </div>
    </CalculatorLoadingOverlay>
  </ResultCard>
}
