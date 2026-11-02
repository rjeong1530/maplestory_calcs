import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PAGE_CONTENT, SITE_URL } from '../src/data/pageContent.js'
import { PAGE_PATHS } from '../src/data/routes.js'

test('built public pages expose unique metadata, guides and navigation without JavaScript', async () => {
  assert.deepEqual(Object.keys(PAGE_CONTENT).sort(), Object.keys(PAGE_PATHS).sort())
  const titles = new Set()
  const descriptions = new Set()
  for (const [page, content] of Object.entries(PAGE_CONTENT)) {
    const html = await readFile(new URL(`../dist${PAGE_PATHS[page] === '/' ? '' : PAGE_PATHS[page]}/index.html`, import.meta.url), 'utf8')
    const titlesOnPage = [...html.matchAll(/<title>(.*?)<\/title>/g)]
    assert.equal(titlesOnPage.length, 1)
    titles.add(titlesOnPage[0][1])
    assert.equal((html.match(/name="description"/g) || []).length, 1)
    descriptions.add(html.match(/name="description" content="([^"]+)"/)[1])
    assert.match(html, /name="robots" content="index,follow"/)
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1)
    assert.ok(html.includes(`href="${SITE_URL}${PAGE_PATHS[page]}"`))
    assert.ok(html.includes(`<h1>${content.heading}</h1>`))
    for (const [heading] of content.sections) assert.ok(html.includes(`<h2>${heading}</h2>`))
    for (const path of Object.values(PAGE_PATHS)) assert.ok(html.includes(`href="${path}"`))
    assert.match(html, /<script type="module"[^>]+src="\/assets\//)
    assert.doesNotMatch(html, /noindex/)
    if (page !== 'home') {
      assert.equal(await readFile(new URL(`../dist${PAGE_PATHS[page]}.html`, import.meta.url), 'utf8'), html)
    }
  }
  assert.equal(titles.size, Object.keys(PAGE_CONTENT).length)
  assert.equal(descriptions.size, Object.keys(PAGE_PATHS).length)
  const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8')
  assert.equal((sitemap.match(/<loc>/g) || []).length, Object.keys(PAGE_PATHS).length)
  for (const page of Object.keys(PAGE_CONTENT)) {
    assert.ok(sitemap.includes(`<loc>${SITE_URL}${PAGE_PATHS[page]}</loc>`))
  }
  const robots = await readFile(new URL('../dist/robots.txt', import.meta.url), 'utf8')
  assert.match(robots, /User-agent: \*\s+Allow: \/\s/)
  assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`))
  assert.doesNotMatch(robots, /Disallow:\s*\//)
})
