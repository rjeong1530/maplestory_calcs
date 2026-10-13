import { equipmentLinesForRequest, isObject, restoreEquipmentLines } from './equipmentLines.js'

export const isAstraSecondary = (item, slot) => slot === 'secondary' && item?.name?.startsWith('Astra ')

export const DEFAULT_LADDERING = {
  start_star: 17, minimum_flame_score: 0, minimum_potential_score: 0, second_copy: null, transfer: null,
}

export const DEFAULT_TRANSFER = {
  donor_star: 0, donor_target: 26, donor_cost_mesos: 0, tier_up_cost_mesos: null, restore_trace: true,
}

function validTransfer(value) {
  return value == null || (isObject(value)
    && Object.keys(value).every(key => Object.hasOwn(DEFAULT_TRANSFER, key))
    && Number.isInteger(value.donor_star) && value.donor_star >= 0 && value.donor_star <= value.donor_target
    && Number.isInteger(value.donor_target) && value.donor_target >= 16 && value.donor_target <= 30
    && typeof value.restore_trace === 'boolean'
    && ['donor_cost_mesos', 'tier_up_cost_mesos'].every(key =>
      (key === 'tier_up_cost_mesos' && value[key] === null)
      || (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1e15)))
}

export function validLaddering(value, cap = 30) {
  return isObject(value)
    && Object.keys(value).every(key => Object.hasOwn(DEFAULT_LADDERING, key))
    && Object.keys(DEFAULT_LADDERING).every(key => {
      const number = value[key]
      if (key === 'transfer') return validTransfer(number)
      if (key === 'second_copy') return number == null || (isObject(number)
        && Object.keys(number).every(field => ['current_star_force', 'current_flames', 'current_potential'].includes(field))
        && Number.isInteger(number.current_star_force) && number.current_star_force >= 0 && number.current_star_force <= cap
        && ['current_flames', 'current_potential'].every(field => Array.isArray(number[field])
          && number[field].length <= (field === 'current_flames' ? 4 : 3)
          && restoreEquipmentLines(number[field], field).length === number[field].length))
      return typeof number === 'number' && Number.isFinite(number) && number >= 0
        && (key.endsWith('_star') ? Number.isInteger(number) && number <= cap : number <= 1e9)
    })
}

export function secondCopyItem(item) {
  const copy = item.laddering?.second_copy
  return { ...item, currentStarForce: copy?.current_star_force ?? 0,
    currentFlames: copy?.current_flames ?? [], currentPotential: copy?.current_potential ?? [] }
}

export function updateSecondCopy(settings, updates) {
  const copy = { current_star_force: 0, current_flames: [], current_potential: [], ...settings.second_copy }
  for (const [source, target] of Object.entries({ currentStarForce: 'current_star_force',
    currentFlames: 'current_flames', currentPotential: 'current_potential' })) {
    if (Object.hasOwn(updates, source)) copy[target] = updates[source]
  }
  return { ...settings, second_copy: copy }
}

export function ladderingForRequest(settings) {
  // Ignore legacy saved manual minimums; the backend computes stopping scores.
  settings = { ...settings, minimum_flame_score: 0, minimum_potential_score: 0 }
  if (!settings.second_copy) return { ...settings, second_copy: null }
  const copy = settings.second_copy
  return { ...settings, second_copy: { current_star_force: copy.current_star_force,
    current_flames: equipmentLinesForRequest(copy.current_flames, 'current_flames'),
    current_potential: equipmentLinesForRequest(copy.current_potential, 'current_potential'),
  } }
}
