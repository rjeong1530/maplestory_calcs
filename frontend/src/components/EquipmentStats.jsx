import { useState } from 'react'
import EquipmentAnalysis from './EquipmentAnalysis'
import EquipmentGrid from './EquipmentGrid'
import EquipmentUpgradePlan from './EquipmentUpgradePlan'
import { EQUIPMENT_GROUPS, equipmentGroup } from '../data/equipmentGroups'
import { CLASS_STATS } from '../data/classStats'
import { EQUIPMENT_SLOTS, SLOT_LABELS, FIXED_RING_SLOT } from '../data/flameEquipment'

export default function EquipmentStats({ planner, busy, onOpenSetup, onOpenApproaches }) {
  const [statsExpanded, setStatsExpanded] = useState(true)
  const { equipment, equipmentClass, activeSlot, setActiveSlot, updateEquipmentRoll,
    equipmentWeights, setEquipmentWeights, upgradeSettings, setUpgradeSettings } = planner
  const slot = activeSlot || EQUIPMENT_SLOTS.find(key => key && equipment[key])
  const selected = equipment[slot]
  const classStats = CLASS_STATS[equipmentClass]

  return <>
    <section className="panel equipment-window" aria-label="Current equipment stats">
      <div className="equipment-window-heading">
        <h2>Current equipment stats</h2>
        <div className="equipment-stats-actions">
          <button type="button" onClick={onOpenSetup}>Change equipment setup</button>
          <button type="button" className="equipment-stats-toggle"
            aria-label={statsExpanded ? 'Collapse current equipment stats' : 'Expand current equipment stats'}
            title={statsExpanded ? 'Collapse stats' : 'Expand stats'}
            aria-expanded={statsExpanded} aria-controls="current-equipment-stats-content"
            onClick={() => setStatsExpanded(expanded => !expanded)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div id="current-equipment-stats-content" hidden={!statsExpanded}>
        <p className="hint">{equipmentClass} · Select an equipped item to record its current stats.</p>
        <label className="equipment-class-selector">Equipment by set
          <select value={slot || ''} onChange={event => setActiveSlot(event.target.value)}>
            <option value="" disabled>Select equipment</option>
            {Object.entries(EQUIPMENT_GROUPS).map(([group, label]) => <optgroup key={group} label={label}>
              {Object.entries(equipment).filter(([key, item]) => equipmentGroup(item, key) === group)
                .map(([key, item]) => <option key={key} value={key}>{item.name} ({key})</option>)}
            </optgroup>)}
            {slot && !selected && <option value={slot}>Empty {slot}</option>}
          </select>
        </label>
        <div className="equipment-stats-layout">
          <EquipmentGrid equipment={equipment} activeSlot={slot} onActivate={setActiveSlot} busy={busy} />
          <div className="equipment-editor-panel">
            {selected ? <>
              <h3>{selected.name}</h3>
              <p className="hint">{SLOT_LABELS[slot.split('-')[0]]} · Level {selected.config.equipment_level}</p>
              {slot === FIXED_RING_SLOT
                ? <p className="hint">Ring 4 is fixed to Ring of Restraint. It has no editable enhancements and is excluded from upgrade rankings.</p>
                : <EquipmentAnalysis key={`${slot}-${selected.id}`} slot={slot} item={selected}
                  onOpenApproaches={onOpenApproaches}
                  offenseStat={classStats.offense} onChange={updates => updateEquipmentRoll(slot, updates)} />}
            </> : <>
              <h3>No equipment in this slot</h3>
              <p className="hint">Select an equipped item or add one in Equipment setup.</p>
              <button type="button" onClick={onOpenSetup}>Choose equipment</button>
            </>}
          </div>
        </div>
      </div>
    </section>
    <EquipmentUpgradePlan equipment={equipment} equipmentClass={equipmentClass}
      classStats={classStats} flameWeights={equipmentWeights}
      settings={upgradeSettings} onSettingsChange={setUpgradeSettings}
      onFlameWeightChange={(key, value) => {
        setEquipmentWeights(current => ({ ...current, [key]: value }))
      }} />
  </>
}
