export function nameCustomStrategies(strategies) {
  return strategies.map((strategy, index) => ({ ...strategy, name: `Your strategy ${index + 1}` }))
}

export function strategySteps(row, target) {
  // Include lower stars because a boom can send the item below its starting star.
  return Array.from({ length: target }, (_, star) => ({
    star, action: row.safeguard_by_star[star] ? 'Safeguard (Mode 1)'
      : star >= 15 && star <= 21 ? `Mode ${row.mode_by_star[star] ?? 1}` : 'Standard',
  })).reduce((ranges, step) => {
    const previous = ranges.at(-1)
    if (previous?.action === step.action) previous.to = step.star + 1
    else ranges.push({ from: step.star, to: step.star + 1, action: step.action })
    return ranges
  }, [])
}

export function frontierPoints(rows, extraRows = []) {
  const allRows = [...rows, ...extraRows]
  const maxSpares = Math.max(1, ...allRows.map(row => row.expected_spares))
  const maxCost = Math.max(1, ...allRows.map(row => row.enhancement_cost_mesos))
  const point = row => ({
    x: 75 + row.expected_spares / maxSpares * 590,
    y: 280 - row.enhancement_cost_mesos / maxCost * 240,
  })
  return { maxSpares, maxCost, points: rows.map(point), extraPoints: extraRows.map(point) }
}
