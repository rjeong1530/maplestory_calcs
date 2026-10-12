import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PAGE_CONTENT, SITE_URL, pageMetadata } from '../src/data/pageContent.js'
import { PAGE_PATHS } from '../src/data/routes.js'
import { PageHeader, PageGuide } from '../src/components/PublicPageContent.js'

const output = fileURLToPath(new URL('../dist/', import.meta.url))
const template = await readFile(join(output, 'index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) throw new Error('Missing prerender root in built index.html')

for (const page of Object.keys(PAGE_CONTENT)) {
  const { title, description, canonical } = pageMetadata(page)
  const metadata = renderToStaticMarkup(h('title', null, title))
    + renderToStaticMarkup(h('meta', { name: 'description', content: description }))
    + renderToStaticMarkup(h('link', { rel: 'canonical', href: canonical }))
    + renderToStaticMarkup(h('meta', { property: 'og:title', content: title }))
    + renderToStaticMarkup(h('meta', { property: 'og:description', content: description }))
    + renderToStaticMarkup(h('meta', { property: 'og:url', content: canonical }))
  const body = renderToStaticMarkup(h('main', null,
    h('nav', { className: 'main-navigation', 'aria-label': 'Main navigation' },
      ...Object.entries(PAGE_CONTENT).map(([key, content]) => h('a', {
        key, href: PAGE_PATHS[key], 'aria-current': key === page ? 'page' : undefined,
      }, key === 'home' ? 'Home' : content.heading))),
    h(PageHeader, { page }),
    h('p', null, 'The interactive tools load with JavaScript. The guide and links below are available without it.'),
    h(PageGuide, { page })))
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\s+(?:name="description"|property="og:(?:title|description)")[^>]*>/g, '')
    .replace('</head>', `${metadata}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
  const path = join(output, PAGE_PATHS[page].slice(1), 'index.html')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, html)
  // Vite preview resolves extensionless URLs via .html; directory hosts use index.html.
  if (page !== 'home') await writeFile(join(output, `${PAGE_PATHS[page].slice(1)}.html`), html)
}

// Use the same route list for discovery and generated pages.
const urls = Object.keys(PAGE_CONTENT)
  .map(page => `  <url><loc>${SITE_URL}${PAGE_PATHS[page]}</loc></url>`).join('\n')
await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
console.log(`Prerendered ${Object.keys(PAGE_CONTENT).length} public pages.`)
