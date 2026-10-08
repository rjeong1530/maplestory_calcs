// Opt-in live checks: real calculations run sequentially against the deployed site.
// Uses a fresh headless Firefox profile; no existing browser data is accessed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { equipmentChoices } from '../src/data/flameEquipment.js'
import { serializeEquipment } from '../src/data/equipmentSave.js'

const site = process.env.SMOKE_SITE_URL || 'https://maplestory-calculator.onrender.com'
const api = process.env.SMOKE_API_URL || 'https://maplestory-calcs-1.onrender.com'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

test('deployed routes, real form submissions, validation and CORS', { timeout: 240000 }, async t => {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const driver = spawn(process.env.GECKODRIVER_PATH || 'geckodriver', ['--port', String(port)],
    { windowsHide: true, stdio: 'ignore' })
  let launchError
  driver.on('error', error => { launchError = error })
  let session
  async function command(path, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(100000),
    })
    const result = await response.json()
    if (result.value?.error) throw new Error(result.value.message)
    return result.value
  }
  t.after(async () => {
    if (session) await command(`/session/${session}`, undefined, 'DELETE').catch(() => {})
    driver.kill()
  })
  async function until(check, label, timeout = 95000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (launchError) throw launchError
      if (await check()) return
      await delay(200)
    }
    throw new Error(`Timed out: ${label}`)
  }
  await until(() => command('/status').catch(() => false), 'driver startup', 10000)
  session = (await command('/session', { capabilities: { alwaysMatch: {
    browserName: 'firefox', 'moz:firefoxOptions': { args: ['-headless', '-no-remote'] },
  } } })).sessionId
  const execute = (script, ...args) => command(`/session/${session}/execute/sync`, { script, args })
  const navigate = path => execute(`document.querySelector('.main-navigation a[href="' + arguments[0] + '"]').click()`, path)
  const button = text => execute(`const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === arguments[0] && b.getClientRects().length); if (!b) return false; b.click(); return true`, text)
  const visible = selector => execute(`return [...document.querySelectorAll(arguments[0])].some(e => e.getClientRects().length)`, selector)
  async function outcome(selector, label) {
    const start = Date.now()
    await until(async () => {
      const errors = await execute(`return [...document.querySelectorAll('.error')].filter(e => e.getClientRects().length).map(e => e.textContent)`)
      assert.deepEqual(errors, [], `${label}: visible errors`)
      return visible(selector)
    }, label)
    t.diagnostic(`${label}: ${Date.now() - start} ms`)
  }
  // Verify direct route reloads resolve to the SPA, before driving client navigation.
  for (const path of ['/', '/calculators/potential', '/calculators/flames', '/calculators/starforce', '/equipment']) {
    const response = await fetch(`${site}${path}`, { signal: AbortSignal.timeout(90000) })
    assert.equal(response.status, 200, path)
    assert.match(await response.text(), /<div id="root">/, path)
  }
  const preflight = await fetch(`${api}/api/probability`, { method: 'OPTIONS', headers: {
    Origin: site, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type',
  }, signal: AbortSignal.timeout(90000) })
  assert.equal(preflight.status, 200)
  assert.equal(preflight.headers.get('access-control-allow-origin'), site)
  const invalid = await fetch(`${api}/api/probability`, { method: 'POST', headers: {
    Origin: site, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ targets: [] }), signal: AbortSignal.timeout(90000) })
  assert.equal(invalid.status, 422)
  assert.equal(invalid.headers.get('access-control-allow-origin'), site)

  await command(`/session/${session}/url`, { url: site })
  await until(() => visible('.main-navigation'), 'home')
  await execute(`
    window.__smokeRequests = []; window.__smokeErrors = [];
    window.addEventListener('error', e => window.__smokeErrors.push(e.message));
    window.addEventListener('unhandledrejection', e => window.__smokeErrors.push(String(e.reason)));
    const original = window.fetch.bind(window);
    window.fetch = async (path, init) => {
      const row = { path: String(path), method: init?.method || 'GET', start: performance.now() };
      window.__smokeRequests.push(row);
      try { const response = await original(path, init); row.status = response.status; return response; }
      catch (error) { row.error = error.name; throw error; }
      finally { row.ms = Math.round(performance.now() - row.start); delete row.start; }
    };
  `)
  await navigate('/calculators/potential')
  await until(() => execute(`return !!document.querySelector('.target-list input') && !document.querySelector('button[type="submit"]').disabled`), 'potential options')
  await execute(`document.querySelector('.target-list').closest('form').requestSubmit()`)
  await outcome('.probability', 'Potential default submission')
  await navigate('/calculators/flames')
  await until(() => visible('.flame-form'), 'flame form')
  await execute(`document.querySelector('.flame-form').requestSubmit()`)
  await outcome('.flame-form + .results .probability', 'Flame default submission')
  await navigate('/calculators/starforce')
  await until(() => visible('.starforce-form'), 'Star Force form')
  await execute(`document.querySelector('.starforce-form').requestSubmit()`)
  await outcome('.starforce-metrics', 'Star Force default submission')
  await button('Compare strategies')
  await execute(`document.querySelector('.strategy-view > form').requestSubmit()`)
  await outcome('.strategy-comparison-table', 'Strategy default submission')
  const comparisonRows = await execute(`return document.querySelectorAll('.strategy-comparison-table tbody th[scope="row"]').length`)
  assert.equal(await button('Add strategy to comparison'), true)
  await until(() => execute(`return ![...document.querySelectorAll('.custom-strategy-editor button')].some(b => b.disabled)`), 'custom strategy completion')
  assert.equal(await execute(`return document.querySelectorAll('.strategy-comparison-table tbody th[scope="row"]').length`), comparisonRows + 1)

  // A single hat keeps this live upgrade request small while exercising all categories.
  const hat = { ...equipmentChoices('hat', 'Hero')[0], currentStarForce: 17 }
  await execute(`localStorage.setItem('maplestory-flame-equipment', JSON.stringify(arguments[0]))`,
    { equipment_class: 'Hero', maple_class: 'Hero', equipment: serializeEquipment({ hat }) })
  const requests = await execute('return window.__smokeRequests')
  assert.deepEqual(await execute('return window.__smokeErrors'), [])
  for (const request of requests.filter(r => r.method === 'POST')) assert.equal(request.status, 200, JSON.stringify(request))
  t.diagnostic(JSON.stringify(requests))
  await command(`/session/${session}/url`, { url: `${site}/equipment` })
  await until(() => visible('.equipment-window'), 'equipment')
  await button('Stats & upgrades')
  await until(() => visible('.upgrade-plan'), 'upgrade form')
  await execute(`document.querySelector('.upgrade-plan form').requestSubmit()`)
  await until(async () => {
    assert.deepEqual(await execute(`return [...document.querySelectorAll('.upgrade-plan .error')].map(e => e.textContent)`), [])
    return execute(`return !!document.querySelector('.upgrade-plan table')`)
  }, 'equipment upgrade result')
  t.diagnostic('Equipment upgrade submission: rendered results')
})
