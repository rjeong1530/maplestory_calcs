const baseStats = ['STR_PCT', 'DEX_PCT', 'INT_PCT', 'LUK_PCT']

// Translate the frontend All Stat choice into the API's stat-total targets.
export function buildPotentialTargets(rows) {
  const totals = new Map()
  for (const { effect, target } of rows) {
    const effects = effect === 'ALL_STAT_PCT' ? baseStats : [effect]
    for (const stat of effects) {
      totals.set(stat, (totals.get(stat) ?? 0) + Number(target))
    }
  }
  return [...totals].map(([effect, target]) => ({ effect, target }))
}
