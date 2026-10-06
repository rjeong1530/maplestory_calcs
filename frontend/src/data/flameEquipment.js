import { CLASS_WEAPONS, getWeaponConfig } from './flameWeapons.js'
import { secondarySupportsJob } from './secondaryEquipment.js'
import catalog from './equipment_140_250.json' with { type: 'json' }
import catalogMetadata from './equipment_140_250.meta.json' with { type: 'json' }

export const equipmentIconUrl = itemid =>
  `https://maplestory.io/api/${catalogMetadata.region}/${catalogMetadata.version}/item/${itemid}/icon`

// Fixed skill ring; it does not participate in enhancement calculations.
export const FIXED_RING_SLOT = 'ring-4'
export function fixedRing() {
  return { id: 1113098, name: 'Ring of Restraint', slot: 'ring',
    icon: equipmentIconUrl(1113098), color: '#a0e4b3',
    config: { equipment_type: 'armor', equipment_level: 110, boss_equipment: false },
    currentStarForce: 0, currentPotential: [], currentFlames: [] }
}
export const withFixedRing = equipment => ({ ...equipment, [FIXED_RING_SLOT]: fixedRing() })

export const EQUIPMENT_SLOTS = [
  'ring-1', null, 'hat', null, 'emblem',
  'ring-2', 'pendant-1', 'face', null, 'badge',
  'ring-3', 'pendant-2', 'eye', 'earring', 'medal',
  'ring-4', 'weapon', 'top', 'shoulder', 'secondary',
  'pocket', 'belt', 'bottom', 'gloves', 'cape',
  null, null, 'shoes', 'android', 'heart',
]
export const SLOT_LABELS = {
  ring: 'Ring', hat: 'Hat', emblem: 'Emblem', pendant: 'Pendant', face: 'Face',
  badge: 'Badge', eye: 'Eye', earring: 'Earring', medal: 'Medal', weapon: 'Weapon',
  top: 'Top / overall', shoulder: 'Shoulder', secondary: 'Secondary', pocket: 'Pocket',
  belt: 'Belt', bottom: 'Bottom', gloves: 'Gloves', cape: 'Cape', shoes: 'Shoes',
  android: 'Android', heart: 'Heart',
}
export const FLAME_SLOTS = new Set(['hat', 'pendant', 'face', 'eye', 'earring', 'weapon',
  'top', 'pocket', 'belt', 'bottom', 'gloves', 'cape', 'shoes', 'medal'])

const POTENTIAL_EQUIPMENT_TYPES = {
  weapon: 'weapon',
  emblem: 'emblem',
  secondary: 'secondary weapon',
  hat: 'hat',
  top: 'top',
  bottom: 'bottom',
  shoes: 'shoes',
  gloves: 'gloves',
  cape: 'cape',
  belt: 'belt',
  shoulder: 'shoulder accessory',
  ring: 'accessory',
  pendant: 'accessory',
  face: 'accessory',
  eye: 'accessory',
  earring: 'accessory',
  heart: 'heart',
}

export const CLASS_FAMILIES = {
  Warrior: ['Hero', 'Paladin', 'Dark Knight', 'Dawn Warrior', 'Mihile', 'Aran', 'Blaster',
    'Demon Slayer', 'Demon Avenger', 'Kaiser', 'Adele', 'Hayato'],
  Magician: ['Arch Mage (Fire/Poison)', 'Arch Mage (Ice/Lightning)', 'Bishop', 'Blaze Wizard',
    'Evan', 'Luminous', 'Battle Mage', 'Illium', 'Lara', 'Kinesis', 'Kanna'],
  Bowman: ['Bowmaster', 'Marksman', 'Pathfinder', 'Wind Archer', 'Mercedes', 'Wild Hunter', 'Kain'],
  Thief: ['NightLord', 'Shadower', 'Dual Blade', 'Night Walker', 'Phantom', 'Xenon', 'Cadena', 'Khali', 'Hoyoung'],
  Pirate: ['Buccaneer', 'Corsair', 'Cannoneer', 'Thunder Breaker', 'Shade', 'Mechanic', 'Xenon', 'Angelic Buster', 'Ark'],
}

