const effectLabels = {
  STR_PCT: 'STR %', DEX_PCT: 'DEX %', INT_PCT: 'INT %', LUK_PCT: 'LUK %',
  ALL_STAT_PCT: 'All Stat %',
  MAX_HP_PCT: 'Max HP %', MAX_MP_PCT: 'Max MP %', ATT_PCT: 'Attack %',
  MAGIC_ATT_PCT: 'Magic attack %', BOSS_DAMAGE_PCT: 'Boss damage %',
  DAMAGE_PCT: 'Damage %', IED_PCT: 'Ignore enemy defense %',
  CRIT_RATE_PCT: 'Critical rate %', CRIT_DAMAGE_PCT: 'Critical damage %',
  MESO_PCT: 'Meso obtained %', DROP_PCT: 'Item drop rate %',
  COOLDOWN_SEC: 'Cooldown reduction',
}

export default function TargetRow({ row, index, effects, usedEffects, onUpdate, onRemove, canRemove }) {
  const cooldown = row.effect === 'COOLDOWN_SEC'
  return (
    <div className="target-row">
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
      <button type="button" className="remove" disabled={!canRemove}
        aria-label={`Remove potential ${index + 1}`} onClick={onRemove}>×</button>
    </div>
  )
}
