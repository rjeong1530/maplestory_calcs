import { UPGRADE_CATEGORIES } from '../data/equipmentUpgrade'

const score = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const mesos = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export default function OverallUpgradeOrder({ plan, categories, cubeType }) {
  const steps = plan?.steps ?? []
  return <section aria-label="Overall upgrade order">
    <h3>Best next upgrades across your equipment</h3>
    <p className="hint">Compares {categories.map(category => UPGRADE_CATEGORIES[category]).join(', ')} using
      your score weights and current equipment. Black Flames cost 3M mesos each; potential uses your
      selected cubes and sale pricing. Abyssal Flames have no meso price and are excluded.</p>
    <p className="hint">Flame targets are stopping thresholds: once an item reaches that score or higher,
      another available upgrade is estimated to offer at least as much gain per meso as continuing to flame it.
      Targets account for level, boss flames,
      weapon stats, class weights, and the other upgrades available to you. With no competing upgrade,
      the target is the next obtainable improvement.</p>
    <p className="hint">The starting score is your recorded score, or a projected score for a later step.
      The average result is the mean of successful rolls that meet the target, including rolls that exceed it.
      Expected gain equals that average result minus the starting score, not the target minus the starting score.
      For example, 186.446 → ≥186.806 with an average result of 195.410 gives an expected gain of
      8.964, even though the minimum gain is only 0.360.</p>
    {steps.length ? <>
      <p className="hint">Showing up to {plan.step_limit} projected steps. Later steps use the expected score
        of successful rolls, which can exceed the target. Record your actual results and recalculate
        after each upgrade. These are expected costs, not a guaranteed budget or a globally optimal plan.</p>
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
      <p className="hint">Order is chosen from the efficiency at the start of each step. The displayed
        efficiency averages the whole recommended step, including rolls up to a flame target.
        Star Force compares ranges of up to six stars, with targets through 21 for items below 15,
        and includes all prerequisite costs. M = million; B = billion; T = trillion mesos.</p>
      {cubeType === 'red' && categories.includes('potential') && <p className="hint">
        Red cubes replace the current potential. Intermediate rolls can be worse while you pursue a better score.
      </p>}
    </> : <p role="status">No eligible upgrades with positive score gain and a known meso cost.</p>}
    {plan?.unavailable?.length > 0 && <details className="upgrade-notes">
      <summary>Unavailable estimates ({plan.unavailable.length})</summary>
      <ul>{plan.unavailable.map((entry, index) => <li key={`${entry.category}-${entry.slot}-${index}`}>
        {entry.name} ({entry.slot}) · {UPGRADE_CATEGORIES[entry.category]}: {entry.note}
      </li>)}</ul>
    </details>}
  </section>
}
