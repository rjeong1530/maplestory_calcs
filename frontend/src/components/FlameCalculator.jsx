import LoadingStatus from './LoadingStatus'
import { CLASS_WEAPONS, WEAPON_KINDS, WEAPON_SERIES, getWeaponConfig } from '../data/flameWeapons'
import { CLASS_STATS } from '../data/classStats'
import RollBudget from './RollBudget'

import { count, percentage } from '../data/numberFormat'

export default function FlameCalculator({ form, setForm, calculation }) {
  const { busy, error, result, submit } = calculation
  const classStats = CLASS_STATS[form.maple_class]
  const isWeapon = form.equipment_type === 'weapon'
  const weaponChoices = CLASS_WEAPONS[form.maple_class]
  const weaponKind = weaponChoices.includes(form.weapon_kind) ? form.weapon_kind : weaponChoices[0]
  const weaponConfig = getWeaponConfig(form.maple_class, form.weapon_series, weaponKind)

  function update(event) {
    calculation.clear()
    const { name, value, type, checked } = event.target
    setForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'maple_class' ? {
        weapon_kind: CLASS_WEAPONS[value].includes(current.weapon_kind)
          ? current.weapon_kind : CLASS_WEAPONS[value][0],
      } : {}),
    }))
  }

  return (
      <div className="calculator-grid">
      <form className="panel flame-form" onSubmit={submit}>
        <fieldset disabled={busy} className="flame-settings">
        <legend>Flame settings</legend>

        <label>
          MapleStory class
          <select name="maple_class" value={form.maple_class} onChange={update}>
            {Object.keys(CLASS_STATS).sort().map(mapleClass => (
              <option key={mapleClass} value={mapleClass}>
                {mapleClass}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          Stats: {[classStats.main].flat().join(' / ')} primary,
          {' '}{classStats.secondary.length ? `${classStats.secondary.join(' / ')} secondary` : 'no secondary stat'},
          {' '}{classStats.offense}
        </p>

        <label>
          Equipment level
          <input
            name="equipment_level"
            type="number"
            min="1"
            max="300"
            value={isWeapon ? weaponConfig.equipment_level : form.equipment_level}
            readOnly={isWeapon}
            onChange={update}
            required
          />
        </label>

        <label>
          Equipment type
          <select name="equipment_type" value={form.equipment_type} onChange={update}>
            <option value="armor">Armor</option>
            <option value="weapon">Weapon</option>
          </select>
        </label>

        {isWeapon && (
          <div className="flame-weapon-settings">
            <div className="flame-fields">
              <label>Weapon series
                <select name="weapon_series" value={form.weapon_series} onChange={update}>
                  {Object.entries(WEAPON_SERIES).map(([value, series]) => (
                    <option key={value} value={value}>{series.label}</option>
                  ))}
                </select>
              </label>
              <label>Weapon kind
                <select name="weapon_kind" value={weaponKind} onChange={update}
                  disabled={weaponChoices.length === 1}>
                  {weaponChoices.map(kind => (
                    <option key={kind} value={kind}>{WEAPON_KINDS[kind].label}</option>
                  ))}
                </select>
              </label>
              <label>Base {classStats.offense === 'MATT' ? 'magic attack' : 'attack'}
                <input type="number" value={weaponConfig.base_weapon_offense} readOnly />
              </label>
            </div>
            <p className="hint">Clean {classStats.offense} before flames, scrolling, or Star Force.
              {' '}Level and boss equipment are set automatically for this weapon series.</p>
          </div>
        )}

        <label>
          Flame type
          <select name="flame_type" value={form.flame_type} onChange={update} required>
            <option value="powerful">Powerful</option>
            <option value="black">Black</option>
            <option value="abyssal">Abyssal</option>
          </select>
        </label>

        <label className="flame-checkbox">
          <input
            name="boss_equipment"
            type="checkbox"
            checked={isWeapon || form.boss_equipment}
            disabled={isWeapon}
            onChange={update}
          />
          Boss equipment
        </label>

        <h3>Score weights</h3>
        <label>
          All-stat % value
          <input
            name="all_stat_pct_value"
            type="number"
            min="0"
            step="any"
            value={form.all_stat_pct_value}
            onChange={update}
            required
          />
        </label>
        {classStats.secondary.length > 0 && <label>
          Points per secondary stat
          <input
            name="secondary_stat_value"
            type="number"
            min="0"
            step="any"
            value={form.secondary_stat_value}
            onChange={update}
            required
          />
        </label>}
        <label>
          Attack value
          <input
            name="attack_value"
            type="number"
            min="0"
            step="any"
            value={form.attack_value}
            onChange={update}
            required
          />
        </label>

        <label>
            Boss damage % value
            <input
              name="boss_damage_pct_value"
              type="number"
              min="0"
              step="any"
              value={form.boss_damage_pct_value}
              onChange={update}
              aria-describedby="boss-damage-weight-hint"
              required
            />
        </label>

        <label className="flame-target">
          Target flame score
          <input
            name="target_score"
            type="number"
            step="any"
            value={form.target_score}
            onChange={update}
            required
          />
        </label>

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Calculating…' : 'Calculate odds'}
        </button>
        </fieldset>
      </form>

      <section className="panel results" aria-live="polite" aria-busy={busy}>
        <span className="eyebrow">YOUR ODDS</span>
        <h2>Flame odds</h2>
        {busy ? <LoadingStatus>Calculating your flame score…</LoadingStatus>
          : error ? <p className="error" role="alert">{error}</p>
          : !result ? (
            <div className="empty">
              <span className="text-[56px] text-[#a0967c]" aria-hidden="true">◇</span>
              <h3>What are you flaming for?</h3>
              <p>Choose your flame setup and target score, then calculate to see your probability.</p>
            </div>
          ) : (
          <>
            <div className="probability">{percentage(result.percentage)}<span>%</span></div>
            <p className="text-[#d0cec3] text-[14px] mt-2.25">{result.probability === 0 ? 'This flame score cannot occur.'
              : result.probability === 1 ? 'Guaranteed on every roll.'
                : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
            {result.probability === 0 && <p className="hint">Try lowering your target score or changing the equipment.</p>}
            <p className="hint mt-5.5 mb-0">The chance per roll of reaching at least your target flame score.</p>
            <RollBudget probability={result.probability} defaultCost={1} itemLabel="Flame" countOnly />
          </>
        )}
      </section>
      </div>
  )
}
