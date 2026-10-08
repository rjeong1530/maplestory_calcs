import { MVP_RANKS, UPGRADE_CATEGORIES } from '../data/equipmentUpgrade'

const score = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const mesos = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export default function OverallUpgradeOrder({ plan, settings, cubeType }) {
  const steps = plan?.steps ?? []
  return <section aria-label="Overall upgrade order">
    <h3>Best next upgrades across your equipment</h3>
    <p className="hint">Cube sale: {settings.cube_sale ? 'On' : 'Off'} · Shining Star Force: {settings.shining_starforce_sunday ? 'On' : 'Off'} · MVP discount: {MVP_RANKS[settings.mvp_rank] ?? 'None'}</p>
    <p className="hint">For flames, <strong>stop at ≥ target</strong> means keep rolling until you reach that
      score or higher. At that point, another available upgrade is estimated to give at least as much
      gain per meso as further flaming. Continuing can still improve the item; it may simply be less
      efficient. With no competing upgrade, the target is the next obtainable improvement.</p>
    <p className="hint"><strong>Average result</strong> is the average of all rolls that meet or exceed
      the stopping target, including lucky rolls far above it. For example, 186.446 → ≥186.806 with an
      average result of 195.410 means stop at any roll of at least 186.806—not keep rolling until 195.410.
      Your actual result could be below or above that average. The expected gain is 8.964; the minimum
      gain is only 0.360.</p>
    <p className="hint">Choosing to continue until ≥195.410 would be a different, more expensive target:
      rolls between 186.806 and 195.410 would no longer qualify, so the displayed expected cost would
      not apply. Record your actual flame score and recalculate to decide what to upgrade next.
      Black Flames are priced at 3M each; Abyssal Flames are excluded because they have no meso price.</p>
    {steps.length ? <>
      <p className="hint">Showing up to {plan.step_limit} projected steps. Later flame steps start from
        the projected average result, which may differ from your actual roll. Costs are averages,
        not guaranteed budgets.</p>
      <div className="upgrade-table-scroll" role="region" aria-label="Combined upgrade recommendations" tabIndex="0">
        <table className="upgrade-table overall-upgrade-table">
          <caption>Automatic targets and projected upgrade order</caption>
          <thead><tr>
            <th scope="col">#</th><th scope="col">Equipment / upgrade</th>
            <th scope="col">Starting score / stop at</th><th scope="col">Expected score gain</th>
            <th scope="col">Expected booms</th>
            <th scope="col">Expected mesos</th><th scope="col">Score gain / 100M</th>
            <th scope="col">Total mesos so far</th>
          </tr></thead>
          <tbody>{steps.map(entry => <tr key={entry.step}>
            <td>{entry.step}</td>
            <th scope="row">{entry.name}
              <small>{entry.slot}{entry.equipment_level != null && ` · Lv. ${entry.equipment_level}`}</small>
              <small>{entry.category === 'flames' ? 'Black Flames'
                : entry.category === 'potential' ? `${cubeType === 'black' ? 'Black' : 'Red'} cubes`
                  : 'Star Force'}</small>
            </th>
            <td>{entry.category === 'starforce'
              ? `${entry.start_star} → ${entry.next_star} stars`
              : <>{score.format(entry.current_score)} → ≥{score.format(entry.target_score)}
                <small>{entry.category === 'flames' ? 'Flame score' : 'Potential weighted score'}</small>
                <small>Average result: {score.format(entry.expected_final_score)}</small></>}
            </td>
            <td>+{score.format(entry.expected_score_gain)}</td>
            <td>{entry.category === 'starforce' ? score.format(entry.expected_booms ?? 0) : '-'}</td>
            <td title={score.format(entry.action_cost_mesos)}>{mesos.format(entry.action_cost_mesos)}</td>
            <td>{score.format(entry.gain_per_meso * 100_000_000)}</td>
            <td title={score.format(entry.cumulative_cost_mesos)}>{mesos.format(entry.cumulative_cost_mesos)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </> : <p role="status">No eligible upgrades with positive score gain and a known meso cost.</p>}
    {plan?.unavailable?.length > 0 && <details className="upgrade-notes">
      <summary>Unavailable estimates ({plan.unavailable.length})</summary>
      <ul>{plan.unavailable.map((entry, index) => <li key={`${entry.category}-${entry.slot}-${index}`}>
        {entry.name} ({entry.slot}) · {UPGRADE_CATEGORIES[entry.category]}: {entry.note}
      </li>)}</ul>
    </details>}
  </section>
}
