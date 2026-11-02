import { DEFAULT_LADDERING, DEFAULT_TRANSFER } from '../data/laddering'

export default function EquipmentLaddering({ item, cap, onChange }) {
  const settings = item.laddering
  return <section className="equipment-laddering basis-[100%] min-w-0 border-t border-solid border-t-outline pt-4.5 [&_.hint]:my-3 [&_.hint]:mx-0 [&_.hint]:leading-[1.6]" aria-label="Laddering settings">
    <h4>Laddering with a second copy</h4>
    <label className="starforce-safeguard-control flex-row justify-center items-center gap-1.75 [@media(max-width:480px)]:gap-1
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:m-0">
      <input type="checkbox" checked={!!settings} onChange={event => onChange({ laddering: event.target.checked
        ? { ...DEFAULT_LADDERING, start_star: Math.min(cap, Math.max(17, item.currentStarForce ?? 0)) } : undefined })} />
      <span>Configure laddering for this item</span>
    </label>
    {settings && <>
      <p className="hint text-[12px] text-subtle mb-4.5">{settings.transfer ? 'Compare Gollux transfers and SoS recovery from the starting star below.' : 'Protect the equipped copy from the starting star below.'} Record spare stats using the copy selector above.</p>
      <div className="upgrade-weights grid grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] gap-4 mb-6
        [@media(max-width:480px)]:grid-cols-1 [&_legend]:text-[15px] [&_legend]:mb-3.5">
        <label>Start laddering at equipped stars
          <input type="number" min="0" max={cap} step="1"
            value={settings.start_star} onChange={event => {
              const start_star = Number(event.target.value)
              if (Number.isInteger(start_star) && start_star >= 0 && start_star <= cap) {
                onChange({ laddering: { ...settings, start_star } })
              }
            }} />
        </label>
      </div>
      {item.name === 'Source of Suffering' && <>
        <label className="starforce-safeguard-control flex-row justify-center items-center gap-1.75 [@media(max-width:480px)]:gap-1
        [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:m-0">
          <input type="checkbox" checked={!!settings.transfer} onChange={event => onChange({ laddering: {
            ...settings, transfer: event.target.checked ? { ...DEFAULT_TRANSFER } : null,
          } })} />
          <span>Compare Superior Gollux transfer and trace recovery</span>
        </label>
        {settings.transfer && <>
          <div className="upgrade-weights grid grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] gap-4 mb-6
        [@media(max-width:480px)]:grid-cols-1 [&_legend]:text-[15px] [&_legend]:mb-3.5">
            {[
              ['donor_star', 'Owned Gollux pendant stars', 0, settings.transfer.donor_target],
              ['donor_target', 'Maximum Gollux transfer stars', Math.max(16, settings.transfer.donor_star), 30],
              ['donor_cost_mesos', 'Cost per replacement Gollux pendant (mesos)', 0, 1e15],
              ['tier_up_cost_mesos', 'Expected Epic → Legendary tier-up cost (mesos)', 0, 1e15],
            ].map(([key, label, min, max]) => <label key={key}>{label}
              <input type="number" min={min} max={max} step="1" placeholder="Enter estimate"
                value={settings.transfer[key] ?? ''} onChange={event => {
                  const value = event.target.value === '' && key === 'tier_up_cost_mesos' ? null : Number(event.target.value)
                  if (value === null || (Number.isInteger(value) && value >= min && value <= max)) {
                    onChange({ laddering: { ...settings, transfer: { ...settings.transfer, [key]: value } } })
                  }
                }} />
            </label>)}
          </div>
          <p className="hint text-[12px] text-subtle mb-4.5">Compare equipped and spare transfers in the recommended steps. Enter donor and tier-up costs above. <a href="#sos-transfer-guide">Transfer rules and assumptions</a></p>
        </>}
      </>}
      {!settings.transfer && <details className="upgrade-notes mt-5 text-[13px] leading-[1.7] [&_summary]:cursor-pointer [&_li]:mb-2">
        <summary>How spare scores and costs are calculated</summary>
        <p className="hint text-[12px] text-subtle mb-4.5">The calculator determines the minimum flame and potential scores needed to improve your total score at each target star, including preparation costs for enabled roll categories. Record the second copy's actual stats; missing stats count as zero. Both copies are assumed owned and potential is Legendary; acquisition and tier-up costs are excluded.</p>
      </details>}
    </>}
  </section>
}
