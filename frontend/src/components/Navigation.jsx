import { PAGE_PATHS } from '../data/routes'
import { Navbar } from '../ui/navigation'

export default function Navigation({ activePage, onNavigate }) {
  const link = (page, label) => ({ label, href: PAGE_PATHS[page], active: activePage === page,
    onClick: event => onNavigate(page, event) })
  return <Navbar brandHref={PAGE_PATHS.home} onBrandClick={event => onNavigate('home', event)} links={[
    link('home', 'Home'),
    { label: 'Calculators', children: [link('starforce', 'Star Force Calculator'), link('flame', 'Flame Calculator'), link('potential', 'Potential Calculator')] },
    link('equipment', 'Upgrade Planner'),
    { label: 'Guides', href: '#workshop-guides' },
    { label: 'About', href: '#about-workshop' },
    link('bugs', 'Report a bug'),
  ]} />
}
