import test from 'node:test'
import assert from 'node:assert/strict'
import { rollsForChance, rollBudgetForChance, rollChanceForBudget } from '../src/data/rollBudget.js'

test('independent-roll chance and budget conversions use whole rolls', () => {
  assert.equal(rollsForChance(.5, 75), 2)
  assert.equal(rollBudgetForChance(.5, 75, 22000000), 44000000)
  assert.equal(rollChanceForBudget(.5, 43999999, 22000000), 50)
  assert.equal(rollChanceForBudget(.5, 44000000, 22000000), 75)
  const count = rollsForChance(.1, 63.174)
  assert.ok(rollChanceForBudget(.1, count, 1) >= 63.174)
  assert.ok(rollChanceForBudget(.1, count - 1, 1) < 63.174)
})

test('roll budgets handle impossible, guaranteed, and invalid inputs', () => {
  assert.equal(rollBudgetForChance(0, 50, 1), null)
  assert.equal(rollBudgetForChance(.5, 100, 1), null)
  assert.equal(rollBudgetForChance(1, 100, 1), 1)
  assert.equal(rollBudgetForChance(.5, 0, 1), 0)
  assert.equal(rollChanceForBudget(1, 0, 1), 0)
  assert.equal(rollChanceForBudget(1, 1, 1), 100)
  assert.equal(rollChanceForBudget(0, 100, 1), 0)
  for (const cost of [0, -1, NaN, Infinity]) {
    assert.equal(rollBudgetForChance(.5, 50, cost), null)
    assert.equal(rollChanceForBudget(.5, 50, cost), null)
  }
  for (const chance of [-1, 101, NaN, Infinity]) assert.equal(rollsForChance(.5, chance), null)
  assert.equal(rollChanceForBudget(.5, -1, 1), null)
  assert.equal(rollChanceForBudget(.5, 1e30, 1), null)
})
