import { useState } from 'react'
import { apiRequest } from '../api'
import { CLASS_WEAPONS, WEAPON_KINDS, WEAPON_SERIES, getWeaponConfig } from '../data/flameWeapons'

const CLASS_STATS = {
  Hero: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  Paladin: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  'Dark Knight': { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  'Arch Mage (Fire/Poison)': { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  'Arch Mage (Ice/Lightning)': { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  Bishop: { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  Bowmaster: { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Marksman: { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Pathfinder: { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  NightLord: { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  Shadower: { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  'Dual Blade': { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  Buccaneer: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  Corsair: { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Cannoneer: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },

  'Dawn Warrior': { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  'Blaze Wizard': { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  'Wind Archer': { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  'Night Walker': { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  'Thunder Breaker': { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  Mihile: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },

  Aran: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  Evan: { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  Mercedes: { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Phantom: { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  Luminous: { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  Shade: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },

  Blaster: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  'Battle Mage': { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  'Wild Hunter': { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Mechanic: { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Xenon: { main: 'STR', secondary: ['DEX', 'LUK'], offense: 'ATT' },
  'Demon Slayer': { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  'Demon Avenger': { main: 'HP', secondary: ['STR'], offense: 'ATT' },

  Kaiser: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  'Angelic Buster': { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Cadena: { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  Kain: { main: 'DEX', secondary: ['STR'], offense: 'ATT' },
  Adele: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  Illium: { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  Ark: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  Khali: { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  Hoyoung: { main: 'LUK', secondary: ['DEX'], offense: 'ATT' },
  Lara: { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  Kinesis: { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
  Hayato: { main: 'STR', secondary: ['DEX'], offense: 'ATT' },
  Kanna: { main: 'INT', secondary: ['LUK'], offense: 'MATT' },
}

const initialForm = {
  equipment_level: '150',
  equipment_type: 'armor',
  boss_equipment: true,
  flame_type: 'black',
  maple_class: 'Hero',
  weapon_series: 'fafnir',
  weapon_kind: 'two_handed_sword',
  all_stat_pct_value: '10',
  secondary_stat_per_main: '10',
  attack_value: '3',
  target_score: '120',
}

export default function FlameCalculator() {
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const classStats = CLASS_STATS[form.maple_class]
  const isWeapon = form.equipment_type === 'weapon'
  const weaponChoices = CLASS_WEAPONS[form.maple_class]
  const weaponConfig = getWeaponConfig(form.maple_class, form.weapon_series, form.weapon_kind)

  function update(event) {
    setResult(null)
    setError('')
    const { name, value, type, checked } = event.target
    setForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'maple_class' ? { weapon_kind: CLASS_WEAPONS[value][0] } : {}),
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)

    const payload = {
      config: {
        equipment_level: Number(form.equipment_level),
        equipment_type: form.equipment_type,
        boss_equipment: form.boss_equipment,
        flame_type: form.flame_type,
        main_stat: classStats.main,
        secondary_stats: classStats.secondary,
        offense_stat: classStats.offense,
        ...(isWeapon ? weaponConfig : {}),
        weights: {
          all_stat_pct_value: Number(form.all_stat_pct_value),
          secondary_stat_per_main: Number(form.secondary_stat_per_main),
          attack_value: Number(form.attack_value),
        },
      },
      target_score: Number(form.target_score),
    }

    try {
      setResult(await apiRequest('/api/flame-probability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
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
          Stats: {classStats.main} main, {classStats.secondary.join('/')} secondary,
          {' '}{classStats.offense}
        </p>

        <label>
          Equipment level
          <input
            name="equipment_level"
            type="number"
            min="1"
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
                <select name="weapon_kind" value={form.weapon_kind} onChange={update}
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
          <input name="flame_type" value={form.flame_type} onChange={update} required />
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
            step="any"
            value={form.all_stat_pct_value}
            onChange={update}
            required
          />
        </label>
        <label>
          Secondary stat per main stat
          <input
            name="secondary_stat_per_main"
            type="number"
            step="any"
            value={form.secondary_stat_per_main}
            onChange={update}
            required
          />
        </label>
        <label>
          Attack value
          <input
            name="attack_value"
            type="number"
            step="any"
            value={form.attack_value}
            onChange={update}
            required
          />
        </label>

        <label>
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

      <section className="panel" aria-live="polite">
        <h2>Flame odds</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {!result && !error && <p>Enter your flame setup to see the odds.</p>}
        {result && (
          <>
            <p>
              Chance per roll: <strong>{result.percentage.toFixed(6)}%</strong>
            </p>
            <p>
              Probability: <strong>{result.probability.toFixed(8)}</strong>
            </p>
            <p>
              Odds: <strong>
                {result.one_in == null
                  ? 'Not possible'
                  : `1 in ${result.one_in.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
              </strong>
            </p>
          </>
        )}
      </section>
    </div>
  )
}
