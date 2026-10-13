import assert from 'node:assert/strict'
import test from 'node:test'
import { costForConfidence, FLAME_CONFIDENCES, flamesForConfidence, formatFlameChance } from '../src/data/flameUpgrade.js'

test('flame counts reach each confidence with the minimum number of independent rolls', () => {
  for (const probability of [0.5, 0.00036, 0.000009, 1e-12]) {
    for (const confidence of FLAME_CONFIDENCES) {
      const rolls = flamesForConfidence(probability, confidence)
      const chance = n => -Math.expm1(n * Math.log1p(-probability))
      assert.ok(chance(rolls) >= confidence - 1e-15)
      assert.ok(chance(rolls - 1) < confidence)
    }
  }
  assert.equal(flamesForConfidence(0.5, 0.75), 2)
})

test('guaranteed and unavailable improvements are handled explicitly', () => {
  assert.equal(flamesForConfidence(1, 0.99), 1)
  for (const probability of [0, -1, undefined, NaN, 1.1]) {
    assert.equal(flamesForConfidence(probability, 0.5), null)
  }
})

test('small nonzero probabilities stay visible', () => {
  assert.equal(formatFlameChance(0.00036), '0.036%')
  assert.equal(formatFlameChance(1), '100%')
  assert.notEqual(formatFlameChance(1e-12), '0%')
})

test('confidence costs use the rounded whole-flame count', () => {
  assert.equal(costForConfidence(0.1, 0.5, 3000000), 21000000)
  assert.equal(costForConfidence(1, 0.99, 3000000), 3000000)
  assert.equal(costForConfidence(0, 0.5, 3000000), null)
  assert.equal(costForConfidence(0.1, 0.5, null), null)
})
