import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PAGE_CONTENT, SITE_URL } from '../src/data/pageContent.js'
import { PAGE_PATHS } from '../src/data/routes.js'

test('built public pages expose unique metadata, guides and navigation without JavaScript', async () => {
  const titles = new Set()
  for (const [page, content] of Object.entries(PAGE_CONTENT)) {
    const html = await readFile(new URL(`../dist${PAGE_PATHS[page] === '/' ? '' : PAGE_PATHS[page]}/index.html`, import.meta.url), 'utf8')
    const titlesOnPage = [...html.matchAll(/<title>(.*?)<\/title>/g)]
    assert.equal(titlesOnPage.length, 1)
    titles.add(titlesOnPage[0][1])
    assert.equal((html.match(/name="description"/g) || []).length, 1)
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1)
    assert.ok(html.includes(`href="${SITE_URL}${PAGE_PATHS[page]}"`))
    assert.ok(html.includes(`<h1>${content.heading}</h1>`))
    for (const [heading] of content.sections) assert.ok(html.includes(`<h2>${heading}</h2>`))
    for (const path of Object.values(PAGE_PATHS)) assert.ok(html.includes(`href="${path}"`))
    assert.match(html, /<script type="module"[^>]+src="\/assets\//)
    assert.doesNotMatch(html, /noindex/)
  }
  assert.equal(titles.size, Object.keys(PAGE_CONTENT).length)
  const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8')
  for (const page of Object.keys(PAGE_CONTENT).filter(page => page !== 'bugs')) {
    assert.ok(sitemap.includes(`<loc>${SITE_URL}${PAGE_PATHS[page]}</loc>`))
  }
})
