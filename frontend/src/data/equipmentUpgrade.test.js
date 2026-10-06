import assert from 'node:assert/strict'
import test from 'node:test'
import { CLASS_STATS } from './classStats.js'
import { equipmentChoices } from './flameEquipment.js'
import { restoreEquipment } from './equipmentSave.js'
import { buildUpgradeRequest, combineStarforceSteps, orderStarforceSteps, restoreUpgradeSettings, restoreSecondaryStatWeight } from './equipmentUpgrade.js'

test('Eternal Knight Gloves use catalog boss flames despite an older saved non-boss flag', () => {
  const gloves = equipmentChoices('gloves', 'Hero').find(item => item.id === 1082760)
  assert.equal(gloves.config.boss_equipment, true)
  const stale = { ...gloves, currentBossEquipment: false }
  const request = buildUpgradeRequest({ gloves: stale }, CLASS_STATS.Hero, {}, restoreUpgradeSettings())
  assert.equal(request.equipment[0].boss_equipment, true)
  const restored = restoreEquipment({ gloves: { id: gloves.id, current_boss_equipment: false,
    current_flames: [{ option: 'STR', stage: 7 }] } }, 'Hero')
  assert.equal(restored.gloves.currentBossEquipment, true)
  assert.deepEqual(restored.gloves.currentFlames, [{ option: 'STR', stage: 7 }])
  const manual = buildUpgradeRequest({ gloves: { ...stale, needsFlameType: true } },
    CLASS_STATS.Hero, {}, restoreUpgradeSettings())
  assert.equal(manual.equipment[0].boss_equipment, false)
})

test('secondary stat weights migrate saved divisors and send points per stat', () => {
  assert.equal(restoreSecondaryStatWeight({ secondary_stat_per_main: '10' }), '0.1')
  assert.equal(restoreSecondaryStatWeight({ secondary_stat_per_main: '4' }), '0.25')
  assert.equal(restoreSecondaryStatWeight({ secondary_stat_value: '0', secondary_stat_per_main: '10' }), '0')
  for (const value of [undefined, '', 0, -1, 'invalid']) {
    assert.equal(restoreSecondaryStatWeight({ secondary_stat_per_main: value }), '0.1')
  }
  const request = buildUpgradeRequest({}, CLASS_STATS.Hero,
    { secondary_stat_value: '0.25' }, restoreUpgradeSettings())
  assert.equal(request.flame_weights.secondary_stat_value, 0.25)
  assert.ok(!Object.hasOwn(request.flame_weights, 'secondary_stat_per_main'))
})

test('Xenon requests carry three primary stats and no secondary stats', () => {
  const request = buildUpgradeRequest({}, CLASS_STATS.Xenon, {}, restoreUpgradeSettings())
  assert.deepEqual(request.main_stat, ['STR', 'DEX', 'LUK'])
  assert.deepEqual(request.secondary_stats, [])
  assert.equal(request.offense_stat, 'ATT')
  assert.equal(request.shining_starforce_sunday, true)
  assert.equal(request.mvp_rank, 'none')
})

test('MVP rank is validated in restored settings and serialized in requests', () => {
  const settings = restoreUpgradeSettings({ mvp_rank: 'diamond_plus' })
  assert.equal(settings.mvp_rank, 'diamond_plus')
  assert.equal(restoreUpgradeSettings({ mvp_rank: 'invalid' }).mvp_rank, 'none')
  assert.equal(
    buildUpgradeRequest({}, CLASS_STATS.Hero, {}, settings).mvp_rank,
    'diamond_plus',
  )
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
const weights = { all_stat_pct_value: '10', secondary_stat_value: '0.1',
  attack_value: '3', boss_damage_pct_value: '10' }

test('replacement costs reach requests and grouped boom totals affect ordering', () => {
  const item = { name: 'Astra Sacred Aegis', config: { equipment_level: 200, equipment_type: 'armor' } }
  const request = buildUpgradeRequest({ secondary: item, hat: { ...item, name: 'Hat' } },
    stats, weights, restoreUpgradeSettings())
  assert.equal(request.equipment[0].replacement_cost_mesos, 1_000_000_000)
  assert.equal(request.equipment[1].replacement_cost_mesos, 0)
  const zero = buildUpgradeRequest({ secondary: { ...item, replacementCostMesos: 0 } }, stats, weights, restoreUpgradeSettings())
  assert.equal(zero.equipment[0].replacement_cost_mesos, 0)
  const steps = [0, 1].map(star => starStep(star, { expected_booms: 0.25,
    expected_replacement_cost: 250_000_000, action_cost_mesos: 250_000_100 }))
  const combined = combineStarforceSteps(steps)[0]
  assert.equal(combined.expected_booms, 0.5)
  assert.equal(combined.expected_replacement_cost, 500_000_000)
  assert.equal(combined.action_cost_mesos, 500_000_200)
  assert.equal(combined.gain_per_meso, 4 / 500_000_200)
  const cheap = starStep(0, { slot: 'hat', action_cost_mesos: 100 })
  assert.equal(orderStarforceSteps([...steps, cheap])[0], cheap)
})

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
  assert.equal(request.equipment[0].boss_equipment, true)
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
    cube_type: 'black', shining_starforce_sunday: true, mvp_rank: 'none',
    base_stat_pct_value: '0', attack_pct_value: '10', crit_damage_pct_value: '8',
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

test('fixed ring four is excluded from all upgrade requests', () => {
  const ring = { name: 'Ring of Restraint', config: { equipment_level: 110, equipment_type: 'armor' } }
  const request = buildUpgradeRequest({ 'ring-4': ring, 'ring-1': { ...ring, name: 'Other ring' } },
    stats, weights, restoreUpgradeSettings())
  assert.deepEqual(request.equipment.map(item => item.slot), ['ring-1'])
})
