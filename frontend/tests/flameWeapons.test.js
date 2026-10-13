import assert from 'node:assert/strict'
import { CLASS_STATS } from '../src/data/classStats.js'
import test from 'node:test'
import { CLASS_WEAPONS, WEAPON_SERIES, getWeaponConfig } from '../src/data/flameWeapons.js'

test('every class offered by the form has weapon data for all five series', () => {
  const classes = Object.keys(CLASS_STATS)
  assert.ok(classes.length > 40)
  assert.deepEqual(Object.keys(CLASS_WEAPONS).sort(), classes.sort())
  assert.deepEqual(Object.keys(WEAPON_SERIES), ['fafnir', 'absolab', 'arcane', 'genesis', 'destiny'])
  for (const mapleClass of classes) {
    for (const kind of CLASS_WEAPONS[mapleClass]) {
      for (const series of Object.keys(WEAPON_SERIES)) {
        const config = getWeaponConfig(mapleClass, series, kind)
        assert.ok(Number.isInteger(config.base_weapon_offense) && config.base_weapon_offense > 0)
        assert.equal(config.boss_equipment, true)
      }
    }
  }
})

test('weapon series supply the correct clean offense and item level', () => {
  const examples = [
    ['Hero', 'fafnir', 150, 171],
    ['Hero', 'absolab', 160, 205],
    ['Hero', 'arcane', 200, 295],
    ['Hero', 'genesis', 200, 340],
    ['Hero', 'destiny', 250, 373],
    ['NightLord', 'arcane', 200, 149],
    ['Bishop', 'destiny', 250, 445],
    ['Cannoneer', 'destiny', 250, 382],
    ['Aran', 'arcane', 200, 264],
    ['Kanna', 'fafnir', 150, 204],
    ['Kanna', 'absolab', 160, 241],
  ]
  for (const [mapleClass, series, level, attack] of examples) {
    assert.deepEqual(getWeaponConfig(mapleClass, series), {
      equipment_level: level, boss_equipment: true, base_weapon_offense: attack,
    })
  }
})

test('alternative weapons use their own base offense', () => {
  assert.equal(getWeaponConfig('Hero', 'arcane', 'one_handed_sword').base_weapon_offense, 283)
  assert.equal(getWeaponConfig('Bishop', 'arcane', 'wand').base_weapon_offense, 347)
  assert.equal(getWeaponConfig('Bishop', 'arcane', 'staff').base_weapon_offense, 353)
  assert.throws(() => getWeaponConfig('Bishop', 'arcane', 'two_handed_sword'))
  assert.throws(() => getWeaponConfig('Hero', 'unknown'))
})
