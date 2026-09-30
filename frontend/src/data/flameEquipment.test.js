import assert from 'node:assert/strict'
import test from 'node:test'
import {
  equipmentChoices, equipInSlot, compatibleEquipment, CLASS_FAMILIES,
  potentialEquipmentType,
} from './flameEquipment.js'
import { CLASS_WEAPONS } from './flameWeapons.js'
import catalog from './equipment_140_250.json' with { type: 'json' }

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
  assert.ok(equipmentChoices('shoulder', 'Hero').length > 0)
  assert.deepEqual(equipmentChoices('pendant-2', 'Hero'), equipmentChoices('pendant-1', 'Bishop'))
  assert.ok(equipmentChoices('pendant-2', 'Hero').every(item => !item.needsFlameType))
  assert.ok(hats.every(item => catalog.some(row => row.itemid === item.id && row.name === item.name)))
  assert.ok(catalog.every(item => typeof item.boss_reward === 'boolean'))
  assert.ok(hats.every(item => item.config.boss_equipment ===
    catalog.find(row => row.itemid === item.id).boss_reward))
  assert.equal(hats.find(item => item.name === 'AbsoLab Knight Helm').config.boss_equipment, true)
  assert.equal(hats.find(item => item.name === 'Chaos Pierre Hat').config.boss_equipment, false)
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
})
