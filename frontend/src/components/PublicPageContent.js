import { createElement as h } from 'react'
import { PAGE_CONTENT, pageMetadata } from '../data/pageContent.js'
import { PAGE_PATHS } from '../data/routes.js'

const RELATED_LABELS = {
  home: 'All Calculators',
  starforce: 'Star Force Calculator',
  flame: 'Flame Calculator',
  potential: 'Potential and Cube Calculator',
  equipment: 'Equipment Upgrade Planner',
}

// Shared by the static build and interactive app so searchable content stays identical.
export function PageHeader({ page }) {
  const content = pageMetadata(page)
  return h('header', { className: 'page-header' },
    h('span', { className: 'eyebrow' }, 'MAPLESTORY CALCULATOR · EQUIPMENT UPGRADE LAB'),
    h('div', { className: 'page-title' },
      h('img', { className: 'page-logo', src: '/maplecalculator48.png',
        alt: 'MapleStory Calculator logo', width: 48, height: 48 }),
      h('h1', null, content.heading)),
    h('p', null, content.description))
}

export function PageGuide({ page, onNavigate }) {
  const content = PAGE_CONTENT[page]
  if (!content?.sections.length) return null
  return h('section', { className: 'panel page-guide', 'aria-label': 'Calculator guide' },
    h('header', { className: 'page-guide-heading' },
      h('span', { className: 'eyebrow' }, 'CALCULATOR GUIDE'),
      h('h2', null, 'Understand your next upgrade'),
      h('p', null, 'Practical examples, scoring assumptions, and how to read your results.')),
    h('div', { className: 'page-guide-sections' },
      ...content.sections.map(([heading, text]) => h('section', { key: heading, className: 'page-guide-section' },
        h('h2', null, heading), h('p', null, text)))),
    h('aside', { className: 'page-guide-sources', 'aria-label': 'Model scope and data sources' },
    h('h2', null, 'Model scope and data sources'),
    h('p', null, 'These calculators use the app’s bundled rules and tables, not live game data. ',
      'Potential uses KMS Legendary probabilities with GMS line-value adjustments; equipment comes from a GMS catalog. ',
      'Flame and Star Force estimates follow the implemented model and selected settings. ',
      'Do not assume every regional patch or event is represented.'),
    h('div', { className: 'page-guide-source-links' },
      h('a', { href: 'https://maplestory.nexon.com/Guide/OtherProbability/cube/black' }, 'Nexon cube probability disclosures'),
      h('a', { href: 'https://maplestory.io/' }, 'MapleStory.io equipment data'),
      h('a', { href: PAGE_PATHS.bugs, onClick: event => onNavigate?.('bugs', event) }, 'Report an incorrect result'))),
    h('footer', { className: 'page-guide-footer' },
    h('span', { className: 'eyebrow' }, 'EXPLORE OTHER TOOLS'),
    h('nav', { className: 'page-guide-related', 'aria-label': 'Related calculators' },
      ...Object.keys(RELATED_LABELS).filter(key => key !== page).map(key =>
        h('a', { key, href: PAGE_PATHS[key], onClick: event => onNavigate?.(key, event) },
          RELATED_LABELS[key], h('span', { 'aria-hidden': true }, '→'))))))
}
