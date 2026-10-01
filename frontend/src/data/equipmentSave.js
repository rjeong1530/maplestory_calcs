import { equipInSlot, equipmentChoices, EQUIPMENT_SLOTS, CLASS_FAMILIES } from './flameEquipment.js'
import { maxStarForceForEquipment } from './starforce.js'

export function serializeEquipment(equipment) {
  return Object.fromEntries(Object.entries(equipment).map(([slot, item]) => [slot, {
    id: item.id,
    current_star_force: item.currentStarForce ?? 0,
    ...(item.needsFlameType ? { boss_equipment: item.config.boss_equipment } : {}),
    ...(item.currentPotential ? { current_potential: item.currentPotential } : {}),
    ...(item.currentFlames ? { current_flames: item.currentFlames } : {}),
    ...(item.currentFlameType ? { current_flame_type: item.currentFlameType } : {}),
    ...(typeof item.currentBossEquipment === 'boolean'
      ? { current_boss_equipment: item.currentBossEquipment } : {}),
  }]))
}

export function exportEquipment(equipment, equipmentClass) {
  return JSON.stringify({
    format: 'maplestory-equipment', version: 1,
    equipment_class: equipmentClass, equipment: serializeEquipment(equipment),
  }, null, 2)
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isNumeric = value => (typeof value === 'number' || typeof value === 'string')
  && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

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
  if (!Object.values(CLASS_FAMILIES).flat().includes(saved.equipment_class)
    || !isObject(saved.equipment)) {
    throw new Error('The file must contain a valid equipment class and equipment set.')
  }
  for (const [slot, item] of Object.entries(saved.equipment)) {
    const invalid = () => { throw new Error(`Invalid equipment data for ${slot}.`) }
    if (!EQUIPMENT_SLOTS.includes(slot) || slot === 'android' || !isObject(item)) invalid()
    const choice = equipmentChoices(slot, saved.equipment_class).find(choice => choice.id === item.id)
    if (!choice) throw new Error(`Equipment in ${slot} is unavailable for ${saved.equipment_class}.`)
    if (!Number.isInteger(item.current_star_force) || item.current_star_force < 0
      || item.current_star_force > maxStarForceForEquipment(choice)) invalid()
    for (const key of ['boss_equipment', 'current_boss_equipment']) {
      if (item[key] !== undefined && typeof item[key] !== 'boolean') invalid()
    }
    if (item.current_flame_type !== undefined
      && !['powerful', 'black', 'abyssal'].includes(item.current_flame_type)) invalid()
    for (const [key, label, value, limit] of [
      ['current_potential', 'effect', 'value', 3], ['current_flames', 'option', 'stage', 4],
    ]) {
      if (item[key] === undefined) continue
      if (!Array.isArray(item[key]) || item[key].length > limit) invalid()
      for (const line of item[key]) {
        if (!isObject(line) || typeof line[label] !== 'string'
          || !(line[value] === '' || isNumeric(line[value]))) invalid()
        if (key === 'current_flames' && line[value] !== ''
          && (!Number.isInteger(Number(line[value])) || Number(line[value]) < 1
            || Number(line[value]) > 7)) invalid()
      }
    }
  }
  const equipment = restoreEquipment(saved.equipment, saved.equipment_class)
  if (equipment.top?.overall && saved.equipment.bottom) {
    throw new Error('An overall and bottom cannot be equipped together.')
  }
  if (Object.keys(equipment).length !== Object.keys(saved.equipment).length) {
    throw new Error('The equipment set contains conflicting slots.')
  }
  return { equipment, equipmentClass: saved.equipment_class }
}

export function restoreEquipment(savedEquipment, mapleClass) {
  return Object.entries(savedEquipment || {}).reduce((equipment, [slot, savedItem]) => {
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
      ...(Array.isArray(savedItem.current_potential)
        ? { currentPotential: savedItem.current_potential.slice(0, 3) } : {}),
      ...(Array.isArray(savedItem.current_flames)
        ? { currentFlames: savedItem.current_flames.slice(0, 4) } : {}),
      ...(typeof savedItem.current_flame_type === 'string'
        && ['powerful', 'black', 'abyssal'].includes(savedItem.current_flame_type)
        ? { currentFlameType: savedItem.current_flame_type } : {}),
      ...(typeof savedItem.current_boss_equipment === 'boolean'
        ? { currentBossEquipment: savedItem.current_boss_equipment } : {}),
    })
  }, {})
}

