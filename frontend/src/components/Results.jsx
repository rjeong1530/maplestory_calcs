import LoadingStatus from './LoadingStatus'
import { cubeCost } from '../data/cubeCosts'
import RollBudget from './RollBudget'
import { count, percentage } from '../data/numberFormat'

export default function Results({ result, busy, error }) {
  return (
    <section className="panel results bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5 [&_h2]:mt-3 [&_h2]:text-[22px]" aria-live="polite" aria-busy={busy}>
      <span className="eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple">YOUR ODDS</span>
      <h2>Roll outcome</h2>
      {busy ? <LoadingStatus variant="result">Calculating your potential combination…</LoadingStatus>
        : error ? <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{error}</p>
        : !result ? (
          <div className="empty pt-8.5 px-0 pb-3 border-t border-solid border-t-rule mt-6 text-muted text-[14px] [&_h3]:text-[#eeede6] [&_h3]:mt-5">
            <span className="font-mono text-4xl text-muted" aria-hidden="true">— %</span>
            <h3>Ready when you are</h3>
            <p>Set your potential targets, then calculate the odds and cube budget.</p>
          </div>
        ) : (
          <>
            <div className="probability font-mono text-[clamp(27px,_4vw,_42px)] font-bold tracking-[-0.04em] mt-7.5 text-maple
        [overflow-wrap:anywhere] [&_span]:text-[24px] [&_span]:ml-1">{percentage(result.percentage)}<span>%</span></div>
            <p className="text-[#d0cec3] text-[14px] mt-2.25">{result.probability === 0 ? 'This combination cannot occur.'
              : result.probability === 1 ? 'Guaranteed on every roll.'
                : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
            {result.probability === 0 && <p className="hint text-[12px] text-muted mb-4.5">Try lowering a target or changing the equipment.</p>}
            <RollBudget probability={result.probability} defaultCost={cubeCost(result.cube_type, result.cube_sale)} itemLabel="Cube" />
            <p className="hint text-[12px] text-muted mt-5.5 mb-0">All targets must occur together. Estimates describe the chance of at least one successful roll, not a guaranteed number of cubes.</p>
          </>
        )}
    </section>
  )
}

