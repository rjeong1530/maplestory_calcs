import assert from 'node:assert/strict'
import test from 'node:test'
import { maxStarForceForEquipment, supportsStarForce } from './starforce.js'

test('medals, badges and non-Astra secondaries or shields have no Star Force controls', () => {
  for (const name of ['Crystal Ventus Badge', 'Ghost Ship Exorcist', 'Sengoku Hakase Badge']) {
    assert.equal(supportsStarForce({ slot: 'badge', name }), false)
  }
  assert.equal(supportsStarForce({ slot: 'medal', name: 'Astra Medal' }), false)
  for (const slot of ['secondary', 'shield']) {
    assert.equal(supportsStarForce({ slot, name: 'Deimos Shield' }), false)
    assert.equal(supportsStarForce({ slot, name: 'Astra Arcane Shield' }), true)
  }
  assert.equal(supportsStarForce({ slot: 'hat', name: 'Arcane Hat' }), true)
})

const item = (level, name = 'Equipment') => ({ name, config: { equipment_level: level } })

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
