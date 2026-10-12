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
  const readSavedGear = () => execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment")
  await execute("document.querySelector('.equipment-setup [aria-label^=\"Hat:\"]').click()")
  await execute("document.querySelector('.equipment-catalog-item:not([aria-pressed=\"true\"])').click()")
  assert.deepEqual(await readSavedGear(), saved.equipment, 'preview selections must not overwrite saved items or stats')
  await visibleButton('Stats & upgrades')
  assert.deepEqual(await readSavedGear(), saved.equipment, 'switching tabs must not commit the draft')
  assert.equal(await execute("return [...document.querySelectorAll('button')].some(b => b.textContent === 'Save equips' && b.getClientRects().length)"), false)
  await visibleButton('Equipment setup')
  await visibleButton('Discard changes')
  assert.ok(await execute("return document.querySelector('.equipment-summary').textContent.includes('17')"))
  await visibleButton('Remove equipment')
  assert.deepEqual(await readSavedGear(), saved.equipment, 'removal is only a preview until saved')
  await visibleButton('Save equips')
  await until(async () => !(await readSavedGear()).hat, 'explicit save commits removal')
  assert.deepEqual((await readSavedGear()).gloves, saved.equipment.gloves)
  await command(`/session/${session}/refresh`, {})
  await until(() => execute("return !!document.querySelector('.equipment-window')"), 'saved removal survives reload')
  assert.equal((await readSavedGear()).hat, undefined)
  await execute("localStorage.setItem('maplestory-flame-equipment', JSON.stringify(arguments[0]))", saved)
  await command(`/session/${session}/refresh`, {})
  await until(() => execute("return !!document.querySelector('.equipment-window')"), 'restore setup fixture')
  await execute(`const select=[...document.querySelectorAll('.equipment-job-controls select')][0]; select.value='Magician'; select.dispatchEvent(new Event('change',{bubbles:true}));`)
  assert.equal(await execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment_class"), 'Hero')
  assert.deepEqual(await readSavedGear(), saved.equipment, 'class filtering cannot delete saved equipment')
  await visibleButton('Discard changes')
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
  const overallSteps = ['flames', 'starforce', 'potential'].map((category, index) => ({
    step: index + 1, category, slot: 'hat', name: 'Projected hat', equipment_level: 200,
    current_score: 140, target_score: 173.5, expected_final_score: 185,
    start_star: 17, next_star: 19, expected_score_gain: 45,
    action_cost_mesos: 100000000, gain_per_meso: .00000045,
    expected_booms: category === 'starforce' ? 1.25 : undefined,
    cumulative_cost_mesos: (index + 1) * 100000000,
  }))
  await execute(`
    const prior = window.fetch;
    window.__upgradeSteps = arguments[0];
    window.fetch = (path, init) => {
      if (path !== '/api/equipment-upgrade-plan') return prior(path, init);
      window.__upgradePayload = JSON.parse(init.body);
      const ranks = {gain_per_meso_first:[], largest_gain_first:[], unavailable:[]};
      return Promise.resolve({ok:true, json:async()=>({
        rankings:{starforce:ranks,flames:ranks,potential:ranks},
        flame_rankings:{black:ranks,abyssal:ranks},
        cost_assumptions_mesos:{black_flame:3000000,abyssal_flame:null},
        excluded_superior_equipment:[],
        overall_upgrade_order:{steps:window.__upgradeSteps,unavailable:[],step_limit:20}
      })});
    };
  `, overallSteps)
  await visibleButton('Calculate upgrade order')
  await until(() => execute("return !!document.querySelector('[aria-label=\"Upgrade category\"]')"), 'upgrade tabs')
  assert.deepEqual(await execute("return [...document.querySelectorAll('[aria-label=\"Upgrade category\"] button')].map(b=>b.textContent)"),
    ['Star Force', 'Flames', 'Potential', 'Overall'])
  assert.equal(await execute('return window.__upgradePayload.include_overall'), true)
  await visibleButton('Overall')
  await until(() => execute("return !!document.querySelector('.overall-upgrade-table')"), 'overall recommendations')
  assert.equal(await execute("return document.querySelectorAll('.overall-upgrade-table tbody tr').length"), 3)
  const recommendationText = await execute("return document.querySelector('.overall-upgrade-table').textContent")
  assert.deepEqual(await execute("return [...document.querySelectorAll('.overall-upgrade-table tbody tr')].map(row => row.cells[4].textContent)"),
    ['-', '1.25', '-'])
  await execute("window.__statsEditor = document.querySelector('.equipment-editor-panel')")
  await execute("document.querySelector('button[aria-label=\"Collapse current equipment stats\"]').click()")
  assert.equal(await execute("return document.querySelector('#current-equipment-stats-content').hidden"), true)
  assert.equal(await execute("return document.querySelector('[aria-controls=\"current-equipment-stats-content\"]').getAttribute('aria-expanded')"), 'false')
  assert.equal(await execute("return document.querySelector('.overall-upgrade-table').getClientRects().length > 0"), true)
  await execute("document.querySelector('button[aria-label=\"Expand current equipment stats\"]').click()")
  assert.equal(await execute("return document.querySelector('#current-equipment-stats-content').hidden"), false)
  assert.equal(await execute("return window.__statsEditor === document.querySelector('.equipment-editor-panel')"), true)
  assert.ok(await execute("return Math.abs(document.querySelector('.upgrade-plan').getBoundingClientRect().width - document.querySelector('.equipment-page-layout').getBoundingClientRect().width) < 2"))
  await command(`/session/${session}/window/rect`, { width: 390, height: 900 })
  assert.ok(await execute("const bounds = document.querySelector('.upgrade-plan').getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= window.innerWidth"),
    'upgrade panel fits the mobile viewport while its table scrolls internally')
  for (const text of ['173.5', '185', '17 \u2192 19 stars', 'Black Flames', 'Black cubes', 'Score gain / 100M']) {
    assert.ok(recommendationText.includes(text), text)
  }
  await execute("document.querySelector('.upgrade-plan .cube-sale-control input').click()")
  await until(() => execute("return !document.querySelector('.overall-upgrade-table')"), 'changed pricing clears stale recommendations')
  await visibleButton('Calculate upgrade order')
  await until(() => execute("return !!document.querySelector('.overall-upgrade-table')"), 'overall selection retained after recalculation')
  assert.equal(await execute('return window.__upgradePayload.cube_sale'), true)
  await execute('window.__upgradeSteps = []')
  await visibleButton('Calculate upgrade order')
  await until(() => execute("return document.querySelector('[aria-label=\"Overall upgrade order\"]')?.textContent.includes('No eligible upgrades')"), 'empty combined plan')
  await execute(`
    Promise.all([
      import('/node_modules/.vite/deps/react.js'),
      import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/components/DeferredPage.jsx')
    ]).then(([{default: React}, {default: ReactDOM}, {default: DeferredPage}]) => {
      const host = document.createElement('div');
      host.id = 'failed-route-test'; document.body.append(host);
      const BrokenPage = React.lazy(() => Promise.reject(new Error('Simulated chunk failure')));
      ReactDOM.createRoot(host).render(React.createElement(DeferredPage, {active:true}, React.createElement(BrokenPage)));
    }).catch(error => { window.__boundaryFailure = error.message; });
  `)
  await until(() => execute("return !!document.querySelector('#failed-route-test [role=\"alert\"]') || !!window.__boundaryFailure"), 'rejected lazy import shows recovery UI')
  assert.equal(await execute('return window.__boundaryFailure ?? null'), null)
  assert.equal(await execute("return !!document.querySelector('.main-navigation')"), true, 'route failure leaves navigation usable')
  await execute("document.querySelector('#failed-route-test button').click()")
  await until(() => execute("return !document.querySelector('#failed-route-test') && !!document.querySelector('.equipment-window')"), 'reload recovers the page')
  await navigate('/calculators/flames')
  await until(() => execute("return !!document.querySelector('input[name=\"attack_value\"]')"), 'independent flame weights')
  await execute(`const input=document.querySelector('input[name="attack_value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'17'); input.dispatchEvent(new Event('input',{bubbles:true}));`)
  await until(() => execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).score_weights.attack_value === '17'"), 'flame weights saved')
  await navigate('/equipment')
  const originalEquipmentWeight = await execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment_score_weights.attack_value")
  assert.notEqual(originalEquipmentWeight, '17', 'flame edits must not change equipment weights')
  await execute(`const input=[...document.querySelectorAll('.upgrade-weights label')].find(label=>label.textContent.trim()==='Points per ATT / MATT').querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'23'); input.dispatchEvent(new Event('input',{bubbles:true}));`)
  await until(() => execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment_score_weights.attack_value === '23'"), 'equipment weights saved')
  assert.equal(await execute("return document.querySelector('input[name=\"attack_value\"]').value"), '17')
  await visibleButton('Equipment setup')
  await until(() => execute("return !!document.querySelector('.equipment-transfer-actions')"), 'equipment transfer controls')
  await execute(`const create=URL.createObjectURL; URL.createObjectURL=function(blob){blob.text().then(text=>window.__exportedGear=JSON.parse(text)); return create.call(this,blob);}; HTMLAnchorElement.prototype.click=function(){};`)
  await visibleButton('Export JSON')
  await until(() => execute('return !!window.__exportedGear'), 'weights exported')
  assert.equal(await execute('return window.__exportedGear.score_weights.flame.attack_value'), 23)
  assert.ok(await execute('return Number.isFinite(window.__exportedGear.score_weights.potential.attack_pct_value)'))
  await execute(`const saved=window.__exportedGear; saved.score_weights.flame.attack_value=31; saved.score_weights.potential.attack_pct_value=7; const transfer=new DataTransfer(); transfer.items.add(new File([JSON.stringify(saved)],'equipment.json',{type:'application/json'})); const input=document.querySelector('input[aria-label="Import equipment JSON file"]'); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));`)
  await until(() => execute("return document.querySelector('.equipment-transfer-panel').textContent.includes('Equipment loaded into the preview')"), 'import previews equipment')
  assert.equal(await execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment_score_weights.attack_value"), '23')
  await visibleButton('Save equips')
  await until(() => execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment_score_weights.attack_value === '31'"), 'import restores equipment weights')
  assert.equal(await execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment')).upgrade_settings.attack_pct_value"), '7')
  assert.equal(await execute("return document.querySelector('input[name=\"attack_value\"]').value"), '17')
  await command(`/session/${session}/refresh`, {})
  await until(() => execute("return !!document.querySelector('.equipment-window')"), 'separate weights restore')
  const restoredWeights = await execute("return JSON.parse(localStorage.getItem('maplestory-flame-equipment'))")
  assert.equal(restoredWeights.score_weights.attack_value, '17')
  assert.equal(restoredWeights.equipment_score_weights.attack_value, '31')

  // Invalid values should be stopped by browser validation before using a server slot.
  await execute(`window.__reviewRequests = []; window.__rejectFlame = false;
    const prior = window.fetch;
    window.fetch = async (path, init) => {
      window.__reviewRequests.push({ path: String(path), method: init?.method || 'GET' });
      if (String(path).startsWith('/api/starforce-costs')) return { ok: true, json: async () => ({ costs_by_star: [] }) };
      if (path === '/api/flame-probability') return window.__rejectFlame
        ? { ok: false, status: 503, json: async () => { throw new SyntaxError('HTML gateway response'); } }
        : { ok: true, json: async () => ({ probability: .5, percentage: 50, one_in: 2 }) };
      return prior(path, init);
    };`)
  const editField = (selector, value) => execute(`const input = document.querySelector(arguments[0]);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, arguments[1]);
    input.dispatchEvent(new Event('input', { bubbles: true }));`, selector, value)
  await navigate('/calculators/flames')
  await until(() => execute("return !!document.querySelector('.flame-form')"), 'flame validation form')
  for (const [name, invalid, valid] of [['attack_value', '-1', '3'], ['all_stat_pct_value', '-1', '10'], ['equipment_level', '301', '200']]) {
    await editField(`.flame-form input[name="${name}"]`, invalid)
    assert.equal(await execute("return document.querySelector('.flame-form').checkValidity()"), false, name)
    await execute("document.querySelector('.flame-form').requestSubmit()")
    await editField(`.flame-form input[name="${name}"]`, valid)
  }
  assert.equal(await execute("return window.__reviewRequests.filter(r => r.method === 'POST').length"), 0)
  await execute("window.__rejectFlame = true; document.querySelector('.flame-form').requestSubmit()")
  await until(() => execute("return [...document.querySelectorAll('.error')].some(e => e.textContent.includes('starting up or busy'))"), 'overload message')
  assert.equal(await execute("return document.querySelector('.flame-form fieldset').disabled"), false)
  await execute("window.__rejectFlame = false; document.querySelector('.flame-form').requestSubmit()")
  await until(() => execute("return !!document.querySelector('.flame-form + .results .probability')"), 'manual retry succeeds')

  await navigate('/calculators/starforce')
  await until(() => execute("return !!document.querySelector('.starforce-form')"), 'Star Force validation form')
  await visibleButton('Custom estimate')
  await delay(350)
  await execute('window.__reviewRequests = []')
  for (const level of ['2', '21', '210']) await editField('.starforce-form input[name="item_level"]', level)
  await delay(400)
  assert.equal(await execute("return window.__reviewRequests.filter(r => r.path.startsWith('/api/starforce-costs')).length"), 1,
    'rapid level edits should send only the final cost-table request')
  await editField('.starforce-form input[name="item_level"]', '301')
  assert.equal(await execute("return document.querySelector('.starforce-form').checkValidity()"), false)
  await execute("document.querySelector('.starforce-form input[name=\"shining_starforce_sunday\"]').click()")
  await delay(350)
  assert.equal(await execute("return window.__reviewRequests.filter(r => r.path.startsWith('/api/starforce-costs')).length"), 1)
  assert.ok(await execute("return [...document.querySelectorAll('.starforce-cost-panel .error')].some(e => e.textContent.includes('1 to 300'))"))
  await editField('.starforce-form input[name="item_level"]', '200')
  await editField('.starforce-form input[name="target_star"]', '15')
  assert.equal(await execute("return document.querySelector('.starforce-form').checkValidity()"), false)
  assert.equal(await execute("return document.querySelector('.strategy-view > form').checkValidity()"), false)
  await execute("document.querySelector('.starforce-form').requestSubmit(); document.querySelector('.strategy-view > form').requestSubmit()")
  assert.equal(await execute("return window.__reviewRequests.filter(r => r.method === 'POST').length"), 0)

  // Edit a saved second copy without changing the equipped item, and send both.
  // The earlier refresh cleared the upgrade mock installed on the old document.
  await execute(`const prior = window.fetch; window.fetch = async (path, init) => {
    if (path !== '/api/equipment-upgrade-plan') return prior(path, init);
    window.__upgradePayload = JSON.parse(init.body);
    const ranks = {gain_per_meso_first:[], largest_gain_first:[], unavailable:[]};
    return {ok:true, json:async()=>({rankings:{starforce:ranks,flames:ranks,potential:ranks},
      flame_rankings:{black:ranks,abyssal:ranks}, excluded_superior_equipment:[],
      overall_upgrade_order:{steps:[],unavailable:[],step_limit:20,laddering_enabled:true}})};
  };`)
  await navigate('/equipment')
  await visibleButton('Stats & upgrades')
  await execute(`const select = document.querySelector('#current-equipment-stats-content .equipment-class-selector select');
    select.value = 'hat'; select.dispatchEvent(new Event('change', { bubbles: true }));`)
  await until(() => execute("return !!document.querySelector('.equipment-laddering input[type=checkbox]')"), 'laddering editor')
  const equippedStars = await execute("return document.querySelector('.equipment-editor-panel input[aria-label=\"Current Star Force\"]').value")
  await execute("document.querySelector('.equipment-laddering input[type=checkbox]').click()")
  await visibleButton('Second copy')
  assert.equal(await execute("return document.querySelector('.equipment-editor-panel input[aria-label=\"Current Star Force\"]').value"), '0')
  await editField('.equipment-editor-panel input[aria-label="Current Star Force"]', '17')
  await until(async () => (await readSavedGear()).hat.laddering?.second_copy?.current_star_force === 17, 'second copy saved')
  await visibleButton('Equipped copy')
  assert.equal(await execute("return document.querySelector('.equipment-editor-panel input[aria-label=\"Current Star Force\"]').value"), equippedStars)
  await visibleButton('Calculate upgrade order')
  await until(() => execute('return window.__upgradePayload.laddering_enabled === true'), 'laddering request')
  assert.equal(await execute("return window.__upgradePayload.equipment.find(i => i.slot === 'hat').laddering.second_copy.current_star_force"), 17)
  assert.equal(await execute("return window.__upgradePayload.equipment.find(i => i.slot === 'hat').current_star_force"), Number(equippedStars))
  await navigate('/')
  await navigate('/equipment')
  await visibleButton('Second copy')
  assert.equal(await execute("return document.querySelector('.equipment-editor-panel input[aria-label=\"Current Star Force\"]').value"), '17')
})
