import assert from 'node:assert/strict'
import test from 'node:test'
import { equipmentGroup, applyStrategyToEquipment } from './equipmentGroups.js'
import { equipmentChoices, fixedRing } from './flameEquipment.js'

test('Brilliant catalog items are grouped separately from Pitched', () => {
  for (const [slot, name] of [['ring-1', 'Whisper of the Source'], ['ring-2', 'Blissful Nightmare'],
    ['pendant-1', 'Oath of Death'], ['face', 'Original Sin of Pride']]) {
    const item = equipmentChoices(slot, 'Hero').find(item => item.name === name)
    assert.ok(item, `${name} must be available in the catalog`)
    assert.equal(equipmentGroup(item, slot), 'brilliant')
  }
})

test('Eternal groups use the requested slots, not names of unrelated secondaries', () => {
  for (const slot of ['hat', 'top', 'bottom', 'shoulder', 'cape', 'gloves', 'shoes']) {
    const item = equipmentChoices(slot, 'Hero').find(item => item.name.startsWith('Eternal '))
    assert.equal(equipmentGroup(item, slot), ['hat', 'top', 'bottom', 'shoulder'].includes(slot) ? 'kalos' : 'limbo')
  }
  assert.equal(equipmentGroup({ name: 'Eternal Magnum', slot: 'secondary' }), 'other')
  assert.equal(equipmentGroup({ name: 'Berserked', slot: 'face' }), 'pitched')
  assert.equal(equipmentGroup({ name: "Mitra's Rage: Warrior", slot: 'emblem' }), 'pitched')
})

test('bulk copying preserves stats, resets missing modes, and excludes ineligible equipment', () => {
  const hat = { ...equipmentChoices('hat', 'Hero')[0], currentStarForce: 17, minimumCooldownSeconds: 4,
    currentPotential: [{ effect: 'COOLDOWN_SEC', value: -2 }], replacementCostMesos: 50,
    starForceModes: { 18: 4 }, starForceSafeguards: { 16: true } }
  const equipment = { hat, gloves: equipmentChoices('gloves', 'Hero')[0], 'ring-4': fixedRing(),
    emblem: equipmentChoices('emblem', 'Hero')[0] }
  const result = applyStrategyToEquipment(equipment, ['hat', 'emblem', 'ring-4'], {
    mode_by_star: { 15: 3, 18: 2 }, safeguard_by_star: { 15: true },
  })
  assert.equal(result.hat.starForceModes[15], 1)
  assert.equal(result.hat.starForceModes[18], 2)
  assert.equal(result.hat.starForceModes[19], 1)
  assert.equal(result.hat.starForceSafeguards[16], false)
  for (const key of ['currentStarForce', 'minimumCooldownSeconds', 'currentPotential', 'replacementCostMesos']) {
    assert.deepEqual(result.hat[key], hat[key])
  }
  assert.equal(result.gloves, equipment.gloves)
  assert.equal(result.emblem, equipment.emblem)
  assert.equal(result['ring-4'], equipment['ring-4'])
  assert.equal(hat.starForceModes[18], 4)
})
