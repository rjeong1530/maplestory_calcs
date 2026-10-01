import assert from 'node:assert/strict'
import test from 'node:test'
import { maxStarForceForEquipment } from './starforce.js'

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
