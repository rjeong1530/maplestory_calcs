import assert from 'node:assert/strict'
import test from 'node:test'
import { equipmentChoices, fixedRing, equipInSlot, compatibleEquipment } from './flameEquipment.js'
import { exportEquipment, importEquipment, serializeEquipment, restoreEquipment } from './equipmentSave.js'

const hat = equipmentChoices('hat', 'Hero').find(item => item.config.equipment_level === 200)

test('replacement costs persist and older Astra saves receive the default', () => {
  const secondary = equipmentChoices('secondary', 'Hero').find(item => item.name.startsWith('Astra '))
  for (const cost of [0, 750_000_000]) {
    const imported = importEquipment(exportEquipment({ secondary: { ...secondary, replacementCostMesos: cost } }, 'Hero'))
    assert.equal(imported.equipment.secondary.replacementCostMesos, cost)
  }
  const saved = JSON.parse(exportEquipment({ secondary, hat }, 'Hero'))
  delete saved.equipment.secondary.replacement_cost_mesos
  delete saved.equipment.hat.replacement_cost_mesos
  const old = importEquipment(JSON.stringify(saved)).equipment
  assert.equal(old.secondary.replacementCostMesos, 1_000_000_000)
  assert.equal(old.hat.replacementCostMesos, 0)
  for (const cost of [-1, 'Infinity', true, null]) {
    saved.equipment.secondary.replacement_cost_mesos = cost
    assert.throws(() => importEquipment(JSON.stringify(saved)))
  }
})

test('wrong-job secondaries are rejected on import and removed from saved equipment', () => {
  const secondary = equipmentChoices('secondary', 'Xenon')[0]
  const saved = serializeEquipment({ secondary })
  assert.deepEqual(restoreEquipment(saved, 'Phantom'), { 'ring-4': fixedRing() })
  assert.throws(() => importEquipment(exportEquipment({ secondary }, 'Phantom')), /unavailable/)
  assert.equal(importEquipment(exportEquipment({ secondary }, 'Xenon')).equipment.secondary.id, secondary.id)
})
const recordedHat = {
  ...hat, currentStarForce: 22, maxStarForce: 22, starForceModes: { 15: 3, 18: 4 },
  starForceSafeguards: { 15: true, 16: false, 17: true },
  currentPotential: [{ effect: 'STR_PCT', value: '12' }, { effect: '', value: '' }],
  currentFlames: [{ option: 'STR', stage: 6 }, { option: 'ALL_STAT_PCT', stage: '5' }],
  currentFlameType: 'black', currentBossEquipment: true,
}

test('equipment export/import preserves class, items and recorded rolls', () => {
  const ring = equipmentChoices('ring-1', 'Hero')[0]
  const equipment = { hat: recordedHat, 'ring-1': { ...ring, currentStarForce: 0 },
    'ring-2': { ...ring, currentStarForce: 0 } }
  const restored = importEquipment(exportEquipment(equipment, 'Hero'))
  assert.equal(restored.equipmentClass, 'Hero')
  assert.deepEqual(serializeEquipment(restored.equipment), serializeEquipment(equipment))
  assert.equal(restored.equipment.hat.config.equipment_level, 200)
})

test('empty equipment exports and UTF-8 BOM imports are supported', () => {
  assert.deepEqual(importEquipment('\uFEFF' + exportEquipment({}, 'Bishop')),
    { equipmentClass: 'Bishop', equipment: { 'ring-4': fixedRing() } })
})

