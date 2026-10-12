// Runs in a fresh Firefox profile; never reads or changes a user's browser data.
// Requires Firefox and geckodriver (GECKODRIVER_PATH or on PATH).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PAGE_CONTENT, SITE_URL } from '../src/data/pageContent.js'
import { PAGE_PATHS, pageForPath } from '../src/data/routes.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function port() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const value = server.address().port
  await new Promise(resolve => server.close(resolve))
  return value
}

test('production frontend performance', { timeout: 180000 }, async t => {
  const webPort = await port()
  const driverPort = await port()
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
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
      args: ['-headless', '-no-remote'], prefs: { 'permissions.default.image': 2, 'browser.cache.disk.enable': false, 'browser.cache.memory.enable': false },
    },
  } } })).sessionId
  const execute = (script, ...args) => command(`/session/${session}/execute/sync`, { script, args })
  const sample = JSON.parse(await readFile(new URL('../../examples/equipment/hero.json', import.meta.url), 'utf8'))
  const results = []
  for (const [page, path] of Object.entries(PAGE_PATHS)) {
    const response = await fetch(`http://127.0.0.1:${webPort}${path}`)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.ok(html.includes(`<h1>${PAGE_CONTENT[page].heading}</h1>`), `Static heading for ${path}`)
    assert.ok(html.includes(`href="${SITE_URL}${path}"`), `Static canonical for ${path}`)
  }
  for (const [name, path, selector, equipped] of [
    ['home', '/', '.landing-tools', false],
    ['equipment setup', '/equipment', '.equipment-setup', false],
    ['equipment stats', '/equipment', '#equipment-stats-view:not([hidden])', true],
    ['starforce', '/calculators/starforce', 'input[name="item_level"]', false],
    ['flames', '/calculators/flames', 'input[name="target_score"]', false],
  ]) {
    const runs = []
    for (let repeat = 0; repeat < 5; repeat++) {
      await command(`/session/${session}/url`, { url: `http://127.0.0.1:${webPort}/` })
      await execute(`localStorage.clear(); if (arguments[0]) localStorage.setItem('maplestory-flame-equipment', JSON.stringify(arguments[0]));`,
        equipped ? { ...sample, maple_class: 'Hero' } : null)
      await command(`/session/${session}/url`, { url: `http://127.0.0.1:${webPort}${path}` })
      const result = await command(`/session/${session}/execute/async`, {
        script: `const selector = arguments[0], done = arguments[arguments.length - 1];
          const start = performance.now();
          function check() {
            if (![...document.querySelectorAll(selector)].some(node => node.getClientRects().length)) {
              if (performance.now() - start > 10000) return done({error: 'Missing ' + selector});
              return requestAnimationFrame(check);
            }
            requestAnimationFrame(() => requestAnimationFrame(() => {
              const resources = performance.getEntriesByType('resource');
              done({readyMs: performance.now(), domNodes: document.querySelectorAll('*').length,
                scriptsBytes: resources.filter(r => /\\.js(?:$|\\?)/.test(r.name)).reduce((n,r) => n+r.decodedBodySize,0),
                apiRequests: resources.filter(r => r.name.includes('/api/')).map(r => new URL(r.name).pathname)});
            }));
          } check();`, args: [selector],
      })
      assert.ok(!result.error, result.error)
      assert.equal(await execute('return document.title'), PAGE_CONTENT[pageForPath(path)].title)
      runs.push(result)
    }
    const median = key => runs.map(r => r[key]).sort((a,b) => a-b)[2]
    results.push({ name, medianReadyMs: median('readyMs'), medianDomNodes: median('domNodes'), medianScriptBytes: median('scriptsBytes'), runs })
    console.log(JSON.stringify(results.at(-1)))
  }
  await writeFile(process.env.BENCHMARK_OUTPUT || 'rendering-benchmark.json', JSON.stringify({
    date: new Date().toISOString().slice(0, 10), browser: 'Headless Firefox', mode: 'Vite production preview; cache disabled; external images disabled; local API availability unchanged',
    note: 'Ready includes WebDriver scheduling and two animation frames; not isolated React CPU duration or internet load time.', results,
  }, null, 2) + '\n')
})

