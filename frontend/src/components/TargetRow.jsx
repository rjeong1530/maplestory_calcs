import { effectLabels } from '../ui/potentialLabels'

export default function TargetRow({ row, index, effects, usedEffects, onUpdate, onRemove, canRemove }) {
  const cooldown = row.effect === 'COOLDOWN_SEC'
  return (
    <div className="target-row grid grid-cols-[minmax(0,_1fr)_116px_32px] items-end gap-2.5
        [@media(max-width:480px)]:grid-cols-[minmax(0,_1fr)_88px_28px] [@media(max-width:480px)]:gap-1.75">
      <label>Potential {index + 1}
        <select value={row.effect} onChange={event => onUpdate({ effect: event.target.value })}>
          {effects.map(effect => (
            <option key={effect} value={effect} disabled={usedEffects.includes(effect)}>
              {effectLabels[effect] ?? effect}
            </option>
          ))}
        </select>
      </label>
      <label>At least ({cooldown ? 'seconds' : '%'})
        <input type="number" min="0" step="any" required value={row.target}
          onChange={event => onUpdate({ target: event.target.value })} />
      </label>
      <button type="button" className="p-0 h-[43px] text-[23px] bg-transparent enabled:hover:bg-[#3c3a32]" disabled={!canRemove}
        aria-label={`Remove potential ${index + 1}`} onClick={onRemove}>×</button>
    </div>
  )
}
