import { DEFAULT_LADDERING } from '../data/laddering'

export default function EquipmentLaddering({ item, cap, onChange }) {
  const settings = item.laddering
  return <section className="equipment-laddering" aria-label="Laddering settings">
    <h4>Laddering with a second copy</h4>
    <label className="starforce-safeguard-control">
      <input type="checkbox" checked={!!settings} onChange={event => onChange({ laddering: event.target.checked
        ? { ...DEFAULT_LADDERING, start_star: Math.min(cap, Math.max(17, item.currentStarForce ?? 0)) } : undefined })} />
      <span>Configure laddering for this item</span>
    </label>
    {settings && <>
      <p className="hint">In Overall laddering mode, keep the equipped copy safe once it reaches the starting star below. Enhance a second copy of the same item, then swap when its combined score improves. Edit the second copy using the copy selector above.</p>
      <div className="upgrade-weights">
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
      <p className="hint">The calculator determines the minimum flame and potential scores needed to improve your total score at each target star, including preparation costs for enabled roll categories. Record the second copy's actual stats; missing stats count as zero. Both copies are assumed owned and potential is Legendary; acquisition and tier-up costs are excluded.</p>
    </>}
  </section>
}
