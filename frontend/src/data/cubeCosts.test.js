import test from 'node:test'
import assert from 'node:assert/strict'
import { cubeCost, cubeCostLabel } from './cubeCosts.js'

test('cube prices and labels reflect sale pricing for both cubes', () => {
  for (const [cube, regular, sale] of [['black', 22000000, 16500000], ['red', 12000000, 9000000]]) {
    assert.equal(cubeCost(cube), regular)
    assert.equal(cubeCost(cube, false), regular)
    assert.equal(cubeCost(cube, true), sale)
    assert.equal(cubeCostLabel(cube, true), (sale / 1000000) + 'M mesos per cube')
  }
})
