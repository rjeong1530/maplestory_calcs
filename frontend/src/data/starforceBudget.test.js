import assert from 'node:assert/strict'
import test from 'node:test'
import { budgetForChance, chanceForBudget } from './starforceBudget.js'

const distribution = { step_mesos: 10, probabilities: [0, .2, .2, .8, .95], calculation_limit_mesos: 40 }

test('budget lookup handles arbitrary percentages and flat CDF regions conservatively', () => {
  assert.equal(budgetForChance(distribution, 0), 0)
  assert.equal(budgetForChance(distribution, 20), 10)
  assert.equal(budgetForChance(distribution, 20.001), 30)
  assert.equal(budgetForChance(distribution, 63.174), 30)
  assert.equal(budgetForChance(distribution, 95), 40)
  assert.equal(budgetForChance(distribution, 100), null)
})

test('budget to chance floors the grid and rejects values beyond its horizon', () => {
  assert.equal(chanceForBudget(distribution, 0), 0)
  assert.equal(chanceForBudget(distribution, 29.9), 20)
  assert.equal(chanceForBudget(distribution, 30), 80)
  assert.equal(chanceForBudget(distribution, 40), 95)
  assert.equal(chanceForBudget(distribution, 41), null)
})

test('invalid chance and budget inputs never produce misleading estimates', () => {
  for (const input of [NaN, Infinity, -1, '50']) {
    assert.equal(budgetForChance(distribution, input), null)
    assert.equal(chanceForBudget(distribution, input), null)
  }
  assert.equal(budgetForChance(distribution, 101), null)
})
