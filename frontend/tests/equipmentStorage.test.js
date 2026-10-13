import assert from 'node:assert/strict'
import test from 'node:test'
import { EQUIPMENT_STORAGE_KEY, readEquipmentSelection, saveEquipmentSelection } from '../src/data/equipmentStorage.js'
import { EQUIPMENT_SLOTS, equipmentChoices } from '../src/data/flameEquipment.js'
import { serializeEquipment, restoreEquipment } from '../src/data/equipmentSave.js'

function browser() {
  const values = new Map()
  return { document: { cookie: '' }, localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } }
}

test('full equipment sets larger than a cookie survive storage and restoration', () => {
  const equipment = Object.fromEntries(EQUIPMENT_SLOTS.filter(Boolean).flatMap(slot => {
    const item = equipmentChoices(slot, 'Hero')[0]
    return item ? [[slot, { ...item, currentPotential: [{ effect: 'STR_PCT', value: 13 }],
      currentFlames: [{ option: 'STR', stage: 6 }], replacementCostMesos: 1_000_000_000 }]] : []
  }))
  const selection = { equipment: serializeEquipment(equipment), equipment_class: 'Hero',
    maple_class: 'Bishop', score_weights: { attack_value: '3' }, upgrade_settings: { categories: ['starforce'] } }
  assert.ok(encodeURIComponent(JSON.stringify(selection)).length > 4096)
  const instance = browser()
  assert.equal(saveEquipmentSelection(selection, instance), true)
  const saved = readEquipmentSelection(instance)
  assert.deepEqual(saved, selection)
  assert.equal(Object.hasOwn(saved.equipment, 'ring-4'), false)
  assert.equal(restoreEquipment(saved.equipment, saved.equipment_class)['ring-4'].name, 'Ring of Restraint')
  assert.deepEqual(serializeEquipment(restoreEquipment(saved.equipment, saved.equipment_class)), selection.equipment)
})

test('legacy cookies migrate after successful writes and local storage takes precedence', () => {
  const instance = browser()
  const legacy = { equipment_class: 'Hero', equipment: {} }
  instance.document.cookie = `other=1;${EQUIPMENT_STORAGE_KEY}=${encodeURIComponent(JSON.stringify(legacy))}`
  assert.deepEqual(readEquipmentSelection(instance), legacy)
  assert.equal(saveEquipmentSelection(legacy, instance), true)
  assert.match(instance.document.cookie, /Max-Age=0/)
  instance.document.cookie = `${EQUIPMENT_STORAGE_KEY}=${encodeURIComponent(JSON.stringify({ equipment_class: 'Bishop' }))}`
  assert.deepEqual(readEquipmentSelection(instance), legacy)
})

test('malformed or blocked storage recovers cookies and failed writes preserve them', () => {
  const instance = browser()
  const legacy = { equipment_class: 'Hero' }
  const cookie = `${EQUIPMENT_STORAGE_KEY}=${encodeURIComponent(JSON.stringify(legacy))}`
  instance.document.cookie = cookie
  for (const invalid of ['{', 'null', '[]', '42']) {
    instance.localStorage.setItem(EQUIPMENT_STORAGE_KEY, invalid)
    assert.deepEqual(readEquipmentSelection(instance), legacy)
  }
  Object.defineProperty(instance, 'localStorage', { get() { throw new Error('Blocked') } })
  assert.deepEqual(readEquipmentSelection(instance), legacy)
  assert.equal(saveEquipmentSelection(legacy, instance), false)
  assert.equal(instance.document.cookie, cookie)
  instance.document.cookie = `${EQUIPMENT_STORAGE_KEY}=%invalid`
  assert.deepEqual(readEquipmentSelection(instance), {})
  const quota = browser()
  quota.localStorage.setItem = () => { throw new Error('Quota exceeded') }
  assert.equal(saveEquipmentSelection(legacy, quota), false)
})
