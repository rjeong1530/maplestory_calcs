import { MVP_RANKS, UPGRADE_CATEGORIES } from '../data/equipmentUpgrade'

const score = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const mesos = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export default function OverallUpgradeOrder({ plan, settings, cubeType }) {
  const steps = plan?.steps ?? []
  return <section aria-label="Overall upgrade order">
    <h3>Best next upgrades across your equipment</h3>
    {plan?.laddering_enabled && <details className="upgrade-notes">
      <summary>How laddering costs and efficiency work</summary>
      <p>A laddering recommendation includes the <strong>full cost needed before swapping</strong>:</p>
      <ul>
        <li>Star Force from the second copy's current stars to its target.</li>
        <li>Potential and flame rerolls needed to reach the calculated minimum scores.</li>
        <li>Expected boom replacement costs, if configured.</li>
      </ul>
      <p>Its efficiency is <strong>expected total score gain over your equipped item divided by that combined cost</strong>.</p>
      <p>A spare needing substantial rerolling can rank lower or fall outside the recommended steps,
        even if its Star Force upgrade alone looks efficient. Already-sufficient rolls add no reroll cost.
        Only enabled roll categories can contribute preparation.</p>
      <p className="hint"><strong>Laddering mode:</strong> configured items keep their equipped copy safe while the second copy is enhanced. Each step includes spare Star Force and any rolling needed to meet its minimum scores. Swap when total score improves; a better-rolled copy may win at equal or lower stars. The old equipped copy becomes the next spare. Minimum scores are calculated automatically. No recorded second-copy stats means 0 stars and zero roll scores, with preparation costs included. Costs assume both copies are owned and potential is Legendary. Per-category tabs still show standard upgrades.</p>
    </details>}
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
            <th scope="row">{entry.name}{entry.copy_label && ` — ${entry.copy_label}`}
              {entry.copy_label && <small>{entry.laddering ? 'Backup copy → equipped after this step' : 'Equipped copy'}</small>}
              <small>{entry.slot}{entry.equipment_level != null && ` · Lv. ${entry.equipment_level}`}</small>
              <small>{entry.category === 'flames' ? 'Black Flames'
                : entry.category === 'potential' ? `${cubeType === 'black' ? 'Black' : 'Red'} cubes`
                  : entry.laddering ? 'Star Force · Ladder second copy' : 'Star Force'}</small>
              {entry.category === 'starforce' && <small>Laddering used: {entry.laddering ? 'Yes' : 'No'}</small>}
            </th>
            <td>{entry.category === 'starforce'
              ? <>{entry.start_star} → {entry.next_star} stars
                {entry.laddering && <>
                  <small>Keep {entry.protected_copy_label || 'equipped copy'} at {entry.protected_star}★ until the swap.</small>
                  {entry.copy_label && <small>Equip {entry.copy_label} after this step; {entry.protected_copy_label} becomes the backup. Original and Spare labels stay with their copies throughout this plan.</small>}
                  {entry.assumed_second_copy && <small>No spare stats recorded: starting at 0 stars and zero roll scores; preparation costs are included.</small>}
                  <small>Spare flame: {score.format(entry.spare_flame_score)} · Minimum: {score.format(entry.minimum_flame_score)} · Average after preparation: {score.format(entry.expected_flame_score)}</small>
                  <small>Spare potential: {score.format(entry.spare_potential_score)} · Minimum: {score.format(entry.minimum_potential_score)} · Average after preparation: {score.format(entry.expected_potential_score)}</small>
                  <small>To improve total score at {entry.next_star}★: combined flame + potential must exceed {score.format(entry.break_even_combined_roll_score)}.</small>
                  <small>Preparation: {mesos.format(entry.preparation_cost_mesos)} mesos included; then swap copies.</small>
                </>}
              </>
              : <>{score.format(entry.current_score)} → ≥{score.format(entry.target_score)}
                <small>{entry.category === 'flames' ? 'Flame score' : 'Potential weighted score'}</small>
                <small>Average result: {score.format(entry.expected_final_score)}</small></>}
            </td>
            <td>+{score.format(entry.expected_score_gain)}</td>
            <td>{entry.category === 'starforce' ? score.format(entry.expected_booms ?? 0) : '-'}</td>
            <td title={score.format(entry.action_cost_mesos)}>{mesos.format(entry.action_cost_mesos)}</td>
            <td>{entry.action_cost_mesos === 0 ? 'No spending needed' : score.format(entry.gain_per_meso * 100_000_000)}</td>
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
