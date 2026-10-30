// Presentation only: preserve the planner's order and cumulative spending.
// Copy swaps and transfer routes are separate actions with their own details.
export function overallDisplayRows(steps) {
  const rows = []
  const ordinary = step => step.category === 'starforce' && !step.laddering && !step.transfer_route && !step.transfer_options
    && Number.isFinite(step.start_star) && Number.isFinite(step.next_star)
    && Number.isFinite(step.action_cost_mesos) && Number.isFinite(step.expected_score_gain)
  for (const step of steps) {
    const previous = rows.at(-1)
    if (previous && ordinary(previous) && ordinary(step)
      && previous.slot === step.slot && previous.name === step.name
      && previous.copy_label === step.copy_label && previous.next_star === step.start_star) {
      previous.next_star = step.next_star
      previous.last_step = step.step
      previous.action_cost_mesos += step.action_cost_mesos
      previous.expected_score_gain += step.expected_score_gain
      previous.expected_booms = (previous.expected_booms ?? 0) + (step.expected_booms ?? 0)
      previous.gain_per_meso = previous.action_cost_mesos ? previous.expected_score_gain / previous.action_cost_mesos : null
      previous.cumulative_cost_mesos = step.cumulative_cost_mesos
    } else {
      rows.push({ ...step })
    }
  }
  return rows
}
