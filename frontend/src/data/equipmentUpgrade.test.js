import assert from 'node:assert/strict'
import test from 'node:test'
import { CLASS_STATS } from './classStats.js'
import { buildUpgradeRequest, combineStarforceSteps, orderStarforceSteps, restoreUpgradeSettings } from './equipmentUpgrade.js'

test('Xenon requests carry three primary stats and no secondary stats', () => {
  const request = buildUpgradeRequest({}, CLASS_STATS.Xenon, {}, restoreUpgradeSettings())
  assert.deepEqual(request.main_stat, ['STR', 'DEX', 'LUK'])
  assert.deepEqual(request.secondary_stats, [])
  assert.equal(request.offense_stat, 'ATT')
})

const starStep = (start, overrides = {}) => ({
  name: 'Astra Sacred Aegis', slot: 'secondary', current_star_force: 0,
  start_star: start, next_star: start + 1, current_score: start * 2,
  expected_score_gain: 2, action_cost_mesos: 100 * (start + 1),
  expected_attempts: start + 1, gain_per_meso: 2 / (100 * (start + 1)),
  ...overrides,
})

test('consecutive Astra steps combine into 0–10 with total costs, gains and efficiency', () => {
  const entries = Array.from({ length: 10 }, (_, star) => starStep(star))
  const original = structuredClone(entries)
  const rows = combineStarforceSteps(entries)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].start_star, 0)
  assert.equal(rows[0].next_star, 10)
  assert.equal(rows[0].current_score, 0)
  assert.equal(rows[0].expected_score_gain, 20)
  assert.equal(rows[0].action_cost_mesos, 5500)
  assert.equal(rows[0].expected_attempts, 55)
  assert.equal(rows[0].gain_per_meso, 20 / 5500)
  assert.deepEqual(entries, original)
})

test('grouping preserves interruptions, separate slots, gaps and reversed star order', () => {
  for (const entries of [
    [starStep(0), starStep(0, { name: 'Hat', slot: 'hat' }), starStep(1)],
    [starStep(0, { slot: 'ring-1' }), starStep(1, { slot: 'ring-2' })],
    [starStep(0), starStep(2)],
    [starStep(1), starStep(0)],
    [starStep(0), starStep(1, { expected_score_gain: null, action_cost_mesos: null })],
  ]) {
    assert.deepEqual(combineStarforceSteps(entries), entries)
  }
  assert.deepEqual(combineStarforceSteps([]), [])
})

test('Astra 10–15 prerequisites precede higher-efficiency 15–17 upgrades', () => {
  const entries = [15, 16, 10, 11, 12, 13, 14].map(star => starStep(star))
  const original = structuredClone(entries)
  const ordered = orderStarforceSteps(entries)
  assert.deepEqual(ordered.map(entry => entry.start_star), [10, 11, 12, 13, 14, 15, 16])
  const rows = combineStarforceSteps(ordered)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].start_star, 10)
  assert.equal(rows[0].next_star, 17)
  assert.deepEqual(entries, original)
})

test('equal-efficiency choices preserve ranking priority and separate equipped slots', () => {
  const first = starStep(10, { slot: 'ring-1', current_star_force: 10 })
  const later = starStep(11, { slot: 'ring-1', current_star_force: 10 })
  const other = starStep(10, { slot: 'ring-2', current_star_force: 10 })
  assert.deepEqual(orderStarforceSteps([later, other, first]), [other, first, later])
  assert.deepEqual(orderStarforceSteps([first, other, later]), [first, other, later])
  assert.deepEqual(orderStarforceSteps([]), [])
})

const path = (slot, gains, costs = gains.map(() => 100)) => gains.map((gain, star) =>
  starStep(star, { slot, expected_score_gain: gain, action_cost_mesos: costs[star] }))

