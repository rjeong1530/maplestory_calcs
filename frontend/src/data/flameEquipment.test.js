import assert from 'node:assert/strict'
import test from 'node:test'
import {
  equipmentChoices, equipInSlot, compatibleEquipment, CLASS_FAMILIES, FLAME_SLOTS,
  potentialEquipmentType,
} from './flameEquipment.js'
import { CLASS_WEAPONS } from './flameWeapons.js'
import { SECONDARY_JOBS } from './secondaryEquipment.js'
import catalog from './equipment_140_250.json' with { type: 'json' }

test('catalog excludes unwanted series and limits pocket choices to cup and spellbooks', () => {
  assert.ok(!catalog.some(item => /^(Red Beryl|Frontier|Commerci)/.test(item.name)))
  assert.ok(!catalog.some(item => item.name === "Bounty Legend's Sunglasses"))
  assert.deepEqual(equipmentChoices('earring', 'Hero').map(item => item.name).sort(),
    ['Commanding Force Earring', 'Estella Earrings', 'Superior Gollux Earrings'].sort())
  assert.deepEqual(equipmentChoices('pocket', 'Hero').map(item => item.name).sort(),
    ['Pink Holy Cup', 'Cursed Red Spellbook', 'Cursed Blue Spellbook',
      'Cursed Green Spellbook', 'Cursed Yellow Spellbook'].sort())
  assert.ok(equipmentChoices('face', 'Hero').some(item => item.name === 'Sweetwater Tattoo'))
})

test('heart choices include only the five selected hearts and Mitra emblems follow class families', () => {
  assert.deepEqual(equipmentChoices('heart', 'Hero').map(item => item.name).sort(),
    ['Fairy Heart', 'Titanium Heart', 'Plasma Heart', 'Outlaw Heart', 'Total Control'].sort())
  for (const [job, family] of [['Hero', 'Warrior'], ['Bishop', 'Magician'], ['Bowmaster', 'Bowman'],
    ['NightLord', 'Thief'], ['Buccaneer', 'Pirate']]) {
    assert.deepEqual(equipmentChoices('emblem', job).filter(item => item.name.startsWith("Mitra's Rage:"))
      .map(item => item.name), [`Mitra's Rage: ${family}`])
  }
})

test('picker results stay sorted and independent across repeated lookups', () => {
  const original = equipmentChoices('top', 'Hero')
  assert.ok(original.some(item => item.overall))
  assert.ok(original.some(item => !item.overall))
  for (let index = 1; index < original.length; index++) {
    const previous = original[index - 1]
    const current = original[index]
    assert.ok(previous.config.equipment_level < current.config.equipment_level ||
      (previous.config.equipment_level === current.config.equipment_level &&
        previous.name.localeCompare(current.name) <= 0))
  }
  const changed = equipmentChoices('top', 'Hero')
  changed[0].config.equipment_level = 999
  changed.reverse()
  assert.deepEqual(equipmentChoices('top', 'Hero'), original)
  assert.deepEqual(equipmentChoices('unknown', 'Hero'), [])
  assert.deepEqual(equipmentChoices('hat', 'unknown'), [])
  assert.deepEqual(equipmentChoices('ring-1', 'Hero'), equipmentChoices('ring-3', 'Hero'))
})

test('every catalog secondary has explicit job restrictions', () => {
  for (const item of catalog.filter(item => item.slot === 'secondary')) {
    assert.ok(SECONDARY_JOBS[item.itemid]?.length, item.name)
  }
})

test('all supported jobs retain Astra and eligible level-100 secondaries', () => {
  for (const job of Object.keys(CLASS_WEAPONS)) {
    const choices = equipmentChoices('secondary', job)
    assert.ok(choices.some(item => item.name.startsWith('Astra ')), `${job}: Astra`)
    if (job !== 'Dual Blade') {
      assert.ok(choices.some(item => item.config.equipment_level === 100), `${job}: level 100`)
    }
    assert.ok(choices.every(item => SECONDARY_JOBS[item.id].includes(job)), job)
  }
  const xenon = equipmentChoices('secondary', 'Xenon')
  assert.ok(xenon.some(item => item.name === 'Octa Core Controller'))
  assert.ok(xenon.some(item => item.name === 'Astra Deca Core Controller'))
  assert.ok(!equipmentChoices('secondary', 'Phantom').some(item => /Controller/.test(item.name)))
  assert.ok(equipmentChoices('secondary', 'Dual Blade').some(item => item.name === 'Astra Katara'))
})

