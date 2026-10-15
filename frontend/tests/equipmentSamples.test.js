import assert from 'node:assert/strict'
import test from 'node:test'
import { readSamples, sampleEquipment } from '../scripts/equipment-samples.mjs'
import { CLASS_STATS } from '../src/data/classStats.js'
import { exportEquipment, importEquipment, restoreEquipment, serializeEquipment } from '../src/data/equipmentSave.js'
import { buildUpgradeRequest, DEFAULT_FLAME_WEIGHTS, restoreUpgradeSettings, restoreFlameWeights } from '../src/data/equipmentUpgrade.js'

test('JSON samples cover every class and survive import, browser restoration and API serialization', () => {
  const samples = readSamples()
  assert.deepEqual(samples.map(({ text }) => JSON.parse(text).equipment_class).sort(), Object.keys(CLASS_STATS).sort())
  for (const { name, text } of samples) {
    const { equipment, equipmentClass } = importEquipment(text)
    assert.deepEqual(JSON.parse(text), JSON.parse(exportEquipment(sampleEquipment(equipmentClass), equipmentClass)), name)
    const saved = serializeEquipment(equipment)
    assert.deepEqual(serializeEquipment(restoreEquipment(saved, equipmentClass)), saved, name)
    assert.deepEqual(JSON.parse(exportEquipment(equipment, equipmentClass)), JSON.parse(text), name)
    const request = buildUpgradeRequest(equipment, CLASS_STATS[equipmentClass], DEFAULT_FLAME_WEIGHTS, restoreUpgradeSettings())
    assert.equal(request.equipment.length, 8, name)
    assert.deepEqual(JSON.parse(JSON.stringify(request)), request, name)
  }
})

test('invalid imported rolls are rejected and malformed browser rolls are discarded without crashing', () => {
  const saved = JSON.parse(exportEquipment(sampleEquipment('Hero'), 'Hero'))
  for (const line of [null, [], { effect: 'UNKNOWN', value: 12 }, { effect: 'STR_PCT', value: -12 },
    { effect: 'STR_PCT', value: true }, { effect: 'STR_PCT', value: 'Infinity' }]) {
    const corrupt = structuredClone(saved)
    corrupt.equipment.hat.current_potential = [line]
    assert.throws(() => importEquipment(JSON.stringify(corrupt)))
    const restored = restoreEquipment(corrupt.equipment, 'Hero')
    assert.deepEqual(restored.hat.currentPotential, [])
    assert.doesNotThrow(() => buildUpgradeRequest(restored, CLASS_STATS.Hero, DEFAULT_FLAME_WEIGHTS, restoreUpgradeSettings()))
  }
  saved.equipment.hat.current_flames = [{ option: 'STR', stage: 4 }, { option: 'STR', stage: 5 }]
  assert.throws(() => importEquipment(JSON.stringify(saved)))
  assert.deepEqual(restoreEquipment(saved.equipment, 'Hero').hat.currentFlames, [{ option: 'STR', stage: 4 }])
  assert.equal(restoreEquipment({ 'hat-invalid': saved.equipment.hat }, 'Hero')['hat-invalid'], undefined)
})

test('restored score settings reject negative, boolean, whitespace and structured values', () => {
  for (const value of [-1, true, false, ' ', [], {}, 'Infinity']) {
    assert.deepEqual(restoreFlameWeights(Object.fromEntries(Object.keys(DEFAULT_FLAME_WEIGHTS).map(key => [key, value]))), DEFAULT_FLAME_WEIGHTS)
    assert.equal(restoreUpgradeSettings({ base_stat_pct_value: value }).base_stat_pct_value, '10')
  }
  assert.equal(restoreFlameWeights({ attack_value: 0 }).attack_value, '0')
  assert.equal(restoreUpgradeSettings({ shining_starforce_sunday: false }).shining_starforce_sunday, false)
  assert.equal(restoreUpgradeSettings({ shining_starforce_sunday: 'false' }).shining_starforce_sunday, true)
})
