import { PAGE_PATHS } from '../data/routes'

const tools = [
  {
    page: 'potential', title: 'Potential calculator', category: 'CUBING',
    description: 'Find the odds of your target lines and the cube budget to get there.',
  },
  {
    page: 'flame', title: 'Flame calculator', category: 'BONUS STATS',
    description: 'Set a flame score. Check your chances with each flame type.',
  },
  {
    page: 'starforce', title: 'Star Force calculator', category: 'ENHANCEMENT',
    description: 'Compare meso costs, safeguards, and boom risk before you tap.',
  },
  {
    page: 'equipment', title: 'Equipment upgrade', category: 'YOUR CHARACTER',
    description: 'Save your gear, record its stats, and compare which upgrade gives you the most for your mesos.',
  },
]

export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-tools grid grid-cols-2 items-start gap-8 max-[700px]:grid-cols-1">
      {[
        { id: 'calculators', label: 'Calculators', items: tools.filter(tool => tool.page !== 'equipment') },
        { id: 'equipment', label: 'Equipment tools', items: tools.filter(tool => tool.page === 'equipment') },
      ].map(({ id, label, items }) => (
        <section className="min-w-0" key={id} aria-labelledby={`landing-${id}-heading`}>
          <h2 id={`landing-${id}-heading`} className="m-0 border-b border-rule pb-4 text-[16px] font-semibold">{label}</h2>
          <div>
            {items.map(({ page, title, category, description }) => (
              <article className="border-b border-rule py-5" key={page}>
                <span className="eyebrow">{category}</span>
                <h3 className="mt-2.5 mb-2 text-[22px] font-semibold tracking-tight">
                  <a className="flex items-center justify-between gap-4 text-inherit no-underline hover:text-maple hover:underline underline-offset-[5px]"
                    href={PAGE_PATHS[page]} onClick={event => onNavigate(page, event)}>
                    {title}<span className="shrink-0 text-maple" aria-hidden="true">↗</span>
                  </a>
                </h3>
                <p className="m-0 text-[14px] leading-[1.7] text-muted">{description}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
