import assert from 'node:assert/strict'
import test from 'node:test'
import { PAGE_PATHS, pageForPath, isPlainNavigation, navigateToPage } from './routes.js'

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

test('navigation preserves browser handling for new tabs and downloads', () => {
  for (const currentTarget of [
    { target: '_blank' }, { target: 'another-window' },
    { hasAttribute: name => name === 'download' },
  ]) {
    assert.equal(isPlainNavigation({ button: 0, currentTarget }), false)
  }
  assert.equal(isPlainNavigation({ button: 0, currentTarget: { target: '_self' } }), true)
})

test('navigation changes the URL and scrolls once, without duplicate history entries', () => {
  const pushes = []
  const scrolls = []
  const browser = {
    location: { pathname: '/' },
    history: { pushState: (...args) => {
      pushes.push(args)
      browser.location.pathname = args[2]
    } },
    scrollTo: (...args) => scrolls.push(args),
  }
  let prevented = 0
  const event = { button: 0, preventDefault: () => prevented++ }
  assert.equal(navigateToPage('equipment', event, browser), '/equipment')
  assert.deepEqual(pushes, [[null, '', '/equipment']])
  assert.deepEqual(scrolls, [[0, 0]])
  browser.location.pathname = '/equipment/'
  assert.equal(navigateToPage('equipment', event, browser), null)
  assert.equal(prevented, 2)
  for (const page of ['missing', 'toString', '__proto__']) {
    assert.equal(navigateToPage(page, event, browser), null)
  }
  assert.equal(navigateToPage('home', { ...event, ctrlKey: true }, browser), null)
  assert.equal(prevented, 2)
  assert.equal(pushes.length, 1)
  assert.equal(scrolls.length, 1)
  assert.equal(navigateToPage('home', undefined, browser), '/')
})
