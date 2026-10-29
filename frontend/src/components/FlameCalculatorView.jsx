import { motion } from 'framer-motion'
import { CalculatorPanel, ResultCard, StatCard, SectionHeader } from '../ui/layout'
import { InputField, SelectField, Toggle, PrimaryButton } from '../ui/controls'
import { EmptyState } from '../ui/feedback'
import { CalculatorLoadingOverlay, LoadingButtonContent } from '../ui/loading'
import TargetRequirementRow from '../ui/TargetRequirementRow'
import { useWorkshopMotion } from '../ui/motion'
import { CLASS_STATS } from '../data/classStats'
import { WEAPON_KINDS, WEAPON_SERIES } from '../data/flameWeapons'
import { count, percentage } from '../data/numberFormat'
import RollBudget from './RollBudget'
import FlameDistributionChart from './FlameDistributionChart'
import AnimatedNumber from '../ui/AnimatedNumber'

export default function FlameCalculatorView({ form, classStats, isWeapon, weaponChoices, weaponKind, weaponConfig, update, busy, error, result, submit }) {
  const { reduced, transition } = useWorkshopMotion()
  const mainStats = [classStats.main].flat().join(' / ')
  const offense = classStats.offense === 'MATT' ? 'Magic attack' : 'Attack'
  const field = name => ({ name, value: form[name], onChange: update })
  const weight = name => ({ ...field(name), type: 'number', min: '0', step: 'any', required: true })
  return <div className="flame-workspace">
    <form className="flame-form" onSubmit={submit} aria-label="Flame settings">
      <CalculatorPanel title="Flame Setup" className="flame-setup">
      <fieldset disabled={busy} className="flame-form-panels">
        <legend className="sr-only">Flame settings</legend>
                  <div className="flame-item-summary">
            <span className="flame-item-icon" aria-hidden="true">{isWeapon ? '⚔' : '◇'}</span>
            <div><h3>{isWeapon ? `${WEAPON_SERIES[form.weapon_series].label} ${WEAPON_KINDS[weaponKind].label}` : 'Custom armor'}</h3>
              <div className="flame-tags"><span>Lv. {isWeapon ? weaponConfig.equipment_level : form.equipment_level}</span><span>{isWeapon ? 'Weapon' : 'Armor'}</span>{(isWeapon || form.boss_equipment) && <span>Boss equipment</span>}</div>
            </div>
          </div>
          <p className="flame-type-summary">{form.flame_type !== 'powerful' && <img src={`/images/flames/${form.flame_type}.png`} alt="" width="28" height="28" />}<span>{form.flame_type} flame · {form.maple_class}</span></p>

        <div className="flame-selection">
          <h3 className="flame-subheading">Item Selection</h3>
          <div className="flame-selection-fields">
          <SelectField label="MapleStory class" {...field('maple_class')}>
            {Object.keys(CLASS_STATS).sort().map(name => <option key={name}>{name}</option>)}
          </SelectField>
          <p className="mw-help">Stats: {mainStats} primary, {classStats.secondary.length ? `${classStats.secondary.join(' / ')} secondary` : 'no secondary stat'}, {classStats.offense}</p>
          <SelectField label="Equipment type" {...field('equipment_type')}>
            <option value="armor">Armor</option><option value="weapon">Weapon</option>
          </SelectField>
          <InputField label="Equipment level" name="equipment_level" type="number" min="1" max="300" required
            value={isWeapon ? weaponConfig.equipment_level : form.equipment_level} readOnly={isWeapon} onChange={update} />
          {isWeapon && <div className="flame-weapon-settings">
            <SelectField label="Weapon series" {...field('weapon_series')}>
              {Object.entries(WEAPON_SERIES).map(([value, series]) => <option key={value} value={value}>{series.label}</option>)}
            </SelectField>
            <SelectField label="Weapon kind" name="weapon_kind" value={weaponKind} onChange={update} disabled={weaponChoices.length === 1}>
              {weaponChoices.map(kind => <option key={kind} value={kind}>{WEAPON_KINDS[kind].label}</option>)}
            </SelectField>
            <InputField label={`Base ${offense.toLowerCase()}`} type="number" value={weaponConfig.base_weapon_offense} readOnly />
            <p className="mw-help">Clean {classStats.offense} before flames, scrolling, or Star Force. Level and boss equipment are set automatically for this weapon series.</p>
          </div>}
          <SelectField label="Flame type" {...field('flame_type')} required>
            <option value="powerful">Powerful</option><option value="black">Black</option><option value="abyssal">Abyssal</option>
          </SelectField>
          <Toggle label="Boss equipment" name="boss_equipment" checked={isWeapon || form.boss_equipment} disabled={isWeapon} onChange={update} />
          </div>
        </div>
        <div className="flame-targets">
          <div className="flame-section">
            <SectionHeader title="Target Flame Options" description="Reach at least this weighted flame score." />
            <TargetRequirementRow label="Target flame score" {...field('target_score')} step="any" required />
          </div>
          <div className="flame-section">
            <SectionHeader title="Stat Priority" description="Set the points contributed by each stat." />
            <div className="flame-tags flame-priorities"><span>{mainStats}</span><span>All Stat %</span><span>{offense}</span><span>Boss Damage %</span></div>
            <div className="flame-weights">
              <InputField label="All-stat % value" {...weight('all_stat_pct_value')} />
              {classStats.secondary.length > 0 && <InputField label="Points per secondary stat" {...weight('secondary_stat_value')} />}
              <InputField label={`${offense} value`} {...weight('attack_value')} />
              <InputField label="Boss damage % value" {...weight('boss_damage_pct_value')} aria-describedby="boss-damage-weight-hint" />
            </div>
            <p id="boss-damage-weight-hint" className="mw-help">Weights apply to the flame score used by the calculator.</p>
          </div>
          <PrimaryButton type="submit" disabled={busy} className="w-full"><LoadingButtonContent busy={busy}>Calculate odds</LoadingButtonContent></PrimaryButton>
        </div>
      </fieldset>
      </CalculatorPanel>
    </form>
    <ResultCard title="Flame odds" busy={busy} className="flame-result mw-budget-surface">
      <CalculatorLoadingOverlay loading={busy} label="Calculating your flame score…">
        <div className="flame-result-content">
          {!busy && (error ? <p className="flame-error" role="alert">{error}</p> : !result ?
            <EmptyState title="What are you flaming for?" description="Choose your flame setup and target score, then calculate to see your probability." /> :
            <motion.div initial={reduced ? false : { opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={transition}>
              <div className="flame-metrics">
                <StatCard label="Probability" value={<AnimatedNumber value={result.percentage} format={percentage} initialValue={0} />} unit="%" />
                <StatCard label="Expected Attempts" value={result.probability === 0 ? 'No finite average' : <AnimatedNumber value={result.one_in} format={count} initialValue={0} />} unit={result.probability === 0 ? undefined : 'flames'} />
              </div>
              <p className="mw-help">{result.probability === 0 ? 'This flame score cannot occur.' : result.probability === 1 ? 'Guaranteed on every roll.' : `Approximately 1 in ${count(result.one_in)} rolls`}</p>
              {result.probability === 0 && <p className="mw-help">Try lowering your target score or changing the equipment.</p>}
              <FlameDistributionChart bins={result.score_distribution} target={result.target_score} />
              <div className="flame-outcome"><h3>Target outcome</h3><strong>Flame score ≥ {result.target_score}</strong><p className="mw-help">The chance per roll of reaching at least your target flame score.</p></div>
              <RollBudget probability={result.probability} defaultCost={1} itemLabel="Flame" countOnly />
            </motion.div>)}
        </div>
      </CalculatorLoadingOverlay>
    </ResultCard>
  </div>
}
