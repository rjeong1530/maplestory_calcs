import LoadingStatus from './LoadingStatus'
import { LoadingButtonContent } from '../ui/loading'
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
      <div className="calculator-grid grid grid-cols-[1.2fr_1fr] gap-6 items-start [@media(max-width:850px)]:grid-cols-1">
      <form className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5 flame-form" onSubmit={submit}>
        <fieldset disabled={busy} className="flame-settings [&_>_label.flame-target]:my-7 [&_>_label.flame-target]:text-[20px]
        [&_>_label.flame-target]:text-[#eeede6] [&_>_label.flame-target]:gap-3 [&_>_label]:mb-4">
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
        <p className="hint text-[12px] text-muted mb-4.5">
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
          <div className="flame-weapon-settings my-5 mx-0 p-4 border border-solid border-rule rounded-sm [&_.hint]:mb-0">
            <div className="flame-fields grid grid-cols-2 gap-y-4 gap-x-3 [@media(max-width:480px)]:grid-cols-1">
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
            <p className="hint text-[12px] text-muted mb-4.5">Clean {classStats.offense} before flames, scrolling, or Star Force.
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

        <label className="flame-checkbox flex-row items-center gap-2 mt-4.5 [&_input]:w-4 [&_input]:h-4 [&_input]:accent-maple [&_input]:m-0">
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

        <label className="flame-target [&_input]:py-4.5 [&_input]:px-4 [&_input]:text-[24px] [&_input]:font-bold [&_input]:text-maple [&_input]:border-[#a0967c]">
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

        <button type="submit" className="primary w-full font-bold bg-maple text-[#201b12] border-maple p-3.5 [&:hover:not(:disabled)]:bg-[#f2ce91]" disabled={busy}>
          <LoadingButtonContent busy={busy}>Calculate odds</LoadingButtonContent>
        </button>
        </fieldset>
      </form>

      <section className="panel results bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5 [&_h2]:mt-3 [&_h2]:text-[22px]" aria-live="polite" aria-busy={busy}>
        <span className="eyebrow font-mono text-[11px] font-bold tracking-[0.08em] text-maple">YOUR ODDS</span>
        <h2>Flame odds</h2>
        {busy ? <LoadingStatus variant="result">Calculating your flame score…</LoadingStatus>
          : error ? <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{error}</p>
          : !result ? (
            <div className="empty pt-8.5 px-0 pb-3 border-t border-solid border-t-rule mt-6 text-muted text-[14px] [&_h3]:text-[#eeede6] [&_h3]:mt-5">
              <span className="text-[56px] text-[#a0967c]" aria-hidden="true">◇</span>
              <h3>What are you flaming for?</h3>
              <p>Choose your flame setup and target score, then calculate to see your probability.</p>
            </div>
          ) : (
          <>
            <div className="probability font-mono text-[clamp(27px,_4vw,_42px)] font-bold tracking-[-0.04em] mt-7.5 text-maple
        [overflow-wrap:anywhere] [&_span]:text-[24px] [&_span]:ml-1">{percentage(result.percentage)}<span>%</span></div>
            <p className="text-[#d0cec3] text-[14px] mt-2.25">{result.probability === 0 ? 'This flame score cannot occur.'
              : result.probability === 1 ? 'Guaranteed on every roll.'
                : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
            {result.probability === 0 && <p className="hint text-[12px] text-muted mb-4.5">Try lowering your target score or changing the equipment.</p>}
            <p className="hint text-[12px] text-muted mt-5.5 mb-0">The chance per roll of reaching at least your target flame score.</p>
            <RollBudget probability={result.probability} defaultCost={1} itemLabel="Flame" countOnly />
          </>
        )}
      </section>
      </div>
  )
}
