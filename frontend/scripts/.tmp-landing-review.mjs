// Runs in a fresh Firefox profile; never reads or changes a user's browser data.
// Requires Firefox and geckodriver (GECKODRIVER_PATH or on PATH).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { writeFile } from 'node:fs/promises'
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
  await command(`/session/${session}/url`, { url: `http://127.0.0.1:${webPort}/` })
  await until(() => execute("return !!document.querySelector('.landing-tools')"), 'equipment load')

  await command('/session/'+session+'/window/rect',{width:1280,height:950});
  await writeFile('.landing-review.png',Buffer.from(await command('/session/'+session+'/screenshot'),'base64'));
  assert.equal(await execute("return document.querySelector('#landing-calculators-heading').textContent"),'Calculators');
  for(const width of [390,320]){
    const frame=await execute(`const f=document.createElement('iframe');f.src=location.href;f.style.cssText='width:'+arguments[0]+'px;height:940px;border:0';document.body.replaceChildren(f);return f`,width);
    await command('/session/'+session+'/frame',{id:frame});
    await until(()=>execute("return !!document.querySelector('.landing-tools')"),'mobile home');
    assert.equal(await execute("return document.documentElement.scrollWidth>innerWidth"),false);
    assert.equal(await execute("return getComputedStyle(document.querySelector('.landing-tools')).gridTemplateColumns.split(' ').length"),1);
    await command('/session/'+session+'/frame',{id:null});
  }
});
