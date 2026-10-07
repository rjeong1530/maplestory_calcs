const CUBE_COSTS = { black: 22_000_000, red: 12_000_000 }

export function cubeCost(cubeType, cubeSale = false) {
  const cost = CUBE_COSTS[cubeType]
  return cost == null ? null : cost * (cubeSale ? 0.75 : 1)
}

export function cubeCostLabel(cubeType, cubeSale = false) {
  return (cubeCost(cubeType, cubeSale) / 1_000_000) + 'M mesos per cube'
}
