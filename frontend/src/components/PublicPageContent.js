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
  return h('header', { className: "page-header mt-9 mx-0 mb-8 pb-7 border-b border-solid border-b-rule [&_p]:max-w-190 [&_p]:mb-0 [&_p]:text-[14px] [&_p]:text-muted" },
    h('span', { className: "eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple" }, 'MAPLESTORY CALCULATOR · EQUIPMENT UPGRADE LAB'),
    h('div', { className: "page-title flex items-center gap-3.5 mt-3.5 mx-0 mb-2.5 [&_h1]:min-w-0 [&_h1]:m-0" },
      h('img', { className: "size-12 shrink-0", src: '/maplecalculator48.png',
        alt: 'MapleStory Calculator logo', width: 48, height: 48 }),
      h('h1', null, content.heading)),
    h('p', null, content.description))
}

export function PageGuide({ page, onNavigate }) {
  const content = PAGE_CONTENT[page]
  if (!content?.sections.length) return null
  return h('section', { className: 'page-guide', 'aria-label': 'Calculator guide' },
    h('header', { className: 'page-guide-heading' },
      h('span', { className: "eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple" }, 'CALCULATOR GUIDE'),
      h('h2', null, 'Understand your next upgrade'),
      h('p', null, 'Practical examples, scoring assumptions, and how to read your results.')),
    h('div', { className: 'page-guide-sections' },
      ...content.sections.map(([heading, text, id]) => h('section', { key: heading, id, className: 'page-guide-section' },
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
    h('span', { className: "eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple" }, 'EXPLORE OTHER TOOLS'),
    h('nav', { className: 'page-guide-related', 'aria-label': 'Related calculators' },
      ...Object.keys(RELATED_LABELS).filter(key => key !== page).map(key =>
        h('a', { key, href: PAGE_PATHS[key], onClick: event => onNavigate?.(key, event) },
          RELATED_LABELS[key], h('span', { 'aria-hidden': true }, '→'))))))
}
