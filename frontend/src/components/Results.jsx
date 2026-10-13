import LoadingStatus from './LoadingStatus'
import { cubeCost } from '../data/cubeCosts'
import RollBudget from './RollBudget'
import { count, percentage } from '../data/numberFormat'

export default function Results({ result, busy, error }) {
  return (
    <section className="panel results" aria-live="polite" aria-busy={busy}>
      <span className="eyebrow">YOUR ODDS</span>
      <h2>Roll outcome</h2>
      {busy ? <LoadingStatus>Calculating your potential combination…</LoadingStatus>
        : error ? <p className="error" role="alert">{error}</p>
        : !result ? (
          <div className="empty">
            <span className="font-mono text-4xl text-muted" aria-hidden="true">— %</span>
            <h3>Ready when you are</h3>
            <p>Set your potential targets, then calculate the odds and cube budget.</p>
          </div>
        ) : (
          <>
            <div className="probability">{percentage(result.percentage)}<span>%</span></div>
            <p className="text-[#d0cec3] text-[14px] mt-2.25">{result.probability === 0 ? 'This combination cannot occur.'
              : result.probability === 1 ? 'Guaranteed on every roll.'
                : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
            {result.probability === 0 && <p className="hint">Try lowering a target or changing the equipment.</p>}
            <RollBudget probability={result.probability} defaultCost={cubeCost(result.cube_type, result.cube_sale)} itemLabel="Cube" />
            <p className="hint mt-5.5 mb-0">All targets must occur together. Estimates describe the chance of at least one successful roll, not a guaranteed number of cubes.</p>
          </>
        )}
    </section>
  )
}

