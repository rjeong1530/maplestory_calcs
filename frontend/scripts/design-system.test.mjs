// Isolated Chrome profile. No calculator requests or real browser data are used.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function port() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const value = server.address().port
  await new Promise(resolve => server.close(resolve))
  return value
}
async function until(check, label) {
  for (let i = 0; i < 120; i++) {
    if (await check()) return
    await delay(50)
  }
  throw new Error(`Timed out: ${label}`)
}

test('Workshop controls, retained tabs, dialog focus, responsive layout and reduced motion', { timeout: 60000 }, async t => {
  const webPort = await port()
  const chromePort = await port()
  const profile = await mkdtemp(join(tmpdir(), 'maple-ui-test-'))
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], { cwd: root, windowsHide: true, stdio: 'ignore' })
  const browser = spawn(process.env.CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${chromePort}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' })
  let launchError
  vite.on('error', error => { launchError = error })
  browser.on('error', error => { launchError = error })
  let socket
  t.after(() => { socket?.close(); browser.kill(); vite.kill() })
  await until(async () => {
    if (launchError) throw launchError
    try { return (await fetch(`http://127.0.0.1:${chromePort}/json/list`, { signal: AbortSignal.timeout(500) })).ok && (await fetch(`http://127.0.0.1:${webPort}`, { signal: AbortSignal.timeout(500) })).ok } catch { return false }
  }, 'browser and Vite startup')
  const pages = await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json()
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let nextId = 0
  const pending = new Map()
  const exceptions = []
  const apiCalls = []
  const pausedModules = []
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Fetch.requestPaused') pausedModules.push(message.params.requestId)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/')) apiCalls.push(message.params.request.url)
    if (!message.id) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  }
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const click = text => evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && b.getClientRects().length); if (!el) throw Error('Button not found'); el.focus(); el.click(); })()`)
  async function key(key, code = key) {
    const windowsVirtualKeyCode = { Tab: 9, Escape: 27, ArrowLeft: 37, ArrowRight: 39 }[key]
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode })
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode })
  }
  await command('Runtime.enable')
  await command('Network.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await command('Page.navigate', { url: `http://127.0.0.1:${webPort}/design-system.html` })
  await until(() => evaluate(`!!document.querySelector('.mw-shell')`), 'component mount')
  await until(() => evaluate(`[...document.images].every(image => image.complete)`), 'images')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mw-theme')).colorScheme`), 'light')
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('.mw-background')).backgroundImage.includes('floating-islands.png')`))

  await evaluate(`document.querySelector('[aria-label="Increase Current stars"]').click()`)
  assert.equal(await evaluate(`document.querySelector('.mw-stepper input').value`), '18')
  await evaluate(`void (window.retainedInput = document.querySelector('.mw-stepper input'))`)
  await click('Validation & states')
  await until(() => evaluate(`document.querySelector('[aria-selected="true"]').textContent === 'Validation & states'`), 'tab update')
  assert.equal(await evaluate(`window.retainedInput.isConnected && window.retainedInput.getClientRects().length === 0`), true)
  assert.equal(await evaluate(`document.querySelector('[aria-invalid="true"]').checkValidity()`), false)
  await key('ArrowLeft')
  await until(() => evaluate(`document.querySelector('[aria-selected="true"]').textContent === 'Controls & results'`), 'arrow tab activation')
  assert.equal(await evaluate(`document.querySelector('.mw-stepper input') === window.retainedInput && window.retainedInput.value === '18'`), true)
  await evaluate(`(() => { const input = document.querySelector('.mw-stepper input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '30'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await until(() => evaluate(`document.querySelector('[aria-label="Increase Current stars"]').disabled`), 'stepper max state')
  assert.equal(await evaluate(`document.querySelector('.mw-stepper input').value`), '30', 'controlled stepping respects max')

  await click('Open dialog')
  await until(() => evaluate(`document.querySelector('dialog').open`), 'dialog open')
  assert.equal(await evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true)
  for (let i = 0; i < 6; i++) {
    await key('Tab')
    assert.equal(await evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true, 'focus stays in dialog')
  }
  await key('Escape')
  await until(() => evaluate(`!document.querySelector('dialog').open`), 'dialog close')
  assert.equal(await evaluate(`document.activeElement.textContent`), 'Open dialog')

  await evaluate(`document.querySelector('span[tabindex="0"]').focus()`)
  await until(() => evaluate(`!!document.querySelector('[role="tooltip"]')`), 'tooltip focus')
  await key('Escape')
  await until(() => evaluate(`!document.querySelector('[role="tooltip"]')`), 'tooltip dismissal')
  await click('Preview notification')
  await until(() => evaluate(`!!document.querySelector('.mw-toast')`), 'toast')
  await evaluate(`document.querySelector('[aria-label="Dismiss notification"]').click()`)
  await until(() => evaluate(`!document.querySelector('.mw-toast')`), 'toast dismissal')

  const captures = join(root, 'dist', 'ui-preview')
  await mkdir(captures, { recursive: true })
  for (const [name, width, expectedColumns] of [['desktop', 1440, 3], ['tablet', 900, 2], ['mobile', 390, 1], ['small-mobile', 320, 1]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false })
    const layout = await evaluate(`(() => {
      const grid = document.querySelector('[role="tabpanel"]:not([hidden]) > div');
      return { columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth > innerWidth };
    })()`)
    assert.equal(layout.columns, expectedColumns, `${name} column count`)
    assert.equal(layout.overflow, false, `${name} must not overflow horizontally`)
    await delay(200)
    const capture = await command('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, `${name}.png`), Buffer.from(capture.data, 'base64'))
  }
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate(`getComputedStyle(document.querySelector('.mw-spinner')).animationName === 'none'`), 'reduced motion')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mw-skeleton-line')).animationName`), 'none')
  await evaluate(`document.querySelector('span[tabindex="0"]').focus()`)
  await until(() => evaluate(`!!document.querySelector('[role="tooltip"]')`), 'mobile tooltip')
  assert.equal(await evaluate(`(() => { const r = document.querySelector('[role="tooltip"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()`), true, 'tooltip stays in the mobile viewport')
  await key('Escape')
  await evaluate(`document.querySelector('.mw-menu-toggle').click()`)
  await click('Open dialog')
  await until(() => evaluate(`document.querySelector('dialog').open`), 'reduced-motion dialog')
  await key('Escape')
  await until(() => evaluate(`!document.querySelector('dialog').open`), 'reduced-motion close')
  assert.deepEqual(exceptions, [], 'no uncaught runtime errors')
  assert.deepEqual(apiCalls, [], 'preview must not invoke calculator APIs')
  assert.equal(await evaluate(`localStorage.length`), 0, 'preview must not write saved equipment')

  // Exercise the real AppShell with mocked services; never wake production APIs.
  await command('Page.enable')
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    const originalFetch = window.fetch;
    window.fetch = (url, init) => {
      if (!String(url).includes('/api/')) return originalFetch(url, init);
      const path = String(url);
      (window.workshopRequests ??= []).push({ path, payload: init?.body ? JSON.parse(init.body) : null });
      if (path.endsWith('/api/bug-reports')) return new Promise((resolve, reject) => {
        window.finishBugReport = () => resolve(new Response(JSON.stringify({report_id:'workshop-test-123'}), {headers:{'Content-Type':'application/json'}}));
        window.failBugReport = () => reject(new Error('Example report submission failure'));
      });
      if (path.endsWith('/api/equipment-upgrade-plan')) return new Promise(resolve => {
        window.finishUpgradePlan = () => {
          const base = {slot:'hat',name:'Eternal Knight Helm',current_star_force:17,current_score:100,expected_attempts:2,expected_booms:.1};
          const sf = [{...base,start_star:17,next_star:18,expected_score_gain:10,action_cost_mesos:1000000,gain_per_meso:.00001},
            {...base,start_star:18,next_star:19,expected_score_gain:5,action_cost_mesos:2000000,gain_per_meso:.0000025}];
          const roll = {...base,expected_score_gain:8,action_cost_mesos:30000000,gain_per_meso:8/30000000,improvement_probability:.1};
          const flame = {largest_gain_first:[roll], unavailable:[]};
          resolve(new Response(JSON.stringify({rankings:{starforce:{gain_per_meso_first:sf,unavailable:[]},potential:{gain_per_meso_first:[roll],unavailable:[]}},flame_rankings:{black:flame,abyssal:flame},cost_assumptions_mesos:{black_flame:3000000,abyssal_flame:null},excluded_superior_equipment:[],overall_upgrade_order:{step_limit:20,steps:[{...sf[0],step:1,category:'starforce',cumulative_cost_mesos:1000000}],unavailable:[]}}), {headers:{'Content-Type':'application/json'}}));
        };
      });
      if (path.endsWith('/api/probability')) return new Promise((resolve, reject) => {
        window.finishPotential = (probability = .1) => resolve(new Response(JSON.stringify({probability, percentage: probability * 100, one_in: probability ? 1 / probability : null, cube_estimates: []}), {headers: {'Content-Type':'application/json'}}));
        window.failPotential = () => reject(new Error('Example potential failure'));
      });
      if (path.includes('/api/starforce-estimate')) return new Promise((resolve, reject) => {
        window.finishStarforce = (overrides = {}) => resolve(new Response(JSON.stringify({ expected_cost: 300000, expected_replacement_cost: 100000,
          expected_attempts: 96.5, expected_booms: 2.5, budget_distribution: { step_mesos: 100000, probabilities: [0,.2,.5,.75,.9,.99],
          mean_success_probability: .75, rounding_unit_mesos: 6250, calculation_limit_mesos: 500000 }, ...overrides }), { headers: { 'Content-Type': 'application/json' } }));
        window.failStarforce = () => reject(new Error('Example connection failure'));
      });
      if (window.holdCalculation && path.includes('/api/flame-probability')) {
        return new Promise((resolve, reject) => {
          window.finishCalculation = () => resolve(new Response(JSON.stringify({ target_score: 135, probability: .1, percentage: 10, one_in: 10,
            score_distribution: [{ lower: 0, upper: 45, probability: .2 }, { lower: 45, upper: 90, probability: .4 }, { lower: 90, upper: 135, probability: .3 }, { lower: 135, upper: 180, probability: .1 }]
          }), { headers: { 'Content-Type': 'application/json' } }));
          window.failCalculation = () => reject(new Error('Example connection failure'));
        });
      }
      const data = path.includes('/api/options') ? { equipment_types: ['hat'], levels: [250], cube_types: ['black', 'red'], effects: ['STR_PCT', 'COOLDOWN_SEC'] }
        : path.includes('/api/item-options') ? { potential: { available: true, effects: ['STR_PCT', 'COOLDOWN_SEC', 'ALL_STAT_PCT'], values_by_line: [{line:1, values:{STR_PCT:[13], COOLDOWN_SEC:[1,2], ALL_STAT_PCT:[10]}}] }, flame_values: [], flame_tier_ranges: {}, flame_stages: [], flame_options: [] }
        : path.includes('/api/starforce-costs') ? { costs_by_star: [0,15,18,22].map(star => ({star, base_cost: 100000,
          mode_costs: {1:100000,2:200000,3:300000,4:400000},
          mode_rates: Object.fromEntries([1,2,3,4].map(mode => [mode, star < 18 && mode === 4 ? null : {success:.3,maintain:.5,downgrade:.1,boom:.1}])),
          safeguard_rates: star === 15 ? {success:.3,maintain:.7,downgrade:0,boom:0} : null,
        })) } : {};
      return Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
    };
  ` })
  await command('Page.navigate', { url: `http://127.0.0.1:${webPort}/` })
  await until(() => evaluate(`!!document.querySelector('.mw-page-transition')`), 'real shell')
  const go = async (path, page) => {
    await evaluate(`document.querySelector('.main-navigation a[href="${path}"]').click()`)
    await until(() => evaluate(`document.querySelector('.mw-page-transition').dataset.page === '${page}'`), `route ${page}`)
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await command('Emulation.setEmulatedMedia', { features: [] })
  await until(() => evaluate(`!document.querySelector('.mw-navigation-panel').hidden`), 'desktop navigation after resize')
  await evaluate(`document.querySelector('.calculator-dropdown summary').focus(); document.querySelector('.calculator-dropdown summary').click()`)
  assert.equal(await evaluate(`document.querySelector('.calculator-dropdown').open`), true)
  await key('Escape')
  assert.equal(await evaluate(`document.querySelector('.calculator-dropdown').open`), false)
  assert.equal(await evaluate(`document.activeElement.tagName`), 'SUMMARY')
  await go('/calculators/flames', 'flame')
  await until(() => evaluate(`!!document.querySelector('.flame-form input[name="target_score"]')`), 'flame form')
  await evaluate(`(() => { const input = document.querySelector('.flame-form input[name="target_score"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '135'); input.dispatchEvent(new Event('input', { bubbles: true })); window.originalFlameInput = input; })()`)
  await go('/calculators/starforce', 'starforce')
  await until(() => evaluate(`!!document.querySelector('.starforce-form')`), 'starforce form')
  const editStarforce = (name, value) => evaluate(`(() => { const input = document.querySelector('.starforce-form [name="${name}"]'); Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
  assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Star Force Calculator')
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Enhancement mode from 15 stars"] button').length`), 3)
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Enhancement mode from 18 stars"] button').length`), 4)
  await evaluate(`document.querySelector('[aria-label="Increase Current Star"]').click(); document.querySelector('[aria-label="Increase Target Star"]').click()`)
  assert.equal(await evaluate(`document.querySelector('[name="start_star"]').value`), '16')
  assert.equal(await evaluate(`document.querySelector('[name="target_star"]').value`), '23')
  await editStarforce('target_star', '16')
  assert.equal(await evaluate(`document.querySelector('.starforce-form').checkValidity()`), false)
  await editStarforce('target_star', '23')
  await editStarforce('replacement_cost_mesos', '1000000')
  await editStarforce('mvp_rank', 'gold')
  await evaluate(`document.querySelector('.starforce-form [name="shining_starforce_sunday"]').click(); document.querySelector('.starforce-form [name="superior_item"]').click(); document.querySelector('[aria-label="Enhancement mode from 15 stars"] button:nth-child(2)').click(); document.querySelector('[aria-label="Safeguard attempt from 15 stars"]').click()`)
  await evaluate(`document.querySelector('.starforce-form').requestSubmit()`)
  await until(() => evaluate(`!!window.finishStarforce`), 'Star Force request')
  assert.deepEqual(await evaluate(`window.workshopRequests.filter(request => request.path.includes('/api/starforce-estimate')).at(-1).payload`), {
    percentiles: [.5,.75,.9,.95,.99], include_budget_distribution: true, item_level: 200, start_star: 16, target_star: 23,
    replacement_cost_mesos: 1000000, shining_starforce_sunday: false, mvp_rank: 'gold', superior_item: true,
    mode_by_star: {15:2,16:1,17:1,18:1,19:1,20:1,21:1}, safeguard_by_star: {15:true,16:false,17:false},
  }, 'redesigned controls retain the exact payload contract')
  assert.equal(await evaluate(`document.querySelector('.starforce-form button[type="submit"]').disabled`), true)
  assert.equal(await evaluate(`!!document.querySelector('.starforce-result .mw-result-skeleton')`), true)
  await evaluate(`window.finishStarforce()`)
  await until(() => evaluate(`document.querySelector('.starforce-metrics')?.textContent.includes('300,000')`), 'Star Force result metrics')
  assert.ok(await evaluate(`document.querySelector('.starforce-metrics').textContent.includes('96.5') && document.querySelector('.starforce-metrics').textContent.includes('75.000%')`))
  assert.ok(await evaluate(`document.querySelector('.sf-chart desc').textContent.includes('500,000 mesos') && document.querySelector('.sf-chart desc').textContent.includes('99.000 percent')`), 'chart exposes the returned CDF range and endpoint')
  assert.equal(await evaluate(`(document.querySelector('.sf-chart path').getAttribute('d').match(/H/g) || []).length`), 5, 'chart draws each sampled CDF step without fitting a curve')
  await evaluate(`(() => {const input = document.querySelector('.budget-chance-picker input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '90'); input.dispatchEvent(new Event('input', {bubbles:true}));})()`)
  assert.equal(await evaluate(`document.querySelectorAll('.budget-chance-picker input')[1].value`), '400000', 'existing conservative CDF lookup remains unchanged')
  await until(() => evaluate(`!!document.querySelector('.sf-table tbody tr')`), 'tap cost/rate tables')
  assert.ok(await evaluate(`document.querySelectorAll('.sf-table')[1].textContent.includes('N/A')`))
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.sf-table:not(.sf-rate-table) tbody tr')].map(row => [...row.querySelectorAll('td')].slice(1).map(cell => cell.textContent))`), [
    ['100,000','N/A','N/A','N/A'], ['100,000','200,000','300,000','400,000'],
    ['100,000','200,000','300,000','400,000'], ['100,000','N/A','N/A','N/A'],
  ], 'cost columns show N/A outside selectable mode/safeguard ranges')
  assert.equal(await evaluate(`[...document.querySelectorAll('.sf-rate-table th[scope="colgroup"]')].every(header => getComputedStyle(header).textAlign === 'center' && parseFloat(getComputedStyle(header).borderLeftWidth) === 2)`), true, 'mode headings are centered and separated')
  for (const [name, width] of [['desktop',1440],['tablet',900],['mobile',390],['small-mobile',320]]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:1100,deviceScaleFactor:1,mobile:false})
    await delay(300)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true, `Star Force ${name} overflow`)
    const screenshot = await command('Page.captureScreenshot', {format:'png'})
    await writeFile(join(captures, `starforce-${name}.png`), Buffer.from(screenshot.data,'base64'))
  }
  await command('Emulation.setDeviceMetricsOverride', {width:1440,height:1100,deviceScaleFactor:1,mobile:false})
  await click('Compare strategies')
  await click('Custom estimate')
  assert.equal(await evaluate(`document.querySelector('[name="start_star"]').value`), '16')
  assert.equal(await evaluate(`document.querySelectorAll('.budget-chance-picker input')[1].value`), '400000', 'view changes retain budget input state')
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate(`getComputedStyle(document.querySelector('.sf-star-trail')).textShadow === 'none'`), 'reduced-motion stars')
  await evaluate(`document.querySelector('.starforce-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.starforce-result .mw-result-skeleton')`), 'repeat estimate')
  await evaluate(`window.finishStarforce({ expected_cost: 320000, budget_distribution: null })`)
  await until(() => evaluate(`document.querySelector('.starforce-metrics')?.textContent.includes('320,000')`), 'changed animated result')
  assert.equal(await evaluate(`!!document.querySelector('.sf-chart')`), false, 'no chart without CDF data')
  await editStarforce('item_level', '301')
  assert.equal(await evaluate(`document.querySelector('.starforce-form').checkValidity()`), false)
  assert.equal(await evaluate(`!!document.querySelector('.starforce-metrics')`), false, 'editing invalidates the prior result')
  await editStarforce('item_level', '200')
  await evaluate(`document.querySelector('.starforce-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.starforce-result .mw-result-skeleton')`), 'error request begins')
  await evaluate(`window.failStarforce()`)
  await until(() => evaluate(`!!document.querySelector('.starforce-result [role="alert"]')`), 'request error')
  await command('Emulation.setEmulatedMedia', { features: [] })
  await go('/equipment', 'equipment')
  await until(() => evaluate(`!!document.querySelector('.equipment-window')`), 'equipment setup')
  await go('/calculators/potential', 'potential')
  await until(() => evaluate(`!!document.querySelector('.target-list')`), 'potential form').catch(async error => {
    throw new Error(`${error.message}: ${await evaluate('document.body.innerText.slice(-4000)')}`)
  })
  await go('/bug-report', 'bugs')
  await go('/', 'home')
  await go('/calculators/flames', 'flame')
  assert.equal(await evaluate(`document.querySelector('.flame-form input[name="target_score"]') === window.originalFlameInput && window.originalFlameInput.value === '135'`), true, 'route transitions retain calculator input identity and state')
  await evaluate(`history.back()`)
  await until(() => evaluate(`document.querySelector('.mw-page-transition').dataset.page === 'home'`), 'browser back')
  await evaluate(`history.forward()`)
  await until(() => evaluate(`document.querySelector('.mw-page-transition').dataset.page === 'flame'`), 'browser forward')
  await evaluate(`document.querySelector('.main-navigation a[href="/"]').click(); document.querySelector('.main-navigation a[href="/bug-report"]').click()`)
  await until(() => evaluate(`document.querySelector('.mw-page-transition').dataset.page === 'bugs'`), 'rapid navigation')
  await until(() => evaluate(`Number(getComputedStyle(document.querySelector('.mw-page-transition')).opacity) === 1`), 'transition completion')
  await go('/', 'home')
  for (const width of [1440, 900, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false })
    await delay(300)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true, `shell overflow at ${width}`)
    assert.equal(await evaluate(`document.querySelector('.mw-menu-toggle').getClientRects().length > 0`), width < 900, 'hamburger only appears on mobile/tablet')
    if (width < 900) {
      await evaluate(`document.querySelector('.mw-menu-toggle').focus(); document.querySelector('.mw-menu-toggle').click()`)
      assert.equal(await evaluate(`document.querySelector('.mw-menu-toggle').getAttribute('aria-expanded')`), 'true')
      await evaluate(`document.querySelector('.calculator-dropdown summary').focus(); document.querySelector('.calculator-dropdown summary').click()`)
      await key('Escape')
      assert.equal(await evaluate(`document.querySelector('.calculator-dropdown').open`), false)
      await key('Escape')
      assert.equal(await evaluate(`document.querySelector('.mw-navigation-panel').hidden`), true)
      assert.equal(await evaluate(`document.activeElement === document.querySelector('.mw-menu-toggle')`), true)
    }
    const shot = await command('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, `app-shell-${width}.png`), Buffer.from(shot.data, 'base64'))
  }
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mw-background')).pointerEvents`), 'none')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mw-background')).position`), 'fixed')
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await go('/calculators/flames', 'flame')
  await until(() => evaluate(`getComputedStyle(document.querySelector('.mw-page-transition')).transform === 'none'`), 'reduced route movement')
  await evaluate(`window.holdCalculation = true; document.querySelector('.flame-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.flame-form button[type="submit"] .mw-spinner')`), 'submit spinner')
  assert.equal(await evaluate(`document.querySelector('.flame-form button[type="submit"]').disabled`), true)
  assert.equal(await evaluate(`window.originalFlameInput.getClientRects().length > 0`), true, 'form stays visible while calculating')
  assert.equal(await evaluate(`!!document.querySelector('.flame-form + section .mw-result-skeleton')`), true)
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.flame-form + section .mw-skeleton-line')).animationName`), 'none')
  await evaluate(`window.finishCalculation()`)
  await until(() => evaluate(`!document.querySelector('.flame-form button[type="submit"]').disabled`), 'result resolution')
  assert.equal(await evaluate(`!!document.querySelector('.flame-form + section .mw-result-skeleton')`), false, 'skeleton ends with the request')
  assert.equal(await evaluate(`document.querySelector('.flame-form + section').textContent.includes('10')`), true)
  await evaluate(`document.querySelector('.flame-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.flame-form + section .mw-result-skeleton')`), 'repeat calculation')
  await evaluate(`window.failCalculation()`)
  await until(() => evaluate(`!!document.querySelector('.flame-form + section [role="alert"]')`), 'failed calculation')
  assert.equal(await evaluate(`!!document.querySelector('.flame-form + section .mw-result-skeleton')`), false, 'errors replace loading')

  // The visual migration preserves native validation and the exact API configuration.
  const armorRequest = await evaluate(`window.workshopRequests.filter(r => r.path.includes('/api/flame-probability')).at(-1).payload`)
  assert.deepEqual(armorRequest, { config: {
    equipment_level: 150, equipment_type: 'armor', boss_equipment: true, flame_type: 'black',
    main_stat: 'STR', secondary_stats: ['DEX'], offense_stat: 'ATT',
    weights: { all_stat_pct_value: 10, secondary_stat_value: .1, attack_value: 3, boss_damage_pct_value: 10 },
  }, target_score: 135 })
  async function changeFlame(name, value) {
    await evaluate(`(() => { const el = document.querySelector('.flame-form [name="${name}"]');
      Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
  }
  await changeFlame('equipment_level', '301')
  assert.equal(await evaluate(`document.querySelector('.flame-form').checkValidity()`), false)
  await changeFlame('equipment_level', '150')
  await changeFlame('maple_class', 'Bishop')
  await changeFlame('equipment_type', 'weapon')
  await changeFlame('weapon_series', 'arcane')
  await changeFlame('target_score', '-1.5')
  assert.equal(await evaluate(`document.querySelector('.flame-form').checkValidity()`), true, 'score retains its unrestricted fractional range')
  assert.equal(await evaluate(`document.querySelector('[name="equipment_level"]').readOnly && document.querySelector('[name="boss_equipment"]').disabled && document.querySelector('[name="boss_equipment"]').checked`), true)
  await evaluate(`document.querySelector('.flame-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.flame-result .mw-result-skeleton')`), 'weapon request')
  assert.deepEqual(await evaluate(`window.workshopRequests.filter(r => r.path.includes('/api/flame-probability')).at(-1).payload`), {
    config: { ...armorRequest.config, equipment_level: 200, equipment_type: 'weapon', main_stat: 'INT', secondary_stats: ['LUK'], offense_stat: 'MATT', base_weapon_offense: 353 }, target_score: -1.5,
  })
  await evaluate(`window.finishCalculation()`)
  await until(() => evaluate(`!document.querySelector('.flame-form button[type="submit"]').disabled`), 'weapon result')
  assert.equal(await evaluate(`document.querySelector('.flame-result .budget-chance-picker').querySelectorAll('input').length`), 2, 'existing count-only budget remains intact')
  await until(() => evaluate(`getComputedStyle(document.querySelector('.flame-result-content > div')).opacity === '1'`), 'result entrance completes')
  assert.equal(await evaluate(`document.querySelectorAll('.flame-form .mw-card').length`), 1, 'setup shares one flat card')
  assert.equal(await evaluate(`document.querySelectorAll('.flame-chart-bar').length`), 4, 'renders server score ranges')
  await evaluate(`document.querySelectorAll('.flame-chart-bar')[1].focus()`)
  assert.equal(await evaluate(`document.querySelector('.flame-chart-detail').textContent.includes('40%')`), true, 'keyboard focus exposes the actual range probability')
  await evaluate(`document.activeElement.blur()`)
  for (const width of [1440, 900, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    await evaluate(`window.scrollTo(0,0)`)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Flame page fits ${width}px`)
    const shot = await command('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, `flame-${width}.png`), Buffer.from(shot.data, 'base64'))
  }

  // Hold an actual code request to observe startup and lazy equipment fallbacks.
  await go('/calculators/potential', 'potential')
  await until(() => evaluate(`document.querySelectorAll('.potential-form .target-row').length === 2`), 'potential targets')
  await evaluate(`Array.from(document.querySelectorAll('.potential-form button')).find(b => b.textContent === '+ Add Stat').click()`)
  await until(() => evaluate(`document.querySelectorAll('.potential-form .target-row').length === 3`), 'added All Stat')
  await evaluate(`document.querySelector('.potential-form [role="switch"]').click(); document.querySelector('.potential-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.potential-results .mw-result-skeleton')`), 'potential request')
  assert.equal(await evaluate(`document.querySelector('.potential-form button[type="submit"]').disabled`), true)
  assert.deepEqual(await evaluate(`window.workshopRequests.filter(r => r.path.endsWith('/api/probability')).at(-1).payload`), {
    equipment_type: 'hat', level: 250, cube_type: 'black', percentiles: [], targets: [
      {effect:'STR_PCT',target:14}, {effect:'COOLDOWN_SEC',target:4}, {effect:'DEX_PCT',target:1}, {effect:'INT_PCT',target:1}, {effect:'LUK_PCT',target:1},
    ],
  })
  await evaluate(`window.finishPotential()`)
  await until(() => evaluate(`!!document.querySelector('.potential-results .budget-chance-picker')`), 'potential result')
  assert.equal(await evaluate(`document.querySelector('.potential-results').textContent.includes('165,000,000')`), true, 'sale cost uses existing cube price')
  assert.equal(await evaluate(`!!document.querySelector('.potential-results input')?.closest('form')`), false, 'budget fields do not submit calculator')
  for (const width of [1440, 900, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:1100,deviceScaleFactor:1,mobile:false})
    await evaluate(`window.scrollTo(0,0)`)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Potential fits ${width}px`)
    const shot = await command('Page.captureScreenshot', {format:'png'})
    await writeFile(join(captures, `potential-${width}.png`), Buffer.from(shot.data,'base64'))
  }
  await evaluate(`document.querySelector('.potential-form button[aria-label="Remove potential 3"]').click()`)
  await until(() => evaluate(`document.querySelectorAll('.potential-form .target-row').length === 2`), 'removed target')
  await evaluate(`document.querySelector('.potential-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.potential-results .mw-result-skeleton')`), 'potential retry')
  await evaluate(`window.failPotential()`)
  await until(() => evaluate(`!!document.querySelector('.potential-results [role="alert"]')`), 'potential error')

  await command('Network.setCacheDisabled', { cacheDisabled: true })
  await command('Fetch.enable', { patterns: [{ urlPattern: '*EquipmentPage.jsx*', requestStage: 'Request' }] })
  await command('Page.navigate', { url: `http://127.0.0.1:${webPort}/equipment` })
  await until(() => evaluate(`!!document.querySelector('.mw-fullpage-loading')`), 'full-page startup loading')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mw-loading-particles span')).animationName`), 'none')
  await until(() => Promise.resolve(pausedModules.length > 0), 'held equipment module')
  for (const requestId of pausedModules.splice(0)) await command('Fetch.continueRequest', { requestId })
  await command('Fetch.disable')
  await until(() => evaluate(`!!document.querySelector('.equipment-window')`), 'startup completes')
  assert.equal(await evaluate(`!!document.querySelector('.mw-fullpage-loading')`), false)
  await command('Page.navigate', { url: `http://127.0.0.1:${webPort}/` })
  await until(() => evaluate(`document.querySelector('.mw-page-transition')?.dataset.page === 'home'`), 'fresh home')
  await command('Fetch.enable', { patterns: [{ urlPattern: '*EquipmentPage.jsx*', requestStage: 'Request' }] })
  await go('/equipment', 'equipment')
  await until(() => evaluate(`!!document.querySelector('.mw-equipment-skeleton')`), 'lazy equipment skeleton')
  await until(() => Promise.resolve(pausedModules.length > 0), 'held lazy equipment module')
  for (const requestId of pausedModules.splice(0)) await command('Fetch.continueRequest', { requestId })
  await command('Fetch.disable')
  await until(() => evaluate(`!!document.querySelector('.equipment-window')`), 'equipment replaces skeleton')
  assert.equal(await evaluate(`!!document.querySelector('.mw-equipment-skeleton')`), false)
  const equipmentButton = async text => evaluate(`Array.from(document.querySelectorAll('.equipment-setup button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`)
  await until(() => evaluate(`!!document.querySelector('.workshop-equipment-slots')`), 'workshop equipment grid')
  const originalSave = await evaluate(`localStorage.getItem('maplestory-flame-equipment')`)
  assert.equal(await evaluate(`document.querySelectorAll('.workshop-equipment-slots button').length`), 24, 'exact supported selectable slots')
  await evaluate(`document.querySelector('.equipment-setup [aria-label^="Hat:"]').click()`)
  await until(() => evaluate(`!!document.querySelector('.equipment-catalog-item')`), 'hat catalog')
  await evaluate(`document.querySelector('.equipment-catalog-item').click()`)
  assert.equal(await evaluate(`localStorage.getItem('maplestory-flame-equipment')`), originalSave, 'selection only changes preview')
  await equipmentButton('Discard changes')
  assert.equal(await evaluate(`document.querySelector('.equipment-setup [aria-label^="Hat:"]').getAttribute('aria-label')`), 'Hat: empty')
  await evaluate(`document.querySelector('.equipment-catalog-item').click()`)
  await equipmentButton('Save equips')
  await until(() => evaluate(`!!JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment.hat`), 'explicit save commits preview')
  const savedBuild = await evaluate(`localStorage.getItem('maplestory-flame-equipment')`)
  await equipmentButton('Remove equipment')
  assert.equal(await evaluate(`localStorage.getItem('maplestory-flame-equipment')`), savedBuild, 'removal waits for save')
  await equipmentButton('Discard changes')
  await until(() => evaluate(`document.querySelector('.equipment-setup [aria-label^="Hat:"]').getAttribute('aria-label') !== 'Hat: empty'`), 'discard restores item')
  await evaluate(`document.querySelector('.equipment-setup [aria-label^="Ring 4:"]').click()`)
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.equipment-catalog-item')).every(b => b.disabled)`), true, 'fixed ring stays fixed')
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.equipment-setup button')).some(b => b.textContent.trim() === 'Remove equipment')`), false)
  await evaluate(`document.querySelector('.equipment-setup [aria-label^="Hat:"]').click()`)
  for (const width of [1440, 900, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:1100,deviceScaleFactor:1,mobile:false})
    await evaluate(`window.scrollTo(0,0)`)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Equipment fits ${width}px`)
    const shot = await command('Page.captureScreenshot', {format:'png'})
    await writeFile(join(captures, `equipment-${width}.png`), Buffer.from(shot.data,'base64'))
  }
  await command('Page.navigate', {url:`http://127.0.0.1:${webPort}/equipment`})
  await until(() => evaluate(`!!document.querySelector('.workshop-equipment-slots')`), 'saved build reload')
  assert.equal(await evaluate(`localStorage.getItem('maplestory-flame-equipment')`), savedBuild, 'reload keeps saved schema and values')
  await evaluate(`document.querySelector('.equipment-setup [aria-label^="Hat:"]').click()`)
  await evaluate(`(() => {
    const saved = JSON.parse(localStorage.getItem('maplestory-flame-equipment'));
    saved.equipment.hat.current_star_force = 17;
    const data = new DataTransfer();
    data.items.add(new File([JSON.stringify({format:'maplestory-equipment',version:1,equipment_class:saved.equipment_class,equipment:saved.equipment})], 'build.json', {type:'application/json'}));
    const input = document.querySelector('input[aria-label="Import equipment JSON file"]'); input.files = data.files; input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`)
  await until(() => evaluate(`document.querySelector('.equipment-transfer-panel').textContent.includes('Equipment loaded into the preview')`), 'file import completes')
  await evaluate(`document.querySelector('.equipment-setup [aria-label^="Hat:"]').click()`)
  await until(() => evaluate(`document.querySelector('.equipment-summary').textContent.includes('17')`), 'imported preview retains recorded stars')
  assert.equal(await evaluate(`localStorage.getItem('maplestory-flame-equipment')`), savedBuild, 'import does not save implicitly')
  await equipmentButton('Save equips')
  await until(() => evaluate(`JSON.parse(localStorage.getItem('maplestory-flame-equipment')).equipment.hat.current_star_force === 17`), 'import applies through existing save')
  await evaluate(`Array.from(document.querySelectorAll('.equipment-section-navigation button')).find(b => b.textContent === 'Stats & upgrades').click()`)
  await until(() => evaluate(`!!document.querySelector('#equipment-stats-view .equipment-editor-panel')`), 'existing enhancement editor')
  assert.equal(await evaluate(`document.querySelector('#equipment-stats-view .equipment-editor-panel').textContent.includes('Eternal Knight Helm')`), true)
  await evaluate(`document.querySelector('.upgrade-plan form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.upgrade-recommendations .mw-skeleton-table')`), 'upgrade loading')
  await evaluate(`window.finishUpgradePlan()`)
  await until(() => evaluate(`!!document.querySelector('.workshop-rank-table tbody tr')`), 'upgrade recommendations')
  assert.equal(await evaluate(`document.querySelectorAll('.workshop-rank-table tbody tr').length`), 1, 'existing consecutive-star grouping preserved')
  assert.equal(await evaluate(`document.querySelector('.workshop-rank-table').textContent.includes('3,000,000')`), true, 'range costs unchanged')
  assert.equal(await evaluate(`document.querySelector('.workshop-rank-table').textContent.includes('17 → 19')`), true)
  await evaluate(`document.querySelector('.upgrade-row-details summary').click()`)
  assert.equal(await evaluate(`document.querySelector('.upgrade-row-details').open`), true)
  assert.equal(await evaluate(`document.querySelector('.upgrade-row-details').textContent.includes('0.2')`), true, 'existing boom totals preserved')
  for (const width of [1440, 900, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:1100,deviceScaleFactor:1,mobile:false})
    await evaluate(`document.querySelector('.upgrade-plan').scrollIntoView()`)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Upgrade order fits ${width}px`)
    if (width < 700) assert.equal(await evaluate(`getComputedStyle(document.querySelector('.workshop-rank-table tbody tr')).display`), 'block')
    const shot = await command('Page.captureScreenshot', {format:'png'})
    await writeFile(join(captures, `upgrade-order-${width}.png`), Buffer.from(shot.data,'base64'))
  }
  await evaluate(`Array.from(document.querySelectorAll('.upgrade-category-tabs button')).find(b => b.textContent === 'Overall').click()`)
  await until(() => evaluate(`!!document.querySelector('.overall-upgrade-table')`), 'overall recommendations')
  assert.equal(await evaluate(`document.querySelector('.overall-upgrade-table').textContent.includes('1M')`), true)
  await evaluate(`Array.from(document.querySelectorAll('.upgrade-category-tabs button')).find(b => b.textContent === 'Flames').click()`)
  await until(() => evaluate(`!!document.querySelector('.flame-upgrade-order .workshop-rank-table')`), 'flame recommendations')
  assert.equal(await evaluate(`document.querySelector('.flame-upgrade-order .workshop-rank-table caption').textContent.includes('Highest chance of improvement first')`), true)
  assert.equal(await evaluate(`document.querySelectorAll('.flame-confidence-table').length`), 2, 'existing flame confidence tables retained')
  await evaluate(`Array.from(document.querySelectorAll('.upgrade-category-tabs button')).find(b => b.textContent === 'Potential').click()`)
  await until(() => evaluate(`document.querySelector('.workshop-rank-table')?.textContent.includes('Better roll')`), 'potential recommendations')
  await go('/bug-report', 'bugs')
  await until(() => evaluate(`!!document.querySelector('.bug-form')`), 'workshop bug form')
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.bug-category-chips input')).map(i => i.value)`), ['Star Force','Star Force strategies','Potential','Flames','Equipment upgrade','Navigation / display','Other'])
  await evaluate(`(() => { for (const [name,value] of Object.entries({summary:'Example issue',steps:'Open calculator',expected:'Expected result',actual:'Different result',environment:'Test browser',contact:'Discord: example'})) {
    const el=document.querySelector('.bug-form [name="'+name+'"]'); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true}));
  } })()`)
  await evaluate(`document.querySelector('.bug-category-chips input[value="Navigation / display"]').click(); document.querySelector('.bug-form').requestSubmit()`)
  await until(() => evaluate(`!!document.querySelector('.bug-preview')`), 'report review')
  await evaluate(`document.querySelector('.bug-report-actions button').click()`)
  await until(() => evaluate(`!!document.querySelector('.bug-report-actions .mw-spinner')`), 'report submitting')
  assert.equal(await evaluate(`document.querySelector('.bug-fields').disabled`), true)
  const reportPayload = await evaluate(`window.workshopRequests.filter(r => r.path.endsWith('/api/bug-reports')).at(-1).payload`)
  assert.deepEqual({...reportPayload, request_id:undefined}, {area:'Navigation / display',summary:'Example issue',steps:'Open calculator',expected:'Expected result',actual:'Different result',environment:'Test browser',contact:'Discord: example',request_id:undefined})
  assert.match(reportPayload.request_id, /^[a-f0-9-]{36}$/)
  await evaluate(`window.failBugReport()`)
  await until(() => evaluate(`!!document.querySelector('.bug-error[role="alert"]')`), 'report failure')
  assert.equal(await evaluate(`document.querySelector('.bug-form [name="actual"]').value`), 'Different result')
  await evaluate(`document.querySelector('.bug-report-actions button').click()`)
  await until(() => evaluate(`!!document.querySelector('.bug-report-actions .mw-spinner')`), 'report retry')
  assert.deepEqual(await evaluate(`window.workshopRequests.filter(r => r.path.endsWith('/api/bug-reports')).at(-1).payload`), reportPayload, 'retry preserves payload and request ID')
  await evaluate(`window.finishBugReport()`)
  await until(() => evaluate(`!!document.querySelector('.bug-success[role="status"]')`), 'report success')
  assert.equal(await evaluate(`document.querySelector('.bug-form [name="summary"]').value`), 'Example issue', 'successful submission retains original form behavior')
  assert.equal(await evaluate(`document.querySelector('.bug-report-actions button').disabled`), true)
  assert.equal(await evaluate(`document.querySelector('.bug-success').textContent.includes('workshop-test-123')`), true)
  for (const width of [1440, 390, 320]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:1100,deviceScaleFactor:1,mobile:false})
    await evaluate(`window.scrollTo(0,0)`)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Bug report fits ${width}px`)
    const shot = await command('Page.captureScreenshot', {format:'png'})
    await writeFile(join(captures, `bug-report-${width}.png`), Buffer.from(shot.data,'base64'))
  }
  assert.deepEqual(exceptions, [], 'real shell has no runtime errors')
})
