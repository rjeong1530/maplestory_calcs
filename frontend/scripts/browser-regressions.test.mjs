// Runs in a fresh Firefox profile; never reads or changes a user's browser data.
// Requires Firefox and geckodriver (GECKODRIVER_PATH or on PATH).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { equipmentChoices } from '../src/data/flameEquipment.js'
import { serializeEquipment } from '../src/data/equipmentSave.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function port() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const value = server.address().port
  await new Promise(resolve => server.close(resolve))
  return value
}

test('navigation, stale responses, persistence, sorting, and selected equipment application', { timeout: 90000 }, async t => {
  const webPort = await port()
  const driverPort = await port()
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
    { cwd: root, windowsHide: true, stdio: 'ignore' })
  const driver = spawn(process.env.GECKODRIVER_PATH || 'geckodriver', ['--port', String(driverPort)],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let driverLog = ''
  driver.stdout.on('data', data => { driverLog += data })
  driver.stderr.on('data', data => { driverLog += data })
  let launchError
  driver.on('error', error => { launchError = error })
  vite.on('error', error => { launchError = error })
  let session
  async function command(path, body, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(`http://127.0.0.1:${driverPort}${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    })
    const result = await response.json()
    if (result.value?.error) throw new Error(`${result.value.message}\n${driverLog.slice(-3000)}`)
    return result.value
  }
  t.after(async () => {
    if (session) await command(`/session/${session}`, undefined, 'DELETE').catch(() => {})
    driver.kill()
    vite.kill()
  })
  async function until(check, label) {
    for (let i = 0; i < 100; i++) {
      if (launchError) throw launchError
      if (await check().catch(() => false)) return
      await delay(100)
    }
    throw new Error(`Timed out: ${label}`)
  }
  await until(() => command('/status'), 'geckodriver startup')
  await until(async () => (await fetch(`http://127.0.0.1:${webPort}`)).ok, 'Vite startup')
  session = (await command('/session', { capabilities: { alwaysMatch: {
    browserName: 'firefox', 'moz:firefoxOptions': {
      ...(process.env.FIREFOX_BINARY ? { binary: process.env.FIREFOX_BINARY } : {}),
      args: ['-headless', '-no-remote'], prefs: { 'permissions.default.image': 2 },
    },
  } } })).sessionId
  const execute = (script, ...args) => command(`/session/${session}/execute/sync`, { script, args })
  const visibleButton = text => execute(`const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === arguments[0] && b.getClientRects().length); if (!b) return false; b.click(); return true`, text)
  const navigate = path => execute(`document.querySelector('.main-navigation a[href="' + arguments[0] + '"]').click()`, path)
  await command(`/session/${session}/url`, { url: `http://127.0.0.1:${webPort}/equipment` })
  await until(() => execute("return !!document.querySelector('.equipment-window')"), 'equipment load')
  const hat = { ...equipmentChoices('hat', 'Hero')[0], currentStarForce: 17, minimumCooldownSeconds: 2 }
  const gloves = equipmentChoices('gloves', 'Hero')[0]
  const saved = { equipment_class: 'Hero', maple_class: 'Hero', equipment: serializeEquipment({ hat, gloves }) }
  await execute("localStorage.setItem('maplestory-flame-equipment', JSON.stringify(arguments[0]))", saved)
  await command(`/session/${session}/refresh`, {})
  await until(() => execute("return !!document.querySelector('.equipment-window')"), 'restored equipment')
  assert.equal(await execute("return document.querySelector('#equipment-stats-view').children.length > 0"), false,
    'setup must not mount the unused stats section')
  const report = JSON.parse(await readFile(new URL('../../examples/starforce/level-200-15-to-22.json', import.meta.url), 'utf8'))
  await execute(`
    window.__report = arguments[0]; window.__pending = [];
    const original = window.fetch;
    window.fetch = (path, init) => {
      const response = body => ({ ok: true, json: async () => body });
      if (String(path).startsWith('/api/starforce-costs')) return Promise.resolve(response({ costs_by_star: [] }));
      if (path === '/api/starforce-strategies') return Promise.resolve(response(window.__report));
      if (path === '/api/starforce-estimate') {
        window.__estimatePayload = JSON.parse(init.body);
        return new Promise(resolve => window.__pending.push(body => resolve(response(body))));
      }
      return original(path, init);
    };
    window.__writes = 0;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(...args) { window.__writes++; return set.apply(this,args); };
  `, report)
  await visibleButton('Stats & upgrades')
  await until(() => visibleButton('Compare Star Force approaches'), 'approaches shortcut')
  await until(() => execute("return document.querySelector('.strategy-view')?.getClientRects().length > 0"), 'direct approaches navigation')
  await visibleButton('Custom estimate')
  await visibleButton('Calculate expected cost')
  await until(() => execute('return window.__pending.length === 1'), 'pending estimate')
  await visibleButton('Compare strategies')
  await execute(`const input = document.querySelector('.strategy-view input[name="item_level"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'210'); input.dispatchEvent(new Event('input',{bubbles:true}));`)
  await delay(100)
  await execute("window.__pending[0]({ expected_cost: 987654321, expected_replacement_cost: 0, expected_booms: 0, meso_estimates: [] })")
  await visibleButton('Custom estimate')
  await delay(100)
  assert.equal(await execute("return document.querySelector('.starforce-metrics') !== null"), false, 'late response must not reappear')
  await visibleButton('Calculate expected cost')
  await until(() => execute('return window.__pending.length === 2'), 'replacement request')
  assert.deepEqual(await execute('return window.__estimatePayload.percentiles'), [.5, .75, .9, .95, .99])
  assert.equal(await execute('return window.__estimatePayload.include_budget_distribution'), true)
  await execute("window.__pending[1]({ expected_cost: 123456, expected_replacement_cost: 0, expected_booms: 0, meso_estimates: [], budget_distribution: {step_mesos: 100000, probabilities: [0,.2,.5,.75,.9,.99], mean_success_probability: .2, rounding_unit_mesos: 6250, calculation_limit_mesos: 500000} })")
  await until(() => execute("return document.querySelector('.starforce-metrics')?.textContent.includes('123,456')"), 'current response displayed')
  assert.deepEqual(await execute("return [...document.querySelectorAll('.budget-inputs input')].map(input => input.value)"), ['20.000', '123456'])
  const editBudgetInput = (index, value) => execute(`const input = document.querySelectorAll('.budget-inputs input')[arguments[0]]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,arguments[1]); input.dispatchEvent(new Event('input',{bubbles:true}));`, index, value)
  await editBudgetInput(0, '63.174')
  await until(() => execute("return document.querySelectorAll('.budget-inputs input')[1].value === '300000'"), 'arbitrary percent changes budget')
  await editBudgetInput(1, '250000')
  await until(() => execute("return document.querySelector('.budget-inputs input').value === '50.000'"), 'budget changes chance')
  await editBudgetInput(0, '100')
  await until(() => execute("return document.querySelector('#budget-input-note').textContent.includes('beyond')"), 'unavailable chance explained')
  assert.equal(await execute("return document.querySelectorAll('.budget-inputs input')[1].value"), '')
  await editBudgetInput(0, '90')
  await until(() => execute("return document.querySelectorAll('.budget-inputs input')[1].value === '400000'"), 'valid chance recovers')
  assert.equal(await execute('return window.__pending.length'), 2, 'editing the budget must not recalculate')
  await navigate('/')
  await navigate('/calculators/starforce')
  await until(() => execute("return !!document.querySelector('.starforce-form input[name=\"item_level\"]')"), 'return to calculator')
  assert.equal(await execute("return document.querySelector('.starforce-form input[name=\"item_level\"]').value"), '210')
  assert.ok(await execute("return document.querySelector('.starforce-metrics').textContent.includes('123,456')"), 'results survive navigation')
  await visibleButton('Compare strategies')
  await execute("document.querySelector('.strategy-view > form').requestSubmit()")
  await until(() => execute("return !!document.querySelector('.strategy-comparison-table')"), 'comparison results')
  await execute("document.querySelector('button[aria-label=\"Sort total mesos, highest first\"]').click()")
  const top = report.scenarios.toSorted((a, b) => b.total_cost_mesos - a.total_cost_mesos)[0]
  assert.equal(await execute("return document.querySelector('.strategy-comparison-table tbody th').textContent.trim()"), top.name)
  await execute("document.querySelector('.strategy-comparison-table tbody .equipment-strategy-apply').open = true")
  await execute(`const panel = document.querySelector('.strategy-comparison-table tbody .equipment-strategy-apply'); [...panel.querySelectorAll('button')].find(b => b.textContent === 'Select equipment').click()`)
  await execute(`const labels = document.querySelectorAll('.strategy-comparison-table tbody .equipment-apply-items label'); [...labels].find(label => label.textContent.includes(arguments[0])).querySelector('input').click()`, hat.name)
  await execute(`const panel = document.querySelector('.strategy-comparison-table tbody .equipment-strategy-apply'); [...panel.querySelectorAll('button')].find(b => b.textContent === 'Apply to 1 item(s)').click()`)
  await delay(100)
  const applied = await execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment")
  assert.equal(applied.hat.current_star_force, 17)
  assert.equal(applied.hat.minimum_cooldown_seconds, 2)
  assert.deepEqual(applied.gloves, saved.equipment.gloves)
  assert.deepEqual(applied.hat.mode_by_star, Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
    const star = i + 15
    return [star, top.safeguard_by_star[star] ? 1 : top.mode_by_star[star] ?? 1]
  })))
  await navigate('/equipment')
  await until(() => execute("return !document.querySelector('#equipment-stats-view').hidden"), 'equipment subview retained')
  await navigate('/calculators/flames')
  await until(() => execute("return !!document.querySelector('input[name=\"target_score\"]')"), 'flame input')
  const writes = await execute('return window.__writes')
  await execute(`const input = document.querySelector('input[name="target_score"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'222'); input.dispatchEvent(new Event('input',{bubbles:true}));`)
  await delay(100)
  assert.equal(await execute('return window.__writes'), writes, 'unpersisted inputs must not rewrite saved gear')
  await execute(`
    const prior = window.fetch;
    window.__rollRequests = 0;
    window.fetch = (path, init) => {
      const response = data => Promise.resolve({ok:true,json:async()=>data});
      if (path === '/api/options') return response({equipment_types:['hat'], levels:[250], cube_types:['black','red'], effects:['STR_PCT','COOLDOWN_SEC']});
      if (String(path).startsWith('/api/item-options')) return response({potential:{available:true,effects:['STR_PCT','COOLDOWN_SEC']}});
      if (path === '/api/flame-probability' || path === '/api/probability') {
        window.__rollRequests++;
        return response({probability:.5, percentage:50, one_in:2, cube_estimates:[]});
      }
      return prior(path,init);
    };
  `)
  await visibleButton('Calculate odds')
  await until(() => execute("return !!document.querySelector('[aria-label=\"Flame success chance and roll count\"]')"), 'flame count editor')
  const editRoll = (label, index, value) => execute(`const section=document.querySelector('[aria-label="'+arguments[0]+'"]'); const input=section.querySelectorAll('.budget-inputs input')[arguments[1]]; input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,arguments[2]); input.dispatchEvent(new Event('input',{bubbles:true}));`, label,index,value)
  assert.equal(await execute("return document.querySelector('[aria-label=\"Flame success chance and roll count\"]').textContent.includes('mesos')"), false)
  await editRoll('Flame success chance and roll count', 0, '87.5')
  await until(() => execute("return document.querySelector('[aria-label=\"Flame success chance and roll count\"] .budget-inputs label:last-child input').value === '3'"), 'chance to flames')
  await editRoll('Flame success chance and roll count', 1, '4')
  await until(() => execute("return document.querySelector('[aria-label=\"Flame success chance and roll count\"] .budget-inputs input').value === '93.750'"), 'flames to chance')
  assert.equal(await execute("return getComputedStyle(document.activeElement).outlineStyle"), 'none')
  assert.notEqual(await execute("return getComputedStyle(document.activeElement.parentElement).boxShadow"), 'none')
  await navigate('/calculators/potential')
  await until(() => execute("return !![...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Calculate probability') && !b.disabled)"), 'potential form ready')
  await execute("[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Calculate probability')).click()")
  await until(() => execute("return !!document.querySelector('[aria-label=\"Cube success chance and meso budget\"]')"), 'cube budget editor')
  await editRoll('Cube success chance and meso budget', 0, '87.5')
  await until(() => execute("return document.querySelector('[aria-label=\"Cube success chance and meso budget\"] .budget-inputs label:last-child input').value === '66000000'"), 'chance to cube budget')
  await editRoll('Cube success chance and meso budget', 1, '22000000')
  await until(() => execute("return document.querySelector('[aria-label=\"Cube success chance and meso budget\"] .budget-inputs input').value === '50.000'"), 'cube budget to chance')
  assert.equal(await execute('return window.__rollRequests'), 2, 'editing either calculator must not request new odds')
  const fullSet = JSON.parse(await readFile(new URL('../../examples/equipment/hero.json', import.meta.url), 'utf8'))
  await execute("localStorage.setItem('maplestory-flame-equipment', JSON.stringify(arguments[0]))", { ...fullSet, maple_class: 'Hero' })
  await command(`/session/${session}/url`, { url: `http://127.0.0.1:${webPort}/equipment` })
  await until(() => execute("return !!document.querySelector('#equipment-stats-view .equipment-window')"), 'full equipment opens stats')
  assert.equal(await execute("return document.querySelector('#equipment-stats-view').hidden"), false)
  assert.equal(await execute("return document.querySelector('#equipment-setup-view').children.length"), 0,
    'stats must not mount the unused setup section')
  await visibleButton('Equipment setup')
  await until(() => execute("return !!document.querySelector('.equipment-setup')"), 'setup mounts on demand')
  await visibleButton('Stats & upgrades')
  assert.equal(await execute("return document.querySelector('#equipment-stats-view').hidden"), false)
})
