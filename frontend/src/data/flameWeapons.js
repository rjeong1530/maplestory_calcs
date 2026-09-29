// Clean ATT (physical weapons) or MATT (magic weapons), before enhancements.
// Verified against MapleStory Wiki equipment-set tables on 2026-09-29:
// https://maplestorywiki.net/w/Root_Abyss_Set_(Warrior)
// https://maplestorywiki.net/w/AbsoLab_Set_(Warrior)
// https://maplestorywiki.net/w/Arcane_Umbra_Set_(Warrior)
// https://maplestorywiki.net/w/Eternal_Set_(Warrior)
// Each set also has Magician, Bowman, Thief and Pirate pages.
export const WEAPON_SERIES = {
  fafnir: { label: 'Fafnir', level: 150 },
  absolab: { label: 'Absolab', level: 160 },
  arcane: { label: 'Arcane', level: 200 },
  genesis: { label: 'Genesis', level: 200 },
  destiny: { label: 'Destiny', level: 250 },
}

const offense = (fafnir, absolab, arcane, genesis, destiny) => ({ fafnir, absolab, arcane, genesis, destiny })
const oneHanded = offense(164, 197, 283, 326, 358)
const twoHanded = offense(171, 205, 295, 340, 373)
const bow = offense(160, 192, 276, 318, 349)
const knuckle = offense(128, 154, 221, 255, 280)
const magic = offense(201, 241, 347, 400, 439)

export const WEAPON_KINDS = {
  two_handed_sword: { label: 'Two-handed sword', offense: twoHanded },
  two_handed_axe: { label: 'Two-handed axe', offense: twoHanded },
  two_handed_hammer: { label: 'Two-handed blunt weapon', offense: twoHanded },
  one_handed_sword: { label: 'One-handed sword', offense: oneHanded },
  one_handed_axe: { label: 'One-handed axe', offense: oneHanded },
  one_handed_hammer: { label: 'One-handed blunt weapon', offense: oneHanded },
  spear: { label: 'Spear', offense: twoHanded },
  polearm: { label: 'Polearm', offense: offense(153, 184, 264, 304, 334) },
  katana: { label: 'Katana', offense: oneHanded },
  bladecaster: { label: 'Bladecaster', offense: twoHanded },
  desperado: { label: 'Desperado', offense: twoHanded },
  arm_cannon: { label: 'Arm cannon', offense: knuckle },
  staff: { label: 'Staff', offense: offense(204, 245, 353, 406, 445) },
  wand: { label: 'Wand', offense: magic },
  shining_rod: { label: 'Shining rod', offense: magic },
  fan: { label: 'Fan', offense: offense(204, 241, 347, 400, 439) },
  psy_limiter: { label: 'Psy-limiter', offense: magic },
  lucent_gauntlet: { label: 'Lucent gauntlet', offense: magic },
  bow: { label: 'Bow', offense: bow },
  crossbow: { label: 'Crossbow', offense: oneHanded },
  ancient_bow: { label: 'Ancient bow', offense: bow },
  dual_bowguns: { label: 'Dual bowguns', offense: bow },
  whispershot: { label: 'Whispershot', offense: bow },
  claw: { label: 'Claw', offense: offense(86, 103, 149, 172, 189) },
  dagger: { label: 'Dagger', offense: bow },
  cane: { label: 'Cane', offense: oneHanded },
  whip_blade: { label: 'Whip blade', offense: knuckle },
  chain: { label: 'Chain', offense: bow },
  chakram: { label: 'Chakram', offense: bow },
  ritual_fan: { label: 'Ritual fan', offense: bow },
  knuckle: { label: 'Knuckle', offense: knuckle },
  gun: { label: 'Gun', offense: offense(125, 150, 216, 249, 273) },
  hand_cannon: { label: 'Hand cannon', offense: offense(175, 210, 302, 348, 382) },
  soul_shooter: { label: 'Soul shooter', offense: knuckle },
}

// First entry is the default; show alternatives when a class has a choice.
export const CLASS_WEAPONS = {
  Hero: ['two_handed_sword', 'two_handed_axe', 'one_handed_sword', 'one_handed_axe'],
  Paladin: ['two_handed_hammer', 'two_handed_sword', 'one_handed_hammer', 'one_handed_sword'],
  'Dark Knight': ['spear', 'polearm'],
  'Arch Mage (Fire/Poison)': ['staff', 'wand'],
  'Arch Mage (Ice/Lightning)': ['staff', 'wand'],
  Bishop: ['staff', 'wand'],
  Bowmaster: ['bow'],
  Marksman: ['crossbow'],
  Pathfinder: ['ancient_bow'],
  NightLord: ['claw'],
  Shadower: ['dagger'],
  'Dual Blade': ['dagger'],
  Buccaneer: ['knuckle'],
  Corsair: ['gun'],
  Cannoneer: ['hand_cannon'],
  'Dawn Warrior': ['two_handed_sword', 'one_handed_sword'],
  'Blaze Wizard': ['staff', 'wand'],
  'Wind Archer': ['bow'],
  'Night Walker': ['claw'],
  'Thunder Breaker': ['knuckle'],
  Mihile: ['one_handed_sword'],
  Aran: ['polearm'],
  Evan: ['staff', 'wand'],
  Mercedes: ['dual_bowguns'],
  Phantom: ['cane'],
  Luminous: ['shining_rod'],
  Shade: ['knuckle'],
  Blaster: ['arm_cannon'],
  'Battle Mage': ['staff'],
  'Wild Hunter': ['crossbow'],
  Mechanic: ['gun'],
  Xenon: ['whip_blade'],
  'Demon Slayer': ['one_handed_hammer', 'one_handed_axe'],
  'Demon Avenger': ['desperado'],
  Kaiser: ['two_handed_sword'],
  'Angelic Buster': ['soul_shooter'],
  Cadena: ['chain'],
  Kain: ['whispershot'],
  Adele: ['bladecaster'],
  Illium: ['lucent_gauntlet'],
  Ark: ['knuckle'],
  Khali: ['chakram'],
  Hoyoung: ['ritual_fan'],
  Lara: ['wand'],
  Kinesis: ['psy_limiter'],
  Hayato: ['katana'],
  Kanna: ['fan'],
}

export function getWeaponConfig(mapleClass, series, kind = CLASS_WEAPONS[mapleClass]?.[0]) {
  if (!CLASS_WEAPONS[mapleClass]?.includes(kind) || !Object.hasOwn(WEAPON_SERIES, series)) {
    throw new Error('Choose a valid class, weapon series and weapon kind.')
  }
  return {
    equipment_level: WEAPON_SERIES[series].level,
    boss_equipment: true,
    base_weapon_offense: WEAPON_KINDS[kind].offense[series],
  }
}
