import { PAGE_PATHS } from '../data/routes'
import './LandingPage.css'

const tools = [
  {
    page: 'potential', title: 'Potential calculator', category: 'CUBING',
    description: 'Choose your equipment and desired potential stats to estimate the chance of rolling them together. See how many cubes you need for your chosen chances of success.',
  },
  {
    page: 'flame', title: 'Flame calculator', category: 'BONUS STATS',
    description: 'Set your class, equipment, flame type, and stat weights to calculate the chance of reaching a target flame score on a single roll.',
  },
  {
    page: 'starforce', title: 'Star Force calculator', category: 'ENHANCEMENT',
    description: 'Estimate the mesos, attempts, and destruction risk involved in reaching your target stars. Compare enhancement modes and safeguard settings.',
  },
  {
    page: 'equipment', title: 'Equipment upgrade', category: 'YOUR CHARACTER',
    description: 'Build your equipment set and record its current stars, potentials, and flames. Compare possible upgrades and their expected stat gains per meso to plan what to improve next.',
  },
]

export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-tools">
      {[
        { id: 'calculators', label: 'Calculator', items: tools.filter(tool => tool.page !== 'equipment') },
        { id: 'equipment', label: 'Equipment tools', items: tools.filter(tool => tool.page === 'equipment') },
      ].map(({ id, label, items }) => (
        <section className="landing-tool-group" key={id} aria-labelledby={`landing-${id}-heading`}>
          <h2 id={`landing-${id}-heading`} className="landing-group-heading">{label}</h2>
          <div className="landing-group-cards">
            {items.map(({ page, title, category, description }) => (
              <article className="landing-card" key={page}>
                <span className="eyebrow">{category}</span>
                <h3>
                  <a href={PAGE_PATHS[page]} onClick={event => onNavigate(page, event)}>
                    {title}<span aria-hidden="true">↗</span>
                  </a>
                </h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
