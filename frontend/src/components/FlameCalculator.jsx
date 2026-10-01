import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { CLASS_WEAPONS, WEAPON_KINDS, WEAPON_SERIES, getWeaponConfig } from '../data/flameWeapons'
import { restoreEquipment, serializeEquipment, exportEquipment, importEquipment } from '../data/equipmentSave'
import EquipmentWindow from './EquipmentWindow'
import EquipmentUpgradePlan from './EquipmentUpgradePlan'
import { restoreUpgradeSettings } from '../data/equipmentUpgrade'
import { equipInSlot, compatibleEquipment } from '../data/flameEquipment'

const count = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
const percentage = value => value > 0 && value < 0.000001
  ? value.toExponential(3) : new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)

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
  boss_damage_pct_value: '10',
  target_score: '120',
}

const EQUIPMENT_COOKIE = 'maplestory-flame-equipment'
const SCORE_WEIGHT_FIELDS = [
  'all_stat_pct_value',
  'secondary_stat_per_main',
  'attack_value',
  'boss_damage_pct_value',
]

function readEquipmentCookie() {
  const cookie = document.cookie.split('; ').find(value => value.startsWith(`${EQUIPMENT_COOKIE}=`))
  if (!cookie) return {}
  try {
    const savedSelection = JSON.parse(decodeURIComponent(cookie.slice(EQUIPMENT_COOKIE.length + 1)))
    return savedSelection && typeof savedSelection === 'object' ? savedSelection : {}
  } catch {
    return {}
  }
}

function restoreScoreWeights(savedWeights) {
  return Object.fromEntries(SCORE_WEIGHT_FIELDS.map(field => {
    const value = savedWeights?.[field]
    return [field, value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
      ? String(value) : initialForm[field]]
  }))
}

