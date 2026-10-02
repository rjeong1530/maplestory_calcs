import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPotentialTargets } from './potentialTargets.js'

test('All Stat expands into four stat totals supported by the API', () => {
  assert.deepEqual(buildPotentialTargets([{ effect: 'ALL_STAT_PCT', target: '7' }]), [
    { effect: 'STR_PCT', target: 7 }, { effect: 'DEX_PCT', target: 7 },
    { effect: 'INT_PCT', target: 7 }, { effect: 'LUK_PCT', target: 7 },
  ])
})

test('All Stat adds to main and secondary stat targets without affecting other effects', () => {
  const rows = [
    { effect: 'STR_PCT', target: '13' }, { effect: 'DEX_PCT', target: '6' },
    { effect: 'ALL_STAT_PCT', target: '7' }, { effect: 'COOLDOWN_SEC', target: '2' },
    { effect: 'MAX_HP_PCT', target: '12' },
  ]
  const totals = rows => Object.fromEntries(buildPotentialTargets(rows).map(row => [row.effect, row.target]))
  const expected = { STR_PCT: 20, DEX_PCT: 13, INT_PCT: 7, LUK_PCT: 7, COOLDOWN_SEC: 2, MAX_HP_PCT: 12 }
  assert.deepEqual(totals(rows), expected)
  assert.deepEqual(totals([...rows].reverse()), expected)
})

test('ordinary targets retain their values without All Stat', () => {
  assert.deepEqual(buildPotentialTargets([{ effect: 'ATT_PCT', target: '12.5' }]), [
    { effect: 'ATT_PCT', target: 12.5 },
  ])
})
