import { createElement as h } from 'react'
import { PAGE_CONTENT, pageMetadata } from '../data/pageContent.js'
import { PAGE_PATHS } from '../data/routes.js'

// Shared by the static build and interactive app so searchable content stays identical.
export function PageHeader({ page }) {
  const content = pageMetadata(page)
  return h('header', { className: 'page-header' },
    h('span', { className: 'eyebrow' }, 'MAPLESTORY CALCULATOR · EQUIPMENT UPGRADE LAB'),
    h('div', { className: 'page-title' },
      page === 'home' && h('img', { className: 'page-logo', src: '/maplecalculator.png',
        alt: 'MapleStory Calculator logo', width: 72, height: 72 }),
      h('h1', null, content.heading)),
    h('p', null, content.description))
}

export function PageGuide({ page, onNavigate }) {
  const content = PAGE_CONTENT[page]
  if (!content?.sections.length) return null
  return h('section', { className: 'panel page-guide', 'aria-label': 'Calculator guide' },
    ...content.sections.map(([heading, text]) => h('section', { key: heading },
      h('h2', null, heading), h('p', null, text))),
    h('h2', null, 'Model scope and data sources'),
    h('p', null, 'These calculators use the app’s bundled rules and tables, not live game data. ',
      'Potential uses KMS Legendary probabilities with GMS line-value adjustments; equipment comes from a GMS catalog. ',
      'Flame and Star Force estimates follow the implemented model and selected settings. ',
      'Do not assume every regional patch or event is represented.'),
    h('p', null, h('a', { href: 'https://maplestory.nexon.com/Guide/OtherProbability/cube/black' }, 'Nexon cube probability disclosures'),
      ' · ', h('a', { href: 'https://maplestory.io/' }, 'MapleStory.io equipment data'),
      ' · ', h('a', { href: PAGE_PATHS.bugs, onClick: event => onNavigate?.('bugs', event) }, 'Report an incorrect result')),
    h('nav', { 'aria-label': 'Related calculators' },
      ...Object.entries(PAGE_CONTENT).filter(([key]) => key !== page && key !== 'bugs').map(([key, value]) =>
        h('a', { key, href: PAGE_PATHS[key], onClick: event => onNavigate?.(key, event) }, value.heading))))
}
