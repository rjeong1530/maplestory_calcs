// Use the sampled CDF without interpolation: upward budget lookup and downward
// probability lookup remain conservative, including jumps and flat regions.
export function budgetForChance(distribution, percent) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null
  const values = distribution.probabilities
  const target = percent / 100
  if (target > values.at(-1)) return null
  let low = 0
  let high = values.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (values[middle] >= target) high = middle
    else low = middle + 1
  }
  return low * distribution.step_mesos
}

export function chanceForBudget(distribution, mesos) {
  if (!Number.isFinite(mesos) || mesos < 0 || mesos > distribution.calculation_limit_mesos) return null
  return distribution.probabilities[Math.floor(mesos / distribution.step_mesos)] * 100
}
