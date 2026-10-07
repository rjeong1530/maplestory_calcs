const validProbability = probability => Number.isFinite(probability) && probability >= 0 && probability <= 1

export function rollsForChance(probability, percent) {
  if (!validProbability(probability) || !Number.isFinite(percent) || percent < 0 || percent > 100) return null
  if (percent === 0) return 0
  if (probability === 0) return null
  if (probability === 1) return 1
  if (percent === 100) return null
  const rolls = Math.ceil(Math.log1p(-percent / 100) / Math.log1p(-probability))
  return Number.isSafeInteger(rolls) ? rolls : null
}

export function rollBudgetForChance(probability, percent, cost) {
  if (!Number.isFinite(cost) || cost <= 0) return null
  const rolls = rollsForChance(probability, percent)
  const budget = rolls == null ? null : rolls * cost
  return budget != null && Number.isFinite(budget) ? budget : null
}

export function rollChanceForBudget(probability, budget, cost) {
  if (!validProbability(probability) || !Number.isFinite(budget) || budget < 0 || !Number.isFinite(cost) || cost <= 0) return null
  const rolls = Math.floor(budget / cost)
  if (!Number.isSafeInteger(rolls)) return null
  if (rolls === 0 || probability === 0) return 0
  if (probability === 1) return 100
  return -Math.expm1(rolls * Math.log1p(-probability)) * 100
}
