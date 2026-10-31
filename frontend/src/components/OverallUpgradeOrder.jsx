import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { overallDisplayRows } from '../data/overallDisplayRows'
import { useWorkshopMotion } from '../ui/motion'
import { MVP_RANKS, UPGRADE_CATEGORIES } from '../data/equipmentUpgrade'

const score = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const mesos = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export default function OverallUpgradeOrder({ plan, settings, cubeType }) {
  const { reduced, transition, entrance } = useWorkshopMotion()
  const steps = useMemo(() => overallDisplayRows(plan?.steps ?? []), [plan?.steps])
  return <section aria-label="Overall upgrade order">
    {plan?.laddering_enabled && <details className="upgrade-notes mt-5 text-[13px] leading-[1.7] [&_summary]:cursor-pointer [&_li]:mb-2">
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
      <p className="hint text-[12px] text-subtle mb-4.5"><strong>Laddering mode:</strong> configured items keep their equipped copy safe while the second copy is enhanced. Each step includes spare Star Force and any rolling needed to meet its minimum scores. Swap when total score improves; a better-rolled copy may win at equal or lower stars. The old equipped copy becomes the next spare. Minimum scores are calculated automatically. No recorded second-copy stats means 0 stars and zero roll scores, with preparation costs included. Costs assume both copies are owned and potential is Legendary. Per-category tabs still show standard upgrades.</p>
    </details>}
    <p className="hint text-[12px] text-subtle mb-4.5">Cube sale: {settings.cube_sale ? 'On' : 'Off'} · Shining Star Force: {settings.shining_starforce_sunday ? 'On' : 'Off'} · MVP discount: {MVP_RANKS[settings.mvp_rank] ?? 'None'}</p>
    <p className="hint text-[12px] text-subtle mb-4.5">For flames, <strong>stop at ≥ target</strong> means keep rolling until you reach that
      score or higher. At that point, another available upgrade is estimated to give at least as much
      gain per meso as further flaming. Continuing can still improve the item; it may simply be less
      efficient. With no competing upgrade, the target is the next obtainable improvement.</p>
    <p className="hint text-[12px] text-subtle mb-4.5"><strong>Average result</strong> is the average of all rolls that meet or exceed
      the stopping target, including lucky rolls far above it. For example, 186.446 → ≥186.806 with an
      average result of 195.410 means stop at any roll of at least 186.806—not keep rolling until 195.410.
      Your actual result could be below or above that average. The expected gain is 8.964; the minimum
      gain is only 0.360.</p>
    <p className="hint text-[12px] text-subtle mb-4.5">Choosing to continue until ≥195.410 would be a different, more expensive target:
      rolls between 186.806 and 195.410 would no longer qualify, so the displayed expected cost would
      not apply. Record your actual flame score and recalculate to decide what to upgrade next.
      Black Flames are priced at 3M each; Abyssal Flames are excluded because they have no meso price.</p>
    {steps.length ? <>
      <p className="hint text-[12px] text-subtle mb-4.5">Showing up to {plan.step_limit} projected steps. Later flame steps start from
        the projected average result, which may differ from your actual roll. Costs are averages,
        not guaranteed budgets. Consecutive ordinary Star Force steps for the same item are combined;
        row numbers show the original step range. Copy swaps and transfers stay separate.</p>
      <div className="max-w-full overflow-x-auto" role="region" aria-label="Combined upgrade recommendations" tabIndex="0">
        <table className="upgrade-table overall-upgrade-table min-w-180 text-[13px] table-fixed [&_caption]:text-accent [&_caption]:py-3
        [&_caption]:px-0 [&_th]:py-3 [&_th]:pr-2.5 [&_th]:pl-2.5 [&_td]:py-3 [&_td]:pr-2.5 [&_td]:pl-2.5
        [&_td]:whitespace-nowrap [&_td]:tabular-nums [&_th[scope='row']]:min-w-50 [&_th[scope='row']]:text-left
        [&_small]:block [&_small]:text-subtle [&_small]:font-normal [&_small]:mt-1.25 [&_th]:min-w-0 [&_th]:px-1.5
        [&_th]:whitespace-normal [&_th]:[overflow-wrap:anywhere] [&_th]:[vertical-align:top] [&_td]:min-w-0
        [&_td]:px-1.5 [&_td]:whitespace-normal [&_td]:[overflow-wrap:anywhere] [&_td]:[vertical-align:top]
        [&_th[scope='row']]:min-w-0 [&_+_.hint]:mt-4">
          <caption>Automatic targets and projected upgrade order</caption>
          <colgroup>{['w-[4%]', 'w-[19%]', 'w-1/4', 'w-[10%]', 'w-[12%]', 'w-[10%]', 'w-[10%]', 'w-[10%]'].map((width, index) => <col key={index} className={width} />)}</colgroup>
          <thead><tr>
            <th scope="col">#</th><th scope="col">Equipment / upgrade</th>
            <th scope="col">Starting score / stop at</th><th scope="col">Expected score gain</th>
            <th scope="col">Expected booms</th>
            <th scope="col">Expected mesos</th><th scope="col">Score gain / 100M</th>
            <th scope="col">Total mesos so far</th>
          </tr></thead>
          <tbody>{steps.map(entry => <motion.tr layout={reduced ? false : 'position'} {...entrance} transition={transition} key={entry.step}>
            <td>{entry.last_step != null ? `${entry.step}–${entry.last_step}` : entry.step}</td>
            <th scope="row"><span aria-hidden="true" className="upgrade-type-icon">{entry.category === 'starforce' ? '★' : entry.category === 'flames' ? '🔥' : '◇'}</span> {entry.name}{entry.copy_label && ` — ${entry.copy_label}`}
              {entry.copy_label && <small>{entry.laddering ? 'Backup copy → equipped after this step' : 'Equipped copy'}</small>}
              <small>{entry.slot}{entry.equipment_level != null && ` · Lv. ${entry.equipment_level}`}</small>
              <small>{entry.category === 'flames' ? 'Black Flames'
                : entry.category === 'potential' ? `${cubeType === 'black' ? 'Black' : 'Red'} cubes`
                  : entry.laddering ? 'Star Force · Ladder second copy' : 'Star Force'}</small>
              {entry.category === 'starforce' && <small>{entry.transfer_route
                ? `SoS route: ${entry.transfer_route === 'spare_transfer' ? 'Spare transfer' : entry.transfer_route === 'equipped_transfer' ? 'Transfer onto equipped SoS' : 'Trace restoration + Gollux transfer'}`
                : `Laddering used: ${entry.laddering ? 'Yes' : 'No'}`}</small>}
            </th>
            <td>{entry.category === 'starforce'
              ? <>{entry.start_star} → {entry.next_star} stars
                {entry.transfer_options && <div className="upgrade-step-details mt-2 text-[12px] leading-[1.6] [&_summary]:cursor-pointer [&_summary]:text-accent">
                  <small>Alternatives, not consecutive steps. Row totals use the indicated route.</small>
                  {['equipped_transfer', 'spare_transfer'].map(route => {
                    const option = entry.transfer_options.find(value => value.transfer_route === route)
                    return <details key={route}>
                      <summary>{route === 'equipped_transfer' ? 'Transfer onto equipped SoS' : 'Transfer onto spare SoS'}{entry.transfer_route === route ? ' · Used for ranking' : ''}</summary>
                      {option ? <>
                        <small>Gollux {option.donor_start} → {option.donor_target}★; transfer to {option.transfer_star}★ SoS{option.next_star > option.transfer_star && `, then tap to ${option.next_star}★`}.</small>
                        <small>Potential rerolls: {mesos.format(option.potential_roll_cost_mesos)} mesos. Legendary tier-up: {mesos.format(option.tier_up_cost_mesos)} mesos.</small>
                        {route === 'spare_transfer'
                          ? <small>Flame rerolls: {mesos.format(option.flame_roll_cost_mesos)} mesos. Keep the equipped item until the spare improves.</small>
                          : <>
                            <small>Equipped flame retained; no flame reroll cost. Existing potential is overwritten.</small>
                            <small>Before transferring: if your owned Superior Gollux pendant is already exactly 2 stars above your equipped SoS and you have a replacement to restore its trace, tap the equipped SoS for one more star first. On success, keep its potential and the donor. If it booms, restore the trace, then transfer the donor to reach that same star while retaining the flame. This advice is not included in the displayed costs or boom estimates; those assume a direct transfer.</small>
                          </>}
                        <small>Total: {mesos.format(option.action_cost_mesos)} mesos · Gain: {score.format(option.expected_score_gain)} · SoS booms: {score.format(option.expected_sos_booms)} · Gollux booms: {score.format(option.expected_gollux_booms)}.</small>
                      </> : <small>No eligible improvement with the current caps and enabled roll categories.</small>}
                    </details>
                  })}
                </div>}
                {entry.transfer_route && <details className="upgrade-step-details mt-2 text-[12px] leading-[1.6] [&_summary]:cursor-pointer [&_summary]:text-accent"><summary>Transfer and recovery details</summary>
                  {entry.assumed_second_copy && <small>No spare stats recorded: assumes an owned spare with 0 stars and zero flame/potential scores. Required preparation is included; initial spare acquisition is excluded.</small>}
                  {entry.donor_target != null && <small>Gollux preparation: {entry.donor_start === entry.donor_target
                    ? `owned donor is already at ${entry.donor_target}★`
                    : `Star Force ${entry.donor_start} → ${entry.donor_target}★`}.{entry.transfer_route === 'restore_then_transfer' && ' Needed if SoS booms; preparation cost is weighted by that chance.'}</small>}
                  <small>{entry.transfer_route === 'spare_transfer'
                    ? `Transfer to Spare; keep ${entry.protected_copy_label} at ${entry.protected_star}★ until it improves your total score.`
                    : entry.transfer_route === 'equipped_transfer'
                      ? 'Transfer directly onto equipped SoS. Its flame stays; its potential is replaced. Complete any remaining Star Force before rebuilding potential.'
                    : entry.transfer_route === 'restore_then_transfer'
                      ? entry.recovery_reaches_target
                        ? 'Tap equipped SoS until success or a boom. Success keeps its potential and the donor. On a boom, restore the trace and transfer the owned donor to reach the target with the original flame; then rebuild potential.'
                        : 'Tap equipped SoS. After each boom: restore its trace, then transfer a Gollux pendant to regain stars.'
                      : 'Tap equipped SoS; restore its trace after booms without overwriting potential.'}</small>
                  {entry.donor_target != null && <small>Transfer produces {entry.donor_target - 1}★ SoS. Donor is consumed; receiving SoS flame is retained.</small>}
                  {entry.transfer_star < entry.next_star && <small>Then Star Force the {entry.transfer_route === 'equipped_transfer' ? 'equipped' : 'spare'} SoS: {entry.transfer_star} → {entry.next_star}★. Expected cost including recovery: {mesos.format(entry.post_transfer_cost_mesos)} mesos. After a SoS boom: {entry.spare_recovery === 'restore_then_transfer' ? 'restore its trace, then consume a rebuilt Gollux donor to regain stars' : 'restore its trace and Star Force back up'}. Rebuild potential after these taps.</small>}
                  {entry.transfer_route !== 'trace_only' && <>
                    <small>Transfer replaces potential. Rebuild after Star Force; minimum potential score: {score.format(entry.minimum_potential_score)}.</small>
                    <small>Expected transfers: {score.format(entry.expected_transfers)}. Tier-up and roll preparation: {mesos.format(entry.preparation_cost_mesos)} mesos included.</small>
                  </>}
                  <small>Recalculate after this sequence with actual stars, rolls, and remaining donors. Further upgrades for this SoS are not projected.</small>
                </details>}
                {entry.laddering && !entry.transfer_route && <details className="upgrade-step-details mt-2 text-[12px] leading-[1.6] [&_summary]:cursor-pointer [&_summary]:text-accent"><summary>Laddering details</summary>
                  <small>Keep {entry.protected_copy_label || 'equipped copy'} at {entry.protected_star}★ until the swap.</small>
                  {entry.copy_label && <small>Equip {entry.copy_label} after this step; {entry.protected_copy_label} becomes the backup. Original and Spare labels stay with their copies throughout this plan.</small>}
                  {entry.assumed_second_copy && <small>No spare stats recorded: starting at 0 stars and zero roll scores; preparation costs are included.</small>}
                  <small>Spare flame: {score.format(entry.spare_flame_score)} · Minimum: {score.format(entry.minimum_flame_score)} · Average after preparation: {score.format(entry.expected_flame_score)}</small>
                  <small>Spare potential: {score.format(entry.spare_potential_score)} · Minimum: {score.format(entry.minimum_potential_score)} · Average after preparation: {score.format(entry.expected_potential_score)}</small>
                  <small>To improve total score at {entry.next_star}★: combined flame + potential must exceed {score.format(entry.break_even_combined_roll_score)}.</small>
                  <small>Preparation: {mesos.format(entry.preparation_cost_mesos)} mesos included; then swap copies.</small>
                </details>}
              </>
              : <>{score.format(entry.current_score)} → ≥{score.format(entry.target_score)}
                <small>{entry.category === 'flames' ? 'Flame score' : 'Potential weighted score'}</small>
                <small>Average result: {score.format(entry.expected_final_score)}</small></>}
            </td>
            <td>+{score.format(entry.expected_score_gain)}</td>
            <td>{entry.category !== 'starforce' ? '-' : entry.expected_gollux_booms != null ? <>
              <span>SoS: {score.format(entry.expected_sos_booms)}</span>
              <small>Gollux: {score.format(entry.expected_gollux_booms)}</small>
            </> : <>{entry.transfer_route && 'Combined: '}{score.format(entry.expected_booms ?? 0)}</>}</td>
            <td title={score.format(entry.action_cost_mesos)}>{mesos.format(entry.action_cost_mesos)}</td>
            <td>{entry.action_cost_mesos === 0 ? 'No spending needed' : score.format(entry.gain_per_meso * 100_000_000)}</td>
            <td title={score.format(entry.cumulative_cost_mesos)}>{mesos.format(entry.cumulative_cost_mesos)}</td>
          </motion.tr>)}</tbody>
        </table>
      </div>
    </> : <p role="status">No eligible upgrades with positive score gain and a known meso cost.</p>}
    {plan?.unavailable?.length > 0 && <details className="upgrade-notes mt-5 text-[13px] leading-[1.7] [&_summary]:cursor-pointer [&_li]:mb-2">
      <summary>Unavailable estimates ({plan.unavailable.length})</summary>
      <ul>{plan.unavailable.map((entry, index) => <li key={`${entry.category}-${entry.slot}-${index}`}>
        {entry.name} ({entry.slot}) · {UPGRADE_CATEGORIES[entry.category]}: {entry.note}
      </li>)}</ul>
    </details>}
  </section>
}
