import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUpgradeRequest, restoreUpgradeSettings } from './equipmentUpgrade.js'

const stats = { main: 'INT', secondary: ['LUK'], offense: 'MATT' }
const weights = { all_stat_pct_value: '10', secondary_stat_per_main: '10',
  attack_value: '3', boss_damage_pct_value: '10' }

test('upgrade requests preserve duplicate slots and convert recorded rolls to API fields', () => {
  const ring = { name: 'Ring', config: { equipment_level: 150, equipment_type: 'armor',
    boss_equipment: true }, currentStarForce: 17, currentBossEquipment: false,
  currentPotential: [{ effect: 'INT_PCT', value: '12' }, { effect: '', value: '' },
    { effect: 'ALL_STAT_PCT', value: '' }],
  currentFlames: [{ option: 'INT', stage: '6' }] }
  const request = buildUpgradeRequest({ 'ring-1': ring, 'ring-2': { ...ring, currentStarForce: 15 } },
    stats, weights, restoreUpgradeSettings({ cube_type: 'red' }))
  assert.equal(request.main_stat, 'INT')
  assert.equal(request.offense_stat, 'MATT')
  assert.equal(request.flame_weights.attack_value, 3)
  assert.equal(request.potential_weights.crit_damage_pct_value, 8)
  assert.equal(request.cube_type, 'red')
  assert.deepEqual(request.equipment.map(item => item.slot), ['ring-1', 'ring-2'])
  assert.deepEqual(request.equipment.map(item => item.current_star_force), [17, 15])
  assert.equal(request.equipment[0].boss_equipment, false)
  assert.equal(request.equipment[0].potential_equipment_type, 'accessory')
  assert.deepEqual(request.equipment[0].current_potential, [{ effect: 'INT_PCT', value: 12 }])
  assert.deepEqual(request.equipment[0].current_flames, [{ option: 'INT', stage: 6 }])
})

test('upgrade requests map overall and weapon types, retain clean offense and default empty rolls', () => {
  const request = buildUpgradeRequest({
    weapon: { name: 'Wand', config: { equipment_level: 200, equipment_type: 'weapon', base_weapon_offense: 400 } },
    top: { name: 'Overall', overall: true, config: { equipment_level: 150, equipment_type: 'armor' } },
  }, stats, weights, restoreUpgradeSettings())
  assert.equal(request.equipment[0].base_weapon_offense, 400)
  assert.equal(request.equipment[0].potential_equipment_type, 'weapon')
  assert.equal(request.equipment[1].potential_equipment_type, 'outfit')
  assert.equal(request.equipment[1].current_star_force, 0)
  assert.deepEqual(request.equipment[1].current_potential, [])
  assert.deepEqual(request.equipment[1].current_flames, [])
})

test('saved upgrade settings accept zero weights and recover from invalid values', () => {
  assert.deepEqual(restoreUpgradeSettings({ cube_type: 'invalid', base_stat_pct_value: 0,
    attack_pct_value: -1, crit_damage_pct_value: 'Infinity' }), {
    cube_type: 'black', base_stat_pct_value: '0', attack_pct_value: '10', crit_damage_pct_value: '8',
  })
})