export default function FlameCalculator({ activeTab, onTabChange }) {
  const [savedSelection] = useState(readEquipmentCookie)
  const savedClass = CLASS_STATS[savedSelection.maple_class] ? savedSelection.maple_class : initialForm.maple_class
  const savedEquipmentClass = CLASS_STATS[savedSelection.equipment_class]
    ? savedSelection.equipment_class : savedClass
  const [form, setForm] = useState(() => ({
    ...initialForm,
    maple_class: savedClass,
    ...restoreScoreWeights(savedSelection.score_weights),
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [equipmentClass, setEquipmentClass] = useState(savedEquipmentClass)
  const [equipment, setEquipment] = useState(() =>
    restoreEquipment(savedSelection.equipment, savedEquipmentClass))
  const [activeSlot, setActiveSlot] = useState(null)
  const [upgradeSettings, setUpgradeSettings] = useState(() =>
    restoreUpgradeSettings(savedSelection.upgrade_settings))

  useEffect(() => {
    const savedEquipment = serializeEquipment(equipment)
    document.cookie = `${EQUIPMENT_COOKIE}=${encodeURIComponent(JSON.stringify({
      maple_class: form.maple_class,
      equipment_class: equipmentClass,
      equipment: savedEquipment,
      score_weights: Object.fromEntries(SCORE_WEIGHT_FIELDS.map(field => [field, form[field]])),
      upgrade_settings: upgradeSettings,
    }))}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [equipment, equipmentClass, form, upgradeSettings])

  const classStats = CLASS_STATS[form.maple_class]
  const isWeapon = form.equipment_type === 'weapon'
  const weaponChoices = CLASS_WEAPONS[form.maple_class]
  const weaponKind = weaponChoices.includes(form.weapon_kind) ? form.weapon_kind : weaponChoices[0]
  const weaponConfig = getWeaponConfig(form.maple_class, form.weapon_series, weaponKind)

  function selectEquipment(slot, item) {
    setEquipment(current => {
      const previous = current[slot]
      const selected = previous?.id === item.id
        ? { ...item, currentPotential: previous.currentPotential, currentFlames: previous.currentFlames,
          currentFlameType: previous.currentFlameType, currentBossEquipment: previous.currentBossEquipment,
          currentStarForce: previous.currentStarForce ?? 0, starForceModes: previous.starForceModes,
          starForceSafeguards: previous.starForceSafeguards }
        : { ...item, currentStarForce: 0, currentPotential: [], currentFlames: [], currentFlameType: form.flame_type,
          currentBossEquipment: item.config.boss_equipment ?? form.boss_equipment }
      return equipInSlot(current, slot, selected)
    })
    setActiveSlot(slot)
    setResult(null)
    setError('')
  }

  function updateEquipmentRoll(slot, updates) {
    setEquipment(current => current[slot] ? {
      ...current,
      [slot]: { ...current[slot], ...updates },
    } : current)
  }

  function removeEquipment(slot) {
    setEquipment(current => {
      const next = { ...current }
      delete next[slot]
      return next
    })
    if (activeSlot === slot) setActiveSlot(null)
    setResult(null)
    setError('')
  }

  function updateEquipmentClass(value) {
    setEquipmentClass(value)
    const compatible = compatibleEquipment(equipment, value)
    setEquipment(compatible)
    if (!compatible[activeSlot]) setActiveSlot(null)
  }

  function importEquipmentJson(text) {
    const imported = importEquipment(text)
    setEquipmentClass(imported.equipmentClass)
    setEquipment(imported.equipment)
    setActiveSlot(null)
    setResult(null)
    setError('')
  }

  function update(event) {
    setResult(null)
    setError('')
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
          boss_damage_pct_value: Number(form.boss_damage_pct_value),
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
    activeTab === 'equipment' ? (
      <>
      <EquipmentWindow equipmentClass={equipmentClass}
        mapleClasses={Object.keys(CLASS_STATS).sort()}
        onMapleClassChange={updateEquipmentClass} equipment={equipment}
        activeSlot={activeSlot} onActivate={setActiveSlot} onSelect={selectEquipment}
        onRemove={removeEquipment} busy={busy} classStats={CLASS_STATS[equipmentClass]}
        onUpdateEquipmentRoll={updateEquipmentRoll}
        onExport={() => exportEquipment(equipment, equipmentClass)}
        onImport={importEquipmentJson} />
      <EquipmentUpgradePlan equipment={equipment} equipmentClass={equipmentClass}
        classStats={CLASS_STATS[equipmentClass]} flameWeights={form}
        settings={upgradeSettings} onSettingsChange={setUpgradeSettings}
        onFlameWeightChange={(key, value) => {
          setForm(current => ({ ...current, [key]: value }))
          setResult(null)
          setError('')
        }} />
      </>
    ) : (
      <div className="calculator-grid">
        <div className="equipment-tab-link">
          <p className="hint">{Object.keys(equipment).length
            ? `${Object.keys(equipment).length} item${Object.keys(equipment).length === 1 ? '' : 's'} equipped`
            : 'Track current potential and flames for your equipment.'}</p>
          <button type="button" onClick={() => onTabChange('equipment')}>
            Manage equipment
          </button>
        </div>
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
        {busy ? <p role="status">Calculating your flame score…</p>
          : error ? <p className="error" role="alert">{error}</p>
          : !result ? (
            <div className="empty">
              <span className="empty-icon" aria-hidden="true">◇</span>
              <h3>What are you flaming for?</h3>
              <p>Choose your flame setup and target score, then calculate to see your probability.</p>
            </div>
          ) : (
          <>
            <div className="probability">{percentage(result.percentage)}<span>%</span></div>
            <p className="odds">{result.probability === 0 ? 'This flame score cannot occur.'
              : result.probability === 1 ? 'Guaranteed on every roll.'
                : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
            {result.probability === 0 && <p className="hint">Try lowering your target score or changing the equipment.</p>}
            <p className="hint result-note">The chance per roll of reaching at least your target flame score.</p>
          </>
        )}
      </section>
      </div>
    )
  )
}
