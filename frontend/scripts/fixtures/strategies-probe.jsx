// Browser-only regression probe; not imported by the application.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import StarForceStrategies from '../../src/components/StarForceStrategies'

export async function verifyStrategies() {
  const host = document.createElement('div')
  host.hidden = true
  document.body.append(host)
  const root = createRoot(host)
  const originalFetch = window.fetch
  let finish
  let signal
  let reads = 0
  const row = (name, cost) => ({ name, enhancement_cost_mesos: cost, expected_replacement_cost_mesos: 0,
    total_cost_mesos: cost, expected_spares: 1, expected_attempts: 3, mode_by_star: {}, safeguard_by_star: {} })
  const frontier = new Proxy([row('First', 100), row('Second', 200)], { get(target, key) {
    if (key === Symbol.iterator) reads++
    return Reflect.get(target, key)
  } })
  const report = { assumptions: { policies_evaluated: 2, item_level: 200, start_star: 15, target_star: 22 },
    scenarios: frontier, baseline: frontier[0], efficient_frontier: frontier }
  const form = { item_level: '200', start_star: '15', target_star: '22', replacement_cost_mesos: '0' }
  const render = value => flushSync(() => root.render(createElement(StarForceStrategies, { form: value, onChange() {} })))
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const submit = () => flushSync(() => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  window.fetch = (_url, init) => {
    signal = init.signal
    return new Promise(resolve => { finish = () => resolve({ ok: true, json: async () => report }) })
  }
  try {
    render(form)
    submit()
    finish()
    await settle()
    const point = host.querySelectorAll('circle[role="button"]')[1]
    if (!point) throw new Error('Strategy chart did not render')
    flushSync(() => point.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    const keyboardSelects = point.getAttribute('aria-pressed') === 'true'
    // Prop-only rerenders should not map the frontier into SVG coordinates again.
    reads = 0
    for (let i = 0; i < 10; i++) render({ ...form })
    const stableReads = reads
    submit()
    const abortedSignal = signal
    const lateResponse = finish
    render({ ...form, item_level: '201' })
    render(form)
    await settle()
    const canResubmit = !host.querySelector('.strategy-submit').disabled
    lateResponse()
    await settle()
    return { keyboardSelects, stableReads, aborted: abortedSignal.aborted, canResubmit,
      staleChart: !!host.querySelector('.strategy-chart') }
  } finally {
    flushSync(() => root.unmount())
    host.remove()
    window.fetch = originalFetch
  }
}