test('catalog retains only requested katara and ordinary shield series', () => {
  assert.deepEqual(equipmentChoices('secondary', 'Dual Blade').map(item => item.name).sort(), [
    'Fafnir Rapid Edge', 'AbsoLab Katara', 'Sweetwater Katara', 'Arcane Umbra Katara', 'Astra Katara',
  ].sort())
  const shields = catalog.filter(item => Math.floor(item.itemid / 1000) === 1092)
  assert.ok(shields.some(item => item.name === 'Deimos Warrior Shield'))
  assert.ok(shields.some(item => item.name === 'Terminus Defender'))
  assert.ok(shields.some(item => item.name === 'Astra Sacred Aegis'))
  assert.ok(shields.every(item => /^(Astra|Deimos|Terminus) /.test(item.name)))
})

test('secondaries distinguish jobs within the same family', () => {
  const originalIds = new Set([1353006, 1342082, 1342101, 1342104, 1352296, 1352109, 1092126, 1352256, 1352236, 1352246, 1352226, 1098006, 1098012, 1099011, 1099023, 1092138, 1352945, 1092141, 1352957])
  const ids = job => equipmentChoices('secondary', job).map(item => item.id).filter(id => originalIds.has(id)).sort()
  assert.deepEqual(ids('Xenon'), [1353006])
  assert.deepEqual(ids('Dual Blade'), [1342082, 1342101, 1342104])
  assert.deepEqual(ids('NightLord'), [1352296])
  assert.deepEqual(ids('Phantom'), [1352109])
  assert.deepEqual(ids('Bishop'), [1092126, 1352256])
  assert.deepEqual(ids('Arch Mage (Fire/Poison)'), [1092126, 1352236])
  assert.deepEqual(ids('Arch Mage (Ice/Lightning)'), [1092126, 1352246])
  assert.deepEqual(ids('Dark Knight'), [1352226])
  assert.deepEqual(ids('Mihile'), [1098006, 1098012])
  assert.deepEqual(ids('Demon Slayer'), [1099011, 1099023])
  assert.deepEqual(ids('Demon Avenger'), ids('Demon Slayer'))
  assert.deepEqual(ids('Evan'), [1092138, 1352945])
  assert.deepEqual(ids('Battle Mage'), [1092141, 1352957])
})

test('Cygnus jewel is limited to the five Cygnus jobs despite its All family', () => {
  const jobs = ['Dawn Warrior', 'Blaze Wizard', 'Wind Archer', 'Night Walker', 'Thunder Breaker']
  for (const job of Object.keys(CLASS_WEAPONS)) {
    assert.equal(equipmentChoices('secondary', job).some(item => item.id === 1352975), jobs.includes(job), job)
  }
})

test('class changes remove another jobs secondary but preserve shared secondaries', () => {
  const secondary = equipmentChoices('secondary', 'Xenon')[0]
  assert.deepEqual(compatibleEquipment({ secondary }, 'Phantom'), {})
  const shield = equipmentChoices('secondary', 'Bishop').find(item => item.id === 1092126)
  assert.deepEqual(compatibleEquipment({ secondary: shield }, 'Arch Mage (Fire/Poison)'), { secondary: shield })
})

test('weapon picker filters by class and supplies calculator settings', () => {
  const weapons = equipmentChoices('weapon', 'Bishop')
  assert.ok(weapons.length >= 10)
  assert.ok(weapons.every(item => ['staff', 'wand'].includes(item.config.weapon_kind)))
  const staff = weapons.find(item => item.name === 'Arcane Umbra Staff')
  assert.equal(staff.config.base_weapon_offense, 353)
  assert.equal(staff.config.equipment_level, 200)
  assert.equal(staff.config.equipment_type, 'weapon')
})

