const count = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
const percentage = value => value > 0 && value < 0.000001
  ? value.toExponential(3) : new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)

export default function Results({ result, busy, error }) {
  return (
    <section className="panel results" aria-live="polite" aria-busy={busy}>
      <span className="eyebrow">YOUR ODDS</span>
      <h2>Roll outcome</h2>
      {busy ? <p role="status">Calculating your potential combination…</p>
        : error ? <p className="error" role="alert">{error}</p>
        : !result ? (
          <div className="empty">
            <span className="empty-icon" aria-hidden="true">◇</span>
            <h3>What are you rolling for?</h3>
            <p>Choose your targets and calculate to see your probability and estimated cubes.</p>
          </div>
        ) : (
          <>
            <div className="probability">{percentage(result.percentage)}<span>%</span></div>
            <p className="odds">{result.probability === 0 ? 'This combination cannot occur.'
              : result.probability === 1 ? 'Guaranteed on every roll.'
                : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
            {result.probability === 0 && <p className="hint">Try lowering a target or changing the equipment.</p>}
            {result.cube_estimates.length > 0 && (
              <table>
                <caption>Estimated cubes to reach your chosen chance</caption>
                <thead><tr><th scope="col">Success chance</th><th scope="col">Cubes</th></tr></thead>
                <tbody>{result.cube_estimates.map(item => (
                  <tr key={item.target_probability}>
                    <td>{percentage(item.target_probability * 100)}%</td>
                    <td>{item.cubes === null ? 'Unreachable' : count(item.cubes)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <p className="hint result-note">All targets must occur together. Estimates describe the chance of at least one successful roll, not a guaranteed number of cubes.</p>
          </>
        )}
    </section>
  )
}

