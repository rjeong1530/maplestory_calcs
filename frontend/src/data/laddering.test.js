import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_LADDERING, DEFAULT_TRANSFER, secondCopyItem, updateSecondCopy, validLaddering } from './laddering.js'
import { equipmentChoices } from './flameEquipment.js'
import { exportEquipment, importEquipment, restoreEquipment } from './equipmentSave.js'
import { buildUpgradeRequest, restoreUpgradeSettings } from './equipmentUpgrade.js'
import { CLASS_STATS } from './classStats.js'

const hat = equipmentChoices('hat', 'Hero').find(item => item.config.equipment_level === 200)

test('Astra secondaries discard legacy laddering and never send it to the API', () => {
  const astra = equipmentChoices('secondary', 'Hero').find(item => item.name.startsWith('Astra '))
  assert.ok(astra)
  const equipped = { ...astra, currentStarForce: 17, laddering: { ...DEFAULT_LADDERING } }
  const payload = buildUpgradeRequest({ secondary: equipped }, CLASS_STATS.Hero, {}, restoreUpgradeSettings())
  assert.equal(payload.laddering_enabled, false)
  assert.equal(payload.equipment[0].laddering, undefined)
  const saved = JSON.parse(exportEquipment({ secondary: equipped }, 'Hero'))
  assert.equal(saved.equipment.secondary.laddering, undefined)
  saved.equipment.secondary.laddering = { ...DEFAULT_LADDERING }
  for (const restored of [restoreEquipment(saved.equipment, 'Hero'), importEquipment(JSON.stringify(saved)).equipment]) {
    assert.equal(restored.secondary.laddering, undefined)
    assert.equal(restored.secondary.currentStarForce, 17)
  }
})

test('Gollux transfer settings survive save/import and API serialization only on SoS', () => {
  const sos = equipmentChoices('pendant-1', 'Hero').find(item => item.name === 'Source of Suffering')
  const settings = { ...DEFAULT_LADDERING, transfer: { ...DEFAULT_TRANSFER, donor_star: 26, tier_up_cost_mesos: 1e9 } }
  const restored = importEquipment(exportEquipment({ 'pendant-1': { ...sos, laddering: settings } }, 'Hero')).equipment
  assert.deepEqual(restored['pendant-1'].laddering.transfer, settings.transfer)
  const payload = buildUpgradeRequest(restored, CLASS_STATS.Hero, {}, restoreUpgradeSettings())
  assert.deepEqual(payload.equipment.find(item => item.slot === 'pendant-1').laddering.transfer, settings.transfer)
  assert.throws(() => importEquipment(exportEquipment({ hat: { ...hat, laddering: settings } }, 'Hero')), /Invalid equipment/)
  assert.equal(validLaddering({ ...settings, transfer: { ...settings.transfer, donor_star: 27 } }), false)
  assert.equal(validLaddering({ ...settings, transfer: { ...settings.transfer, tier_up_cost_mesos: -1 } }), false)
})

test('second copy is independently edited, persisted, exported and sent to the planner', () => {
  const equipped = { ...hat, currentStarForce: 21, currentPotential: [{ effect: 'STR_PCT', value: 12 }],
    laddering: { ...DEFAULT_LADDERING, minimum_flame_score: 100, minimum_potential_score: 180 } }
  equipped.laddering = updateSecondCopy(equipped.laddering, { currentStarForce: 17,
    currentPotential: [{ effect: 'STR_PCT', value: '9' }, { effect: 'STR_PCT', value: '' }],
    currentFlames: [{ option: 'STR', stage: 5 }] })
  assert.equal(secondCopyItem(equipped).currentStarForce, 17)
  assert.equal(equipped.currentStarForce, 21)
  assert.equal(equipped.currentPotential[0].value, 12)
  const restored = importEquipment(exportEquipment({ hat: equipped }, 'Hero')).equipment.hat
  assert.deepEqual(restored.laddering, equipped.laddering)
  const settings = restoreUpgradeSettings({ laddering_enabled: false })
  const payload = buildUpgradeRequest({ hat: restored }, CLASS_STATS.Hero, {}, settings)
  assert.equal(payload.laddering_enabled, true)
  assert.equal(payload.equipment[0].laddering.minimum_flame_score, 0)
  assert.equal(payload.equipment[0].laddering.minimum_potential_score, 0)
  assert.deepEqual(payload.equipment[0].laddering.second_copy, {
    current_star_force: 17, current_potential: [{ effect: 'STR_PCT', value: 9 }],
    current_flames: [{ option: 'STR', stage: 5 }],
  })
})

test('unrecorded copy stays distinct from recorded zero stats and old saves stay standard', () => {
  assert.equal(restoreUpgradeSettings().laddering_enabled, false)
  const item = { ...hat, laddering: { ...DEFAULT_LADDERING } }
  assert.equal(importEquipment(exportEquipment({ hat: item }, 'Hero')).equipment.hat.laddering.second_copy, null)
  const recorded = updateSecondCopy(item.laddering, { currentStarForce: 0 })
  assert.notEqual(recorded.second_copy, null)
  assert.equal(importEquipment(exportEquipment({ hat }, 'Hero')).equipment.hat.laddering, undefined)
})

test('invalid laddering saves are rejected on import and ignored on browser restore', () => {
  for (const settings of [{ ...DEFAULT_LADDERING, start_star: 31 }, { ...DEFAULT_LADDERING, minimum_flame_score: -1 },
    { ...DEFAULT_LADDERING, minimum_potential_score: true }, { ...DEFAULT_LADDERING, second_copy: { current_star_force: 31 } }]) {
    assert.equal(validLaddering(settings), false)
    const saved = JSON.parse(exportEquipment({ hat }, 'Hero'))
    saved.equipment.hat.laddering = settings
    assert.throws(() => importEquipment(JSON.stringify(saved)), /Invalid equipment/)
    assert.equal(restoreEquipment(saved.equipment, 'Hero').hat.laddering, undefined)
  }
})
