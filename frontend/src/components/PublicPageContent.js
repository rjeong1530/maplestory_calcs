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
  return h('section', { className: `panel page-guide bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5
      [&.page-guide]:mt-10 [&.page-guide]:pt-8 [&.page-guide]:px-0 [&.page-guide]:pb-0 [&.page-guide]:border-0
      [&.page-guide]:border-t [&.page-guide]:border-solid [&.page-guide]:border-t-rule [&.page-guide]:rounded-none
      [&.page-guide]:bg-transparent [&_h2]:mt-0 [&_h2]:mx-0 [&_h2]:mb-3 [&_h2]:text-[#eeede6] [&_h2]:text-[18px]
      [&_h2]:leading-[1.4] [&_p]:m-0 [&_p]:text-muted [&_p]:text-[14px] [&_p]:leading-[1.8] [&_a]:text-maple
      [&_a]:text-[13px] [&_a]:[text-underline-offset:4px] [&_a]:[overflow-wrap:anywhere] [&_a:hover]:text-[#f2ce91]
      [&_a:focus-visible]:outline-offset-[4px] [&_a:focus-visible]:rounded-sm`, 'aria-label': 'Calculator guide' },
    h('header', { className: "page-guide-heading mb-7 [&_h2]:mt-2.5 [&_h2]:text-[clamp(22px,_3vw,_28px)]" },
      h('span', { className: "eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple" }, 'CALCULATOR GUIDE'),
      h('h2', null, 'Understand your next upgrade'),
      h('p', null, 'Practical examples, scoring assumptions, and how to read your results.')),
    h('div', { className: "page-guide-sections grid grid-cols-2 gap-y-7 gap-x-9 [@media(max-width:640px)]:grid-cols-1" },
      ...content.sections.map(([heading, text, id]) => h('section', { key: heading, id, className: "min-w-0 border-t border-rule pt-5" },
        h('h2', null, heading), h('p', null, text)))),
    h('aside', { className: "page-guide-sources mt-8 p-5.5 border border-solid border-rule border-l-[3px] border-l-maple rounded-sm bg-ink [@media(max-width:640px)]:p-4.5", 'aria-label': 'Model scope and data sources' },
    h('h2', null, 'Model scope and data sources'),
    h('p', null, 'These calculators use the app’s bundled rules and tables, not live game data. ',
      'Potential uses KMS Legendary probabilities with GMS line-value adjustments; equipment comes from a GMS catalog. ',
      'Flame and Star Force estimates follow the implemented model and selected settings. ',
      'Do not assume every regional patch or event is represented.'),
    h('div', { className: "page-guide-source-links flex flex-wrap gap-y-2.5 gap-x-6 mt-4" },
      h('a', { href: 'https://maplestory.nexon.com/Guide/OtherProbability/cube/black' }, 'Nexon cube probability disclosures'),
      h('a', { href: 'https://maplestory.io/' }, 'MapleStory.io equipment data'),
      h('a', { href: PAGE_PATHS.bugs, onClick: event => onNavigate?.('bugs', event) }, 'Report an incorrect result'))),
    h('footer', { className: "mt-7" },
    h('span', { className: "eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple" }, 'EXPLORE OTHER TOOLS'),
    h('nav', { className: `page-guide-related grid grid-cols-2 gap-2.5 mt-3.5 [@media(max-width:640px)]:grid-cols-1 [&_a]:flex
      [&_a]:items-center [&_a]:justify-between [&_a]:gap-3 [&_a]:py-3 [&_a]:px-4 [&_a]:min-h-11 [&_a]:border
      [&_a]:border-solid [&_a]:border-rule [&_a]:rounded-sm [&_a]:no-underline [&_a]:bg-ink [&_a:hover]:border-maple
      [&_a:hover]:bg-[#373022]`, 'aria-label': 'Related calculators' },
      ...Object.keys(RELATED_LABELS).filter(key => key !== page).map(key =>
        h('a', { key, href: PAGE_PATHS[key], onClick: event => onNavigate?.(key, event) },
          RELATED_LABELS[key], h('span', { 'aria-hidden': true }, '→'))))))
}