// Item-ID families distinguish weapons that the source groups under one broad type.
const WEAPON_PREFIXES = {
  1212: 'shining_rod', 1213: 'bladecaster', 1214: 'whispershot',
  1222: 'soul_shooter', 1232: 'desperado', 1242: 'whip_blade',
  1262: 'psy_limiter', 1272: 'chain', 1282: 'lucent_gauntlet', 1292: 'ritual_fan',
  1302: 'one_handed_sword', 1312: 'one_handed_axe', 1322: 'one_handed_hammer',
  1332: 'dagger', 1362: 'cane', 1372: 'wand', 1382: 'staff',
  1402: 'two_handed_sword', 1404: 'chakram', 1412: 'two_handed_axe',
  1422: 'two_handed_hammer', 1432: 'spear', 1442: 'polearm', 1452: 'bow',
  1462: 'crossbow', 1472: 'claw', 1482: 'knuckle', 1492: 'gun',
  1522: 'dual_bowguns', 1532: 'hand_cannon', 1542: 'katana', 1552: 'fan',
  1582: 'arm_cannon', 1592: 'ancient_bow',
}

function weaponSeries(name) {
  if (name.startsWith('Fafnir ')) return 'fafnir'
  if (name.startsWith('AbsoLab')) return 'absolab'
  if (name.startsWith('Arcane Umbra ')) return 'arcane'
  if (name.startsWith('Genesis ')) return 'genesis'
  if (name.startsWith('Destiny ')) return 'destiny'
  // Sealed Genesis has different properties from the liberated weapon.
  return null
}

// The bundled catalog is static. Index once instead of scanning unrelated slots
// for every picker render, saved item, and class compatibility check.
const catalogBySlot = new Map()
for (const item of catalog) {
  const slot = item.slot === 'overall' ? 'top' : item.slot
  if (!catalogBySlot.has(slot)) catalogBySlot.set(slot, [])
  catalogBySlot.get(slot).push(item)
}
// Sort the static source once; filtering preserves the picker order and each
// lookup still creates fresh objects so editing a selection cannot mutate it.
for (const items of catalogBySlot.values()) {
  items.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}
const familiesByClass = new Map()
for (const [family, classes] of Object.entries(CLASS_FAMILIES)) {
  for (const mapleClass of classes) {
    if (!familiesByClass.has(mapleClass)) familiesByClass.set(mapleClass, [])
    familiesByClass.get(mapleClass).push(family)
  }
}

export function equipmentChoices(slot, mapleClass) {
  if (slot === FIXED_RING_SLOT) return [fixedRing()]
  const type = slot.split('-')[0]
  const families = familiesByClass.get(mapleClass) ?? []
  if (!families.length) return []
  return (catalogBySlot.get(type) ?? []).filter(item =>
    (type !== 'secondary' || secondarySupportsJob(item, mapleClass))
    && (item.class.includes('All') || item.class.some(family => families.includes(family))))
    .flatMap(item => {
      let config = {
        equipment_type: 'armor',
        equipment_level: item.level,
        boss_equipment: item.boss_reward === true,
      }
      if (type === 'weapon') {
        const kind = WEAPON_PREFIXES[Math.floor(item.itemid / 1000)]
        const series = weaponSeries(item.name)
        if (!series || !CLASS_WEAPONS[mapleClass]?.includes(kind)) return []
        config = { ...getWeaponConfig(mapleClass, series, kind), equipment_type: 'weapon',
          equipment_level: item.level, weapon_series: series, weapon_kind: kind,
          boss_equipment: item.boss_reward === true }
      }
      return [{ id: item.itemid, name: item.name, slot: type, overall: item.slot === 'overall',
        icon: equipmentIconUrl(item.itemid),
        color: item.name.startsWith('Eternal') ? '#f1cd78' : '#a0e4b3', config,
        needsFlameType: false }]
    })
}

export function potentialEquipmentType(slot, item) {
  const type = slot.split('-')[0]
  if (type === 'top' && item.overall) return 'outfit'
  return POTENTIAL_EQUIPMENT_TYPES[type] ?? null
}

export function compatibleEquipment(equipment, mapleClass) {
  return Object.fromEntries(Object.entries(equipment).filter(([slot, item]) =>
    equipmentChoices(slot, mapleClass).some(choice => choice.id === item.id)))
}

export function equipInSlot(equipment, slot, item) {
  if (slot === FIXED_RING_SLOT) return withFixedRing(equipment)
  const next = { ...equipment, [slot]: item }
  if (slot === 'top' && item.overall) delete next.bottom
  if (slot === 'bottom' && next.top?.overall) delete next.top
  return next
}