test('six-star lookahead chooses a later payoff over another item and commits its prerequisites', () => {
  const astra = path('secondary', [1, 1, 1, 1, 1, 100, 1])
  const hat = path('hat', [10])
  const entries = [...hat, ...astra].reverse()
  const original = structuredClone(entries)
  assert.deepEqual(orderStarforceSteps(entries), [...astra.slice(0, 6), ...hat, astra[6]])
  assert.deepEqual(entries, original)
})

test('lookahead stops at six stars and does not use a seventh-star payoff', () => {
  const astra = path('secondary', [1, 1, 1, 1, 1, 1, 1000])
  const hat = path('hat', [10])
  assert.deepEqual(orderStarforceSteps([...astra, ...hat]), [...hat, ...astra])
})

test('range efficiency includes expensive prerequisites instead of averaging per-star ratios', () => {
  const astra = path('secondary', [1, 100], [10000, 1])
  const hat = path('hat', [10])
  assert.deepEqual(orderStarforceSteps([...astra, ...hat]), [...hat, ...astra])
})

test('Astra below 15 can win on post-15 gains beyond the normal six-star horizon', () => {
  const astra = path('secondary', [...Array(15).fill(1), 200, 200])
  const hat = path('hat', [20])
  const ordered = orderStarforceSteps([...hat, ...astra])
  assert.deepEqual(ordered, [...astra, ...hat])
  const rows = combineStarforceSteps(ordered)
  assert.equal(rows[0].next_star, 17)
  assert.equal(rows[0].action_cost_mesos, 1700)
  assert.equal(rows[0].expected_score_gain, 415)
})

test('post-15 gains do not win when the full prerequisite cost is too high', () => {
  const astra = path('secondary', [...Array(15).fill(1), 200, 200],
    [...Array(15).fill(10000), 100, 100])
  const hat = path('hat', [20])
  assert.deepEqual(orderStarforceSteps([...astra, ...hat]), [...hat, ...astra])
})

test('lookahead can choose fewer than six stars and reassesses after the chosen range', () => {
  const astra = path('secondary', [1, 99, 1])
  const hat = path('hat', [20, 1])
  assert.deepEqual(orderStarforceSteps([...astra, ...hat]),
    [astra[0], astra[1], hat[0], astra[2], hat[1]])
})

const stats = { main: 'INT', secondary: ['LUK'], offense: 'MATT' }
const weights = { all_stat_pct_value: '10', secondary_stat_per_main: '10',
  attack_value: '3', boss_damage_pct_value: '10' }

test('upgrade requests preserve duplicate slots and convert recorded rolls to API fields', () => {
  const ring = { name: 'Ring', config: { equipment_level: 150, equipment_type: 'armor',
    boss_equipment: true }, currentStarForce: 17, maxStarForce: 22, currentBossEquipment: false,
  starForceModes: { 15: 2, 18: 4 },
  starForceSafeguards: { 15: true, 17: false },
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
  assert.deepEqual(request.equipment.map(item => item.max_star_force), [22, 22])
  assert.equal(request.equipment[0].boss_equipment, false)
  assert.deepEqual(request.equipment[0].mode_by_star, { 15: 2, 18: 4 })
  assert.deepEqual(request.equipment[0].safeguard_by_star, { 15: true, 17: false })
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
    categories: ['starforce', 'flames', 'potential'],
    cube_type: 'black', base_stat_pct_value: '0', attack_pct_value: '10', crit_damage_pct_value: '8',
  })
})

test('upgrade selections survive restoration and reach the API', () => {
  const settings = restoreUpgradeSettings({ flame_type: 'abyssal', flame_cost_mesos: 9000000,
    categories: ['flames', 'invalid'] })
  const request = buildUpgradeRequest({}, stats, weights, settings)
  assert.equal('flame_type' in settings, false)
  assert.equal('flame_cost_mesos' in settings, false)
  assert.equal('flame_type' in request, false)
  assert.equal('flame_cost_mesos' in request, false)
  assert.deepEqual(request.categories, ['flames'])
  assert.deepEqual(restoreUpgradeSettings({ categories: ['invalid'] }).categories,
    ['starforce', 'flames', 'potential'])
})
