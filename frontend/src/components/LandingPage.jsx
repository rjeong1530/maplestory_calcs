import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PAGE_PATHS } from '../data/routes'
import { readEquipmentSelection, EQUIPMENT_STORAGE_KEY } from '../data/equipmentStorage'
import { restoreEquipment } from '../data/equipmentSave'
import { CLASS_STATS } from '../data/classStats'
import { FIXED_RING_SLOT } from '../data/flameEquipment'
import { ContentCard, SectionHeader } from '../ui/layout'
import { PrimaryButton } from '../ui/controls'
import { EmptyState } from '../ui/feedback'
import { useWorkshopMotion } from '../ui/motion'
import WorkshopEquipmentGrid from './WorkshopEquipmentGrid'
import './equipment-workshop.css'
import './home-workshop.css'

const tools = [
  { page: 'starforce', title: 'Star Force Calculator', image: '/images/workshop/star.webp', description: 'Calculate enhancement costs, success rates, and expected mesos from 0 to 30 stars.' },
  { page: 'flame', title: 'Flame Calculator', image: '/images/flames/black.png', description: 'Find the probability of desired flame stats and estimate the rolls needed to reach your target.' },
  { page: 'potential', title: 'Potential Calculator', image: '/images/workshop/glowing-bright-cubes.png', imageWidth: 148, description: 'Calculate potential probabilities, expected cubes, and costs for your target stats.' },
  { page: 'equipment', title: 'Equipment Upgrade Planner', icon: '▥', description: 'Compare upgrade options and find the most cost-efficient path for your character.' },
]

export default function LandingPage({ onNavigate }) {
  const { reduced, transition, hover, press } = useWorkshopMotion()
  const [saved, setSaved] = useState(() => readEquipmentSelection())
  useEffect(() => {
    const refresh = event => { if (!event.key || event.key === EQUIPMENT_STORAGE_KEY) setSaved(readEquipmentSelection()) }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])
  const equipmentClass = Object.hasOwn(CLASS_STATS, saved.equipment_class) ? saved.equipment_class
    : Object.hasOwn(CLASS_STATS, saved.maple_class) ? saved.maple_class : 'Hero'
  const equipment = useMemo(() => restoreEquipment(saved.equipment, equipmentClass), [saved.equipment, equipmentClass])
  const hasBuild = Object.keys(equipment).some(slot => slot !== FIXED_RING_SLOT)
  const enter = delay => ({ initial: reduced ? false : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { ...transition, duration: reduced ? 0 : .24, delay: reduced ? 0 : delay } })
  const link = page => ({ href: PAGE_PATHS[page], onClick: event => onNavigate(page, event) })

  return <div className="workshop-home">
    <header className="home-hero">
      <motion.p {...enter(0)} className="home-eyebrow">YOUR NEXT UPGRADE STARTS HERE</motion.p>
      <motion.h1 {...enter(0)}>Plan Smarter.<br />Upgrade Further.</motion.h1>
      <motion.p {...enter(.04)} className="home-subtitle">Calculate costs, probabilities, and optimize your MapleStory equipment upgrades in one place.</motion.p>
      <motion.div {...enter(.08)} className="home-hero-actions">
        <PrimaryButton className="home-start" onClick={() => {
          const cards = document.getElementById('home-calculators')
          cards?.focus({ preventScroll: true })
          cards?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })
        }}>Start Calculating <span aria-hidden="true">→</span></PrimaryButton>
        <motion.a {...link('equipment')} className="mw-button mw-button-secondary" whileHover={hover} whileTap={press} transition={transition}>View Upgrade Planner</motion.a>
      </motion.div>
    </header>
    <section id="home-calculators" tabIndex={-1} aria-label="Calculators and equipment planner" className="home-tools">
      {tools.map((tool, index) => <ContentCard key={tool.page} className={`home-tool home-tool-${tool.page}`} {...enter(index * .04)} whileHover={reduced ? undefined : { y: -4 }}>
        <a {...link(tool.page)} className="home-tool-link">
          <span className="home-tool-icon" aria-hidden="true">{tool.image ? <img src={tool.image} width={tool.imageWidth || 52} height="52" alt="" /> : tool.page === 'equipment'
              ? <svg width="52" height="52" viewBox="0 0 48 48" fill="none"><rect x="5" y="27" width="9" height="16" rx="2" fill="#6ee7b7" stroke="#218858" strokeWidth="2"/><rect x="20" y="17" width="9" height="26" rx="2" fill="#34d399" stroke="#218858" strokeWidth="2"/><rect x="35" y="5" width="9" height="38" rx="2" fill="#10b981" stroke="#218858" strokeWidth="2"/></svg>
              : tool.icon}</span>
          <h2>{tool.title}</h2><p>{tool.description}</p>
          <span className="home-tool-cta">{tool.page === 'equipment' ? 'Open Planner' : 'Open Calculator'} <span aria-hidden="true">→</span></span>
        </a>
      </ContentCard>)}
    </section>
    <div className="home-dashboard">
      <ContentCard className="home-character" initial={reduced ? false : { opacity: 0, y: 8 }} animate={undefined} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1 }}>
        <SectionHeader title="Your Character" />
        {hasBuild ? <div className="home-build">
          <div className="home-build-info"><div className="home-build-summary"><span className="home-class">{equipmentClass}</span>
            <span className="mw-help">{Object.keys(equipment).length} equipped items</span></div>
            <motion.a {...link('equipment')} className="mw-button mw-button-primary" whileHover={hover} whileTap={press} transition={transition}>Continue Build <span aria-hidden="true">→</span></motion.a>
          </div>
          <div className="home-equipment-preview" aria-label="Saved equipment preview">
            <WorkshopEquipmentGrid equipment={equipment} activeSlot={null} href={PAGE_PATHS.equipment} onActivate={(_slot, event) => onNavigate('equipment', event)} />
          </div>
        </div> : <EmptyState title="No equipment build yet." description="Create a build to compare upgrades across your entire character."
          action={<motion.a {...link('equipment')} className="mw-button mw-button-primary" whileHover={hover} whileTap={press} transition={transition}>Create Equipment Build</motion.a>} />}
      </ContentCard>
      <ContentCard className="home-workflow" initial={reduced ? false : { opacity: 0, y: 8 }} animate={undefined} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1 }}>
        <SectionHeader title="A little planning. A better upgrade." description="Make your mesos go further in three steps." />
        <ol>{[
          ['Choose Your Equipment', 'Pick your item or load the equipment you already saved.'],
          ['Configure Your Upgrade', 'Set your targets, events, and stat priorities.'],
          ['Compare Expected Results', 'Review the odds and costs before spending your mesos.'],
        ].map(([title, description], index) => <li key={title}><span aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
        <a {...link('bugs')} className="home-help-link">Something look wrong? Report a bug <span aria-hidden="true">→</span></a>
      </ContentCard>
    </div>
  </div>
}
