import assert from 'node:assert/strict'
import test from 'node:test'
import { PAGE_PATHS, pageForPath, isPlainNavigation } from './routes.js'

test('root and calculator/equipment URLs resolve to their pages', () => {
  assert.equal(pageForPath('/'), 'home')
  for (const [page, path] of Object.entries(PAGE_PATHS)) {
    assert.equal(pageForPath(path), page)
    assert.equal(pageForPath(`${path}/`), page)
  }
  assert.equal(pageForPath('/unknown'), null)
  assert.equal(pageForPath('/calculators/flames/unknown'), null)
})

test('only ordinary left clicks are handled by client navigation', () => {
  assert.equal(isPlainNavigation({ button: 0 }), true)
  for (const flag of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented']) {
    assert.equal(isPlainNavigation({ button: 0, [flag]: true }), false)
  }
  assert.equal(isPlainNavigation({ button: 1 }), false)
  assert.equal(isPlainNavigation({ button: 2 }), false)
})