test('real armor and accessories are filtered by slot and class', () => {
  const hats = equipmentChoices('hat', 'Hero')
  assert.ok(hats.some(item => item.name === 'Royal Warrior Helm'))
  assert.ok(hats.some(item => item.name === 'Eternal Knight Helm'))
  assert.ok(!hats.some(item => item.name === 'Royal Dunwitch Hat'))
  assert.ok(equipmentChoices('ring-1', 'Hero').length > 0)
  assert.ok(equipmentChoices('emblem', 'Hero').length > 0)
  assert.ok(equipmentChoices('medal', 'Hero').length > 0)
  assert.ok(FLAME_SLOTS.has('medal'))
  assert.ok(equipmentChoices('medal', 'Hero').every(item =>
    item.config.equipment_type === 'armor' && !item.needsFlameType))
  assert.ok(equipmentChoices('shoulder', 'Hero').length > 0)
  assert.deepEqual(equipmentChoices('pendant-2', 'Hero'), equipmentChoices('pendant-1', 'Bishop'))
  assert.ok(equipmentChoices('pendant-2', 'Hero').every(item => !item.needsFlameType))
  assert.ok(hats.every(item => catalog.some(row => row.itemid === item.id && row.name === item.name)))
  assert.ok(catalog.every(item => typeof item.boss_reward === 'boolean'))
  assert.ok(hats.every(item => item.config.boss_equipment ===
    catalog.find(row => row.itemid === item.id).boss_reward))
  assert.equal(hats.find(item => item.name === 'AbsoLab Knight Helm').config.boss_equipment, true)
  assert.equal(hats.find(item => item.name === "Chaos Vellum's Helm").config.boss_equipment, false)
  for (const name of ['Chaos Pierre Hat', 'Chaos Von Bon Helmet', "Chaos Queen's Tiara"]) {
    assert.ok(!catalog.some(item => item.name === name))
  }
})

test('all supported classes have families and matching catalog weapons', () => {
  for (const mapleClass of Object.keys(CLASS_WEAPONS)) {
    assert.ok(Object.values(CLASS_FAMILIES).some(classes => classes.includes(mapleClass)), mapleClass)
    assert.ok(equipmentChoices('weapon', mapleClass).length > 0, mapleClass)
  }
})

test('weapon IDs disambiguate inaccurate source categories', () => {
  const khali = equipmentChoices('weapon', 'Khali')
  assert.ok(khali.some(item => item.name === 'Genesis Eclipse'))
  assert.ok(khali.every(item => item.config.weapon_kind === 'chakram'))
  assert.ok(!equipmentChoices('weapon', 'Hero').some(item => /Eclipse|Chakram|Martial Brace/.test(item.name)))
  assert.ok(!equipmentChoices('weapon', 'Dark Knight').some(item => item.name.endsWith(' Gram')))
})

test('class changes clear incompatible armor and preserve shared equipment', () => {
  const hat = equipmentChoices('hat', 'Hero').find(item => item.name === 'Royal Warrior Helm')
  const pendant = equipmentChoices('pendant-1', 'Hero')[0]
  assert.deepEqual(compatibleEquipment({ hat, 'pendant-1': pendant }, 'Bishop'), { 'pendant-1': pendant })
  const xenon = equipmentChoices('hat', 'Xenon')
  assert.ok(xenon.some(item => item.name === 'Royal Assassin Hood'))
  assert.ok(xenon.some(item => item.name === 'Royal Wanderer Hat'))
})

test('equipping an overall and bottom are mutually exclusive without changing other slots', () => {
  const overall = equipmentChoices('top', 'Hero').find(item => item.overall)
  const bottom = equipmentChoices('bottom', 'Hero')[0]
  const original = { bottom, 'pendant-1': { id: 'pendant' } }
  const withOverall = equipInSlot(original, 'top', overall)
  assert.equal(withOverall.bottom, undefined)
  assert.equal(original.bottom, bottom)
  const withBottom = equipInSlot(withOverall, 'bottom', bottom)
  assert.equal(withBottom.top, undefined)
  assert.equal(withBottom['pendant-1'].id, 'pendant')
})

test('equipment slots map to their potential tables', () => {
  assert.equal(potentialEquipmentType('weapon', {}), 'weapon')
  assert.equal(potentialEquipmentType('ring-1', {}), 'accessory')
  assert.equal(potentialEquipmentType('secondary', {}), 'secondary weapon')
  assert.equal(potentialEquipmentType('top', { overall: true }), 'outfit')
  assert.equal(potentialEquipmentType('medal', {}), null)
  assert.equal(potentialEquipmentType('pocket', {}), null)
})
