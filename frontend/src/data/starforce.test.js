import assert from 'node:assert/strict'
import test from 'node:test'
import { maxStarForceForEquipment, supportsStarForce } from './starforce.js'
import { equipmentChoices } from './flameEquipment.js'

test('medals,emblems, badges and unsupported secondaries or shields have no Star Force controls', () => {
  for (const name of ['Crystal Ventus Badge', 'Ghost Ship Exorcist', 'Sengoku Hakase Badge']) {
    assert.equal(supportsStarForce({ slot: 'badge', name }), false)
  }
  assert.equal(supportsStarForce({ slot: 'medal', name: 'Astra Medal' }), false)
  for (const pocket of equipmentChoices('pocket', 'Hero')) {
    assert.equal(supportsStarForce(pocket), false, pocket.name)
  }
  for (const emblem of equipmentChoices('emblem', 'Hero')) {
    assert.equal(supportsStarForce(emblem), false, emblem.name)
  }
  for (const slot of ['secondary', 'shield']) {
    assert.equal(supportsStarForce({ slot, name: 'Maple Treasure Shield' }), false)
    assert.equal(supportsStarForce({ slot, name: 'Astra Arcane Shield' }), true)
  }
  assert.equal(supportsStarForce({ slot: 'hat', name: 'Arcane Hat' }), true)
})

const item = (level, name = 'Equipment') => ({ name, config: { equipment_level: level } })

test('all Deimos shields support Star Force up to their level-130 cap', () => {
  for (const name of ['Deimos Warrior Shield', 'Deimos Shadow Shield', 'Deimos Sage Shield']) {
    for (const slot of ['secondary', 'shield']) {
      const shield = { ...item(130, name), slot }
      assert.equal(supportsStarForce(shield), true)
      assert.equal(maxStarForceForEquipment(shield), 20)
    }
  }
})

test('all Kanna secondary talismans support Star Force with their level caps', () => {
  const talismans = equipmentChoices('secondary', 'Kanna')
  assert.equal(talismans.length, 8)
  for (const talisman of talismans) {
    assert.equal(supportsStarForce(talisman, 'secondary'), true, talisman.name)
    assert.equal(maxStarForceForEquipment(talisman),
      talisman.config.equipment_level === 100 ? 8 : 30, talisman.name)
  }
})

test('maximum Star Force follows equipment-level thresholds', () => {
  for (const [level, maximum] of [
    [0, 5], [94, 5], [95, 8], [107, 8], [108, 10], [117, 10],
    [118, 15], [127, 15], [128, 20], [137, 20], [138, 30], [250, 30],
  ]) {
    assert.equal(maxStarForceForEquipment(item(level)), maximum, `level ${level}`)
  }
})

test('known item exceptions override the general level cap', () => {
  assert.equal(maxStarForceForEquipment(item(150, 'Superior Engraved Gollux Belt')), 30)
  assert.equal(maxStarForceForEquipment(item(150, 'Tyrant Belt')), 15)
  assert.equal(maxStarForceForEquipment(item(160, 'Sweetwater Cape')), 15)
  assert.equal(maxStarForceForEquipment(item(150, 'Ghost Ship Exorcist')), 22)
  assert.equal(maxStarForceForEquipment(item(160, 'Sengoku Hakase Badge')), 22)
  assert.equal(maxStarForceForEquipment(item(160, 'Sweetwater Earring')), 30)
})
