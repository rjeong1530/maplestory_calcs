import { AnimatePresence, motion } from 'framer-motion'
import { CalculatorPanel } from '../ui/layout'
import { SelectField, SegmentedControl, Toggle, PrimaryButton, SecondaryButton } from '../ui/controls'
import { RarityBadge } from '../ui/equipment'
import { LoadingButtonContent } from '../ui/loading'
import { useWorkshopMotion } from '../ui/motion'
import LoadingStatus from './LoadingStatus'
import TargetRow from './TargetRow'
import { effectLabels } from '../ui/potentialLabels'
import { cubeCostLabel } from '../data/cubeCosts'

const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export default function PotentialFormView({ options, busy, onChange, equipment, setEquipment, level, setLevel, cube, setCube, cubeSale, setCubeSale, availableTargets, effects, canCalculate, loadingOptions, currentOptions, setItemOptions, setRetry, setTargets, nextId, setNextId, updateTarget, submit, results }) {
  const { entrance, transition, reduced } = useWorkshopMotion()
  return <div className="potential-workspace">
    <form className="potential-form" onSubmit={submit}>
      <fieldset disabled={busy} className="potential-form-grid">
        <legend className="sr-only">Potential settings</legend>
        <CalculatorPanel title="Item Selection" className="potential-selection">
          <SelectField label="Equipment Type" value={equipment} onChange={event => { setEquipment(event.target.value); onChange() }}>
            {options.equipment_types.map(value => <option key={value} value={value}>{title(value)}</option>)}
          </SelectField>
          <SelectField label="Item Level" value={level} onChange={event => { setLevel(event.target.value); onChange() }}>
            {options.levels.map(value => <option key={value} value={value}>{value}</option>)}
          </SelectField>
          <p className="mw-label">Cube Type</p>
          <SegmentedControl label="Cube Type" options={options.cube_types.map(value => ({ value, label: `${title(value)} Cube` }))}
            value={cube} disabled={busy} onChange={value => { setCube(value); onChange() }} />
          <p className="mw-help" aria-live="polite">{cubeCostLabel(cube, cubeSale)}</p>
          <Toggle label="Cube sale (25% off black and red cubes)" checked={cubeSale} onChange={event => { setCubeSale(event.target.checked); onChange() }} />
          <div className="potential-tier"><RarityBadge rarity="Legendary" /><p className="mw-help">Legendary main potential. Tier-ups and keep/replace decisions are not included.</p></div>
        </CalculatorPanel>
        <CalculatorPanel title="Equipment & Target Stats" className="potential-targets">
          <div className="potential-item"><span aria-hidden="true" className="potential-item-icon">◇</span><div><h3>Custom {title(equipment)}</h3><p className="mw-help">Lv. {level} · {title(cube)} Cube</p><RarityBadge rarity="Legendary" /></div></div>
          <h3>Target Stats</h3>
          <p className="mw-help">Minimum totals across three lines. All targets must match. All Stat counts toward each main stat.</p>
          {availableTargets.some(row => row.effect === 'ALL_STAT_PCT') && <p className="mw-help">All Stat adds its percentage to STR, DEX, INT, and LUK targets, including your main and secondary stats. These are combined stat totals; matching rolls do not need a specific All Stat line.</p>}
          {loadingOptions ? <LoadingStatus>Loading obtainable potential lines…</LoadingStatus> : currentOptions.error ? <div role="alert"><p className="potential-error">{currentOptions.error}</p><SecondaryButton onClick={() => { setItemOptions(null); setRetry(value => value + 1) }}>Retry loading lines</SecondaryButton></div>
            : !currentOptions.potential.available && <p className="mw-help">No potential table is available for this equipment, level, and cube.</p>}
          <div className="target-list"><AnimatePresence initial={false}>{availableTargets.map((row, index) => <motion.div key={row.id} {...entrance} exit={reduced ? undefined : { opacity: 0, y: -4 }} transition={transition}>
            {index > 0 && <div className="potential-and">AND</div>}
            <TargetRow row={row} index={index} effects={effects} usedEffects={availableTargets.filter(item => item.id !== row.id).map(item => item.effect)}
              onUpdate={patch => updateTarget(row.id, patch)} canRemove={availableTargets.length > 1}
              onRemove={() => { setTargets(rows => rows.filter(item => item.id !== row.id)); onChange() }} />
          </motion.div>)}</AnimatePresence></div>
          <SecondaryButton className="w-full" disabled={!canCalculate || availableTargets.length >= effects.length} onClick={() => {
            const effect = effects.find(value => !availableTargets.some(row => row.effect === value))
            setTargets(rows => [...rows, { id: nextId, effect, target: '1' }]); setNextId(value => value + 1); onChange()
          }}>+ Add Stat</SecondaryButton>
          <PrimaryButton className="w-full mt-4" type="submit" disabled={busy || !canCalculate}><LoadingButtonContent busy={busy}>Calculate probability</LoadingButtonContent></PrimaryButton>
        </CalculatorPanel>
      </fieldset>
    </form>
      <div className="potential-results-column">{results}
        <CalculatorPanel title="Potential Preview" className="potential-preview">
          <p className="mw-help">Target requirements · combined totals across three lines</p>
          {availableTargets.map(row => <p key={row.id}>{effectLabels[row.effect] ?? row.effect} ≥ {row.target}{row.effect === 'COOLDOWN_SEC' ? ' seconds' : '%'}</p>)}
          <p className="mw-help">This describes your target, not a generated roll.</p>
        </CalculatorPanel>
      </div>
    <CalculatorPanel title="Available Potential Values" className="potential-values">
      <p className="mw-help">Obtainable values from the current equipment and cube table, grouped by line.</p>
      {loadingOptions ? <LoadingStatus>Loading potential values…</LoadingStatus> : !currentOptions?.potential?.values_by_line?.length ? <p className="mw-help">No line values are available for this selection.</p> :
        currentOptions.potential.values_by_line.map(line => <div className="potential-line-values" key={line.line}><h3>Line {line.line}</h3><dl>{Object.entries(line.values).map(([effect, values]) => <div key={effect}><dt>{effectLabels[effect] ?? effect}</dt><dd>{values.join(' / ')}{effect === 'COOLDOWN_SEC' ? ' sec' : '%'}</dd></div>)}</dl></div>)}
    </CalculatorPanel>
  </div>
}