test('malformed imports and invalid rolls are rejected before returning equipment', () => {
  for (const text of ['{', 'null', '[]', '{}']) assert.throws(() => importEquipment(text))
  const cases = [
    saved => { saved.version = 2 },
    saved => { saved.equipment_class = 'Unknown' },
    saved => { saved.equipment = [] },
    saved => { saved.equipment.unknown = saved.equipment.hat },
    saved => { saved.equipment.hat.id = -1 },
    saved => { saved.equipment.hat.current_star_force = 31 },
    saved => { saved.equipment.hat.current_star_force = -1 },
    saved => { saved.equipment.hat.max_star_force = 31 },
    saved => { saved.equipment.hat.max_star_force = -1 },
    saved => { saved.equipment.hat.max_star_force = 17.5 },
    saved => { saved.equipment.hat.mode_by_star = { 15: 4 } },
    saved => { saved.equipment.hat.mode_by_star = { 22: 2 } },
    saved => { saved.equipment.hat.safeguard_by_star = { 18: true } },
    saved => { saved.equipment.hat.safeguard_by_star = { 15: 'true' } },
    saved => { saved.equipment.hat.current_potential = [null] },
    saved => { saved.equipment.hat.current_potential[0].value = {} },
    saved => { saved.equipment.hat.current_flames[0].stage = 8 },
    saved => { saved.equipment.hat.current_boss_equipment = 'true' },
    saved => { saved.equipment.hat.current_flame_type = 'unknown' },
  ]
  for (const mutate of cases) {
    const saved = JSON.parse(exportEquipment({ hat: recordedHat }, 'Hero'))
    mutate(saved)
    assert.throws(() => importEquipment(JSON.stringify(saved)))
  }
})

test('imports rebuild catalog fields instead of trusting file metadata', () => {
  const saved = JSON.parse(exportEquipment({ hat: recordedHat }, 'Hero'))
  saved.equipment.hat.name = 'Wrong name'
  saved.equipment.hat.config = { equipment_level: 1 }
  saved.equipment.hat.icon = 'https://example.com/untrusted'
  const { equipment } = importEquipment(JSON.stringify(saved))
  assert.equal(equipment.hat.name, hat.name)
  assert.deepEqual(equipment.hat.config, hat.config)
  assert.equal(equipment.hat.icon, hat.icon)
})

test('imports reject class-incompatible weapons and conflicting overall/bottom slots', () => {
  const weapon = equipmentChoices('weapon', 'Hero')[0]
  assert.throws(() => importEquipment(exportEquipment({ weapon }, 'Bishop')), /unavailable/)
  const top = equipmentChoices('top', 'Hero').find(item => item.overall)
  const bottom = equipmentChoices('bottom', 'Hero')[0]
  for (const equipment of [{ top, bottom }, { bottom, top }]) {
    assert.throws(() => importEquipment(exportEquipment(equipment, 'Hero')))
  }
})

test('ring four is fixed across defaults, saved data, imports and class changes', () => {
  const initial = restoreEquipment(undefined, 'Hero')
  assert.deepEqual(initial, { 'ring-4': fixedRing() })
  assert.deepEqual(serializeEquipment(initial), {})
  assert.deepEqual(JSON.parse(exportEquipment(initial, 'Hero')).equipment, {})
  const ring = equipmentChoices('ring-1', 'Hero')[0]
  assert.deepEqual(equipInSlot(initial, 'ring-4', ring), initial)
  assert.deepEqual(compatibleEquipment(initial, 'Bishop'), initial)
  assert.deepEqual(equipmentChoices('ring-4', 'Hero'), [fixedRing()])
  const exported = JSON.parse(exportEquipment({ 'ring-1': ring }, 'Hero'))
  assert.equal(Object.hasOwn(exported.equipment, 'ring-4'), false)
  for (const saved of [undefined, null, { id: ring.id, current_star_force: 22 },
    { id: 1113098, current_star_force: 30, current_potential: [{ effect: 'STR_PCT', value: 99 }] }]) {
    exported.equipment['ring-4'] = saved
    const imported = importEquipment(JSON.stringify(exported)).equipment
    assert.deepEqual(imported['ring-4'], fixedRing())
    assert.equal(imported['ring-1'].id, ring.id)
    assert.deepEqual(restoreEquipment(exported.equipment, 'Hero')['ring-4'], fixedRing())
  }
})
