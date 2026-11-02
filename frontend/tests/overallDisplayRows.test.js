import test from 'node:test'
import assert from 'node:assert/strict'
import { overallDisplayRows } from '../src/data/overallDisplayRows.js'

const star = (start, step, extra = {}) => ({category:'starforce',name:'Endless Terror',slot:'ring-1',
  start_star:start,next_star:start+1,step,action_cost_mesos:100,expected_score_gain:2,
  expected_booms:.1,gain_per_meso:.02,cumulative_cost_mesos:step*100,...extra})

test('Overall condenses adjacent Endless Terror stars, stopping at a potential upgrade', () => {
  const input = [star(0,1),star(1,2),{category:'potential',name:'Endless Terror',slot:'ring-1',step:3},
    star(2,4),star(3,5),star(4,6,{next_star:6}),star(6,7)]
  const before = structuredClone(input)
  const rows = overallDisplayRows(input)
  assert.equal(rows.length,3)
  assert.deepEqual(rows[0],{...input[0],next_star:2,last_step:2,action_cost_mesos:200,
    expected_score_gain:4,expected_booms:.2,cumulative_cost_mesos:200})
  assert.deepEqual(rows[1], input[2])
  assert.equal(rows[2].start_star,2)
  assert.equal(rows[2].next_star,7)
  assert.equal(rows[2].last_step,7)
  assert.equal(rows[2].cumulative_cost_mesos,700)
  assert.deepEqual(input,before,'response is not mutated')
})

test('Overall grouped efficiency uses total gain / total cost, not an average of ratios', () => {
  const [row] = overallDisplayRows([star(0,1),star(1,2,{action_cost_mesos:300,expected_score_gain:3,gain_per_meso:.01})])
  assert.equal(row.action_cost_mesos,400)
  assert.equal(row.expected_score_gain,5)
  assert.equal(row.gain_per_meso,5/400)
  assert.equal(overallDisplayRows([star(0,1,{action_cost_mesos:0}),star(1,2,{action_cost_mesos:0})])[0].gain_per_meso,null)
})

test('Overall preserves item, copy, gap, laddering and transfer boundaries', () => {
  for (const extra of [{slot:'ring-2'},{name:'Other ring'},{copy_label:'Spare'},
    {start_star:3},{category:'flames'},{laddering:true},{transfer_route:'trace_only'},{transfer_options:[]}]) {
    assert.equal(overallDisplayRows([star(0,1),star(1,2,extra)]).length,2,JSON.stringify(extra))
  }
  assert.equal(overallDisplayRows([star(0,1,{laddering:true}),star(1,2)]).length,2)
  assert.deepEqual(overallDisplayRows([]),[])
})
