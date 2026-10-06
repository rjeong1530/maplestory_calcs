import assert from 'node:assert/strict'
import test from 'node:test'
import { frontierPoints, nameCustomStrategies, strategySteps } from './starforceStrategies.js'

test('custom strategy names follow the current list order after removals', () => {
  const remaining = nameCustomStrategies([{ id: 1 }, { id: 3 }])
  assert.deepEqual(remaining.map(({ id, name }) => ({ id, name })), [
    { id: 1, name: 'Your strategy 1' }, { id: 3, name: 'Your strategy 2' },
  ])
})

test('strategy steps include recovery, group adjacent modes and stop at the target', () => {
  const row = { mode_by_star: { 18: 4, 19: 4, 20: 4, 21: 4 }, safeguard_by_star: { 15: true, 16: true, 17: true } }
  assert.deepEqual(strategySteps(row, 22), [
    { from: 0, to: 15, action: 'Standard' }, { from: 15, to: 18, action: 'Safeguard (Mode 1)' },
    { from: 18, to: 22, action: 'Mode 4' },
  ])
  assert.deepEqual(strategySteps(row, 10), [{ from: 0, to: 10, action: 'Standard' }])
  assert.deepEqual(strategySteps(row, 25).at(-1), { from: 22, to: 25, action: 'Standard' })
})

test('tradeoff chart handles zero spares and uses enhancement costs instead of total costs', () => {
  const chart = frontierPoints([{ expected_spares: 0, enhancement_cost_mesos: 10, total_cost_mesos: 1000 }])
  assert.equal(chart.maxCost, 10)
  assert.deepEqual(chart.points, [{ x: 75, y: 40 }])
  assert.deepEqual(frontierPoints([]).points, [])
  const comparison = frontierPoints(
    [{ expected_spares: 1, enhancement_cost_mesos: 10 }],
    [{ expected_spares: 5, enhancement_cost_mesos: 100 }],
  )
  assert.equal(comparison.maxCost, 100)
  assert.equal(comparison.maxSpares, 5)
  assert.deepEqual(comparison.extraPoints, [{ x: 665, y: 40 }])
  assert.equal(comparison.points.length, 1) // Custom points never join the frontier line.
  assert.ok(comparison.points[0].x < comparison.extraPoints[0].x)
})
