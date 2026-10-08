import test from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest } from '../api.js'

test('calculation requests have time to queue while reads retain a shorter timeout', async t => {
  const timeouts = []
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    timeouts.push(milliseconds)
    return new AbortController().signal
  })
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({}) }))
  await apiRequest('/api/options')
  await apiRequest('/api/starforce-estimate', { method: 'POST' })
  assert.deepEqual(timeouts, [30000, 90000])
})

test('caller cancellation does not disable the request timeout', async t => {
  const timeout = new AbortController()
  const caller = new AbortController()
  t.mock.method(AbortSignal, 'timeout', () => timeout.signal)
  t.mock.method(globalThis, 'fetch', async (path, { signal }) => {
    timeout.abort(new DOMException('Timed out', 'TimeoutError'))
    signal.throwIfAborted()
  })
  await assert.rejects(apiRequest('/api/options', { signal: caller.signal }), /timed out/)
  assert.equal(caller.signal.aborted, false)
})

test('caller abort remains cancellation instead of a connection error', async t => {
  const caller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (path, { signal }) => {
    caller.abort()
    signal.throwIfAborted()
  })
  await assert.rejects(apiRequest('/api/options', { signal: caller.signal }), { name: 'AbortError' })
})

test('timeouts while reading the response body report a timeout', async t => {
  const timeout = new AbortController()
  t.mock.method(AbortSignal, 'timeout', () => timeout.signal)
  t.mock.method(globalThis, 'fetch', async (path, { signal }) => ({ ok: true, json: async () => {
    timeout.abort(new DOMException('Timed out', 'TimeoutError'))
    signal.throwIfAborted()
  } }))
  await assert.rejects(apiRequest('/api/options'), /timed out/)
})

test('successful requests and server validation errors retain their behavior', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ status: 'ok' }) }))
  assert.deepEqual(await apiRequest('/api/health'), { status: 'ok' })
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ detail: [{ msg: 'Invalid stat' }] }) })
  await assert.rejects(apiRequest('/api/options'), /Invalid stat/)
})
