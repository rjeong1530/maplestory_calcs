import { FIXED_RING_SLOT } from './flameEquipment.js'
import { maxStarForceForEquipment, supportsStarForce } from './starforce.js'

export const EQUIPMENT_GROUPS = {
  pitched: 'Pitched', brilliant: 'Brilliant', kalos: 'Kalos Eternals', limbo: 'Limbo Eternals', other: 'Other equipment',
}

const BRILLIANT_NAMES = new Set(['Whisper of the Source', 'Oath of Death',
  'Blissful Nightmare', 'Original Sin of Pride'])

// Pitched membership: https://maplestorywiki.net/w/Pitched_Boss_Set
const PITCHED_NAMES = new Set(['Berserked', 'Magic Eyepatch', 'Commanding Force Earring',
  'Endless Terror', 'Source of Suffering', 'Dreamy Belt', 'Genesis Badge', 'Black Heart', 'Total Control'])

export function equipmentGroup(item, slot = item.slot) {
  if (BRILLIANT_NAMES.has(item.name)) return 'brilliant'
  if (PITCHED_NAMES.has(item.name) || /^Cursed (Red|Blue|Green|Yellow) Spellbook$/.test(item.name)
    || item.name.startsWith("Mitra's Rage:")) return 'pitched'
  if (item.name.startsWith('Eternal ')) {
    if (['hat', 'top', 'bottom', 'shoulder'].includes(slot)) return 'kalos'
    if (['cape', 'gloves', 'shoes'].includes(slot)) return 'limbo'
  }
  return 'other'
}

export function canApplyStrategy(item, slot) {
  return slot !== FIXED_RING_SLOT && supportsStarForce(item, slot) && maxStarForceForEquipment(item) > 15
}

export function applyStrategyToEquipment(equipment, slots, strategy) {
  const selected = new Set(slots)
  const modes = Object.fromEntries(Array.from({ length: 7 }, (_, index) => {
    const star = index + 15
    const mode = Number(strategy.mode_by_star?.[star] ?? 1)
    return [star, Number.isInteger(mode) && mode >= 1 && mode <= (star <= 17 ? 3 : 4) ? mode : 1]
  }))
  const safeguards = Object.fromEntries([15, 16, 17].map(star => [star, strategy.safeguard_by_star?.[star] === true]))
  for (const star of [15, 16, 17]) if (safeguards[star]) modes[star] = 1
  return Object.fromEntries(Object.entries(equipment).map(([slot, item]) => [slot,
    selected.has(slot) && canApplyStrategy(item, slot)
      ? { ...item, starForceModes: { ...modes }, starForceSafeguards: { ...safeguards } } : item]))
}
