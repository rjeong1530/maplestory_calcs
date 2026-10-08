import { equipInSlot, equipmentChoices, EQUIPMENT_SLOTS, CLASS_FAMILIES, FIXED_RING_SLOT, withFixedRing } from './flameEquipment.js'
import { maxStarForceForEquipment, replacementCostForEquipment } from './starforce.js'
import { isObject, LINE_FIELDS, restoreEquipmentLines } from './equipmentLines.js'
import { FLAME_WEIGHT_LABELS, POTENTIAL_WEIGHT_LABELS } from './equipmentUpgrade.js'

function validateScoreWeights(weights) {
  if (!isObject(weights)) throw new Error('Invalid equipment score weights.')
  const allowed = { flame: FLAME_WEIGHT_LABELS, potential: POTENTIAL_WEIGHT_LABELS }
  return Object.fromEntries(Object.entries(weights).map(([group, values]) => {
    if (!Object.hasOwn(allowed, group) || !isObject(values)) throw new Error('Invalid equipment score weights.')
    return [group, Object.fromEntries(Object.entries(values).map(([key, value]) => {
      if (!Object.hasOwn(allowed[group], key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid equipment score weight: ${key}.`)
      }
      return [key, String(value)]
    }))]
  }))
}

export function serializeEquipment(equipment) {
  return Object.fromEntries(Object.entries(equipment).filter(([slot]) => slot !== FIXED_RING_SLOT).map(([slot, item]) => [slot, {
    id: item.id,
    current_star_force: item.currentStarForce ?? 0,
    ...(slot === 'hat' && item.minimumCooldownSeconds > 0 ? { minimum_cooldown_seconds: item.minimumCooldownSeconds } : {}),
    replacement_cost_mesos: replacementCostForEquipment(item, slot),
    ...(item.maxStarForce != null ? { max_star_force: item.maxStarForce } : {}),
    ...(item.starForceModes ? { mode_by_star: item.starForceModes } : {}),
    ...(item.starForceSafeguards ? { safeguard_by_star: item.starForceSafeguards } : {}),
    ...(item.needsFlameType ? { boss_equipment: item.config.boss_equipment } : {}),
    ...(item.currentPotential ? { current_potential: item.currentPotential } : {}),
    ...(item.currentFlames ? { current_flames: item.currentFlames } : {}),
    ...(item.currentFlameType ? { current_flame_type: item.currentFlameType } : {}),
    ...(typeof item.currentBossEquipment === 'boolean'
      ? { current_boss_equipment: item.currentBossEquipment } : {}),
  }]))
}

export function exportEquipment(equipment, equipmentClass, scoreWeights) {
  let weights
  if (scoreWeights !== undefined) {
    weights = Object.fromEntries(Object.entries(scoreWeights).map(([group, values]) => [group,
      Object.fromEntries(Object.entries(values).map(([key, value]) => {
        if (value == null || typeof value === 'boolean' || String(value).trim() === '') throw new Error('Enter valid score weights before exporting.')
        return [key, Number(value)]
      })),
    ]))
    validateScoreWeights(weights)
  }
  return JSON.stringify({
    format: 'maplestory-equipment', version: 1,
    equipment_class: equipmentClass, equipment: serializeEquipment(equipment),
    ...(weights ? { score_weights: weights } : {}),
  }, null, 2)
}

export function importEquipment(text) {
  let saved
  try {
    saved = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('Choose a valid equipment JSON file.')
  }
  if (!isObject(saved) || saved.format !== 'maplestory-equipment' || saved.version !== 1) {
    throw new Error('This file is not a supported equipment export (version 1).')
  }
  const scoreWeights = saved.score_weights === undefined ? null : validateScoreWeights(saved.score_weights)
  if (!Object.values(CLASS_FAMILIES).flat().includes(saved.equipment_class)
    || !isObject(saved.equipment)) {
    throw new Error('The file must contain a valid equipment class and equipment set.')
  }
  for (const [slot, item] of Object.entries(saved.equipment)) {
    // Replace legacy or edited ring-4 data with the fixed skill ring.
    if (slot === FIXED_RING_SLOT) continue
    const invalid = () => { throw new Error(`Invalid equipment data for ${slot}.`) }
    if (!EQUIPMENT_SLOTS.includes(slot) || slot === 'android' || !isObject(item)) invalid()
    const choice = equipmentChoices(slot, saved.equipment_class).find(choice => choice.id === item.id)
    if (!choice) throw new Error(`Equipment in ${slot} is unavailable for ${saved.equipment_class}.`)
    if (item.minimum_cooldown_seconds !== undefined && (slot !== 'hat'
      || !Number.isInteger(item.minimum_cooldown_seconds) || item.minimum_cooldown_seconds < 0
      || item.minimum_cooldown_seconds > 6)) invalid()
    if (item.replacement_cost_mesos !== undefined &&
      (typeof item.replacement_cost_mesos !== 'number' || !Number.isFinite(item.replacement_cost_mesos)
        || item.replacement_cost_mesos < 0)) invalid()
    if (!Number.isInteger(item.current_star_force) || item.current_star_force < 0
      || item.current_star_force > maxStarForceForEquipment(choice)) invalid()
    if (item.max_star_force !== undefined && (!Number.isInteger(item.max_star_force)
      || item.max_star_force < 0 || item.max_star_force > maxStarForceForEquipment(choice))) invalid()
    if (item.mode_by_star !== undefined && (!isObject(item.mode_by_star)
      || Object.entries(item.mode_by_star).some(([star, mode]) =>
        !/^(15|16|17|18|19|20|21)$/.test(star)
        || !Number.isInteger(mode) || mode < 1 || mode > (Number(star) <= 17 ? 3 : 4)))) invalid()
    if (item.safeguard_by_star !== undefined && (!isObject(item.safeguard_by_star)
      || Object.entries(item.safeguard_by_star).some(([star, enabled]) =>
        !/^(15|16|17)$/.test(star) || typeof enabled !== 'boolean'))) invalid()
    for (const key of ['boss_equipment', 'current_boss_equipment']) {
      if (item[key] !== undefined && typeof item[key] !== 'boolean') invalid()
    }
    if (item.current_flame_type !== undefined
      && !['powerful', 'black', 'abyssal'].includes(item.current_flame_type)) invalid()
    for (const [key, { limit }] of Object.entries(LINE_FIELDS)) {
      if (item[key] === undefined) continue
      if (!Array.isArray(item[key]) || item[key].length > limit) invalid()
      if (restoreEquipmentLines(item[key], key).length !== item[key].length) invalid()
    }
  }
  const equipment = restoreEquipment(saved.equipment, saved.equipment_class)
  if (equipment.top?.overall && saved.equipment.bottom) {
    throw new Error('An overall and bottom cannot be equipped together.')
  }
  if (Object.keys(equipment).filter(slot => slot !== FIXED_RING_SLOT).length !==
      Object.keys(saved.equipment).filter(slot => slot !== FIXED_RING_SLOT).length) {
    throw new Error('The equipment set contains conflicting slots.')
  }
  return { equipment, equipmentClass: saved.equipment_class, ...(scoreWeights ? { scoreWeights } : {}) }
}

export function restoreEquipment(savedEquipment, mapleClass) {
  return withFixedRing(Object.entries(isObject(savedEquipment) ? savedEquipment : {}).reduce((equipment, [slot, savedItem]) => {
    if (slot === FIXED_RING_SLOT) return equipment
    if (!EQUIPMENT_SLOTS.includes(slot) || slot === 'android') return equipment
    if (!savedItem || typeof savedItem.id !== 'number') return equipment
    const item = equipmentChoices(slot, mapleClass).find(choice => choice.id === savedItem.id)
    if (!item) return equipment
    const restoredItem = item.needsFlameType && typeof savedItem.boss_equipment === 'boolean'
      ? { ...item, config: { ...item.config, boss_equipment: savedItem.boss_equipment } }
      : item
    const maxStarForce = maxStarForceForEquipment(restoredItem)
    const currentStarForce = Number.isInteger(savedItem.current_star_force)
      ? Math.min(maxStarForce, Math.max(0, savedItem.current_star_force)) : 0
    return equipInSlot(equipment, slot, {
      ...restoredItem,
      currentStarForce,
      ...(slot === 'hat' ? { minimumCooldownSeconds: Number.isInteger(savedItem.minimum_cooldown_seconds)
        ? Math.max(0, Math.min(6, savedItem.minimum_cooldown_seconds)) : 0 } : {}),
      replacementCostMesos: typeof savedItem.replacement_cost_mesos === 'number'
        && Number.isFinite(savedItem.replacement_cost_mesos) && savedItem.replacement_cost_mesos >= 0
        ? savedItem.replacement_cost_mesos : replacementCostForEquipment(item, slot),
      ...(Number.isInteger(savedItem.max_star_force) ? {
        maxStarForce: Math.min(maxStarForce, Math.max(0, savedItem.max_star_force)),
      } : {}),
      ...(isObject(savedItem.safeguard_by_star) ? { starForceSafeguards: Object.fromEntries(
        Object.entries(savedItem.safeguard_by_star).filter(([star, enabled]) =>
          /^(15|16|17)$/.test(star) && typeof enabled === 'boolean'),
      ) } : {}),
      ...(isObject(savedItem.mode_by_star) ? { starForceModes: Object.fromEntries(
        Object.entries(savedItem.mode_by_star).filter(([star, mode]) =>
          /^(15|16|17|18|19|20|21)$/.test(star)
          && Number.isInteger(mode) && mode >= 1 && mode <= (Number(star) <= 17 ? 3 : 4)),
      ) } : {}),
      ...(Array.isArray(savedItem.current_potential)
        ? { currentPotential: restoreEquipmentLines(savedItem.current_potential, 'current_potential') } : {}),
      ...(Array.isArray(savedItem.current_flames)
        ? { currentFlames: restoreEquipmentLines(savedItem.current_flames, 'current_flames') } : {}),
      ...(typeof savedItem.current_flame_type === 'string'
        && ['powerful', 'black', 'abyssal'].includes(savedItem.current_flame_type)
        ? { currentFlameType: savedItem.current_flame_type } : {}),
      ...(typeof savedItem.current_boss_equipment === 'boolean'
        ? { currentBossEquipment: item.needsFlameType
          ? savedItem.current_boss_equipment : item.config.boss_equipment } : {}),
    })
  }, {}))
}

