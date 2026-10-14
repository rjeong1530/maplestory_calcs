import { useState } from 'react'
import EquipmentAnalysis from './EquipmentAnalysis'
import EquipmentGrid from './EquipmentGrid'
import EquipmentUpgradePlan from './EquipmentUpgradePlan'
import { EQUIPMENT_GROUPS, equipmentGroup } from '../data/equipmentGroups'
import { CLASS_STATS } from '../data/classStats'
import { EQUIPMENT_SLOTS, SLOT_LABELS, FIXED_RING_SLOT } from '../data/flameEquipment'
import { secondCopyItem, updateSecondCopy, isAstraSecondary } from '../data/laddering'

export default function EquipmentStats({ planner, busy, onOpenSetup, onOpenApproaches }) {
  const [statsExpanded, setStatsExpanded] = useState(true)
  const [copyView, setCopyView] = useState('equipped')
  const { equipment, equipmentClass, activeSlot, setActiveSlot, updateEquipmentRoll,
    equipmentWeights, setEquipmentWeights, upgradeSettings, setUpgradeSettings } = planner
  const slot = activeSlot || EQUIPMENT_SLOTS.find(key => key && equipment[key])
  const selected = equipment[slot]
  const hasLaddering = !!selected?.laddering && !isAstraSecondary(selected, slot)
  const editingSecond = copyView === 'second' && hasLaddering
  const classStats = CLASS_STATS[equipmentClass]

  return <>
    <section className="panel equipment-window bg-surface border border-solid border-rule rounded-sm p-6 col-span-full m-0 [@media(max-width:480px)]:p-2.5" aria-label="Current equipment stats">
      <div className="equipment-window-heading flex flex-wrap items-center justify-between gap-3 mb-4 [&_h2]:m-0 [&_h3]:m-0
        [&_.eyebrow]:text-[9px] [&_button]:py-1.5 [&_button]:px-2.5 [&_button]:text-[12px]">
        <h2>Current equipment stats</h2>
        <div className="equipment-stats-actions flex flex-wrap gap-2.5 [&_button]:min-h-10 [&_button]:py-2 [&_button]:px-3
        [&_.equipment-stats-toggle]:inline-flex [&_.equipment-stats-toggle]:items-center
        [&_.equipment-stats-toggle]:justify-center [&_.equipment-stats-toggle]:w-10 [&_.equipment-stats-toggle]:h-10
        [&_.equipment-stats-toggle]:p-0 [&_.equipment-stats-toggle]:shrink-0">
          <button type="button" onClick={onOpenSetup}>Change equipment setup</button>
          <button type="button" className="equipment-stats-toggle [&[aria-expanded='true']_svg]:rotate-90"
            aria-label={statsExpanded ? 'Collapse current equipment stats' : 'Expand current equipment stats'}
            title={statsExpanded ? 'Collapse stats' : 'Expand stats'}
            aria-expanded={statsExpanded} aria-controls="current-equipment-stats-content"
            onClick={() => setStatsExpanded(expanded => !expanded)}>
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-none" aria-hidden="true">
              <path d="m9 5 7 7-7 7" className="stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" />
            </svg>
          </button>
        </div>
      </div>
      <div id="current-equipment-stats-content" hidden={!statsExpanded}>
        <p className="hint text-[12px] text-muted mb-4.5">{equipmentClass} · Select an equipped item to record its current stats.</p>
        <label className="equipment-class-selector [#current-equipment-stats-content_>_&]:mb-6">Equipment by set
          <select value={slot || ''} onChange={event => setActiveSlot(event.target.value)}>
            <option value="" disabled>Select equipment</option>
            {Object.entries(EQUIPMENT_GROUPS).map(([group, label]) => <optgroup key={group} label={label}>
              {Object.entries(equipment).filter(([key, item]) => equipmentGroup(item, key) === group)
                .map(([key, item]) => <option key={key} value={key}>{item.name} ({key})</option>)}
            </optgroup>)}
            {slot && !selected && <option value={slot}>Empty {slot}</option>}
          </select>
        </label>
        <div className="equipment-stats-layout grid grid-cols-[220px_minmax(0,_1fr)] gap-5 items-start
        [@media(max-width:720px)]:grid-cols-1 [&_>_.equipment-slots]:w-full [&_>_.equipment-slots]:mt-0">
          <EquipmentGrid equipment={equipment} activeSlot={slot} onActivate={setActiveSlot} busy={busy} />
          <div className="equipment-editor-panel min-w-0 border border-solid border-rule rounded-sm bg-ink p-5 [&_>_h3]:m-0 [&_>_h3]:text-[16px]">
            {selected ? <>
              <h3>{selected.name}</h3>
              <p className="hint text-[12px] text-muted mb-4.5">{SLOT_LABELS[slot.split('-')[0]]} · Level {selected.config.equipment_level}</p>
              {hasLaddering && <>
                <div role="group" aria-label="Equipment copy" className="equipment-copy-selector flex flex-wrap gap-2 my-3 mx-0 [&_[aria-pressed='true']]:border-maple [&_[aria-pressed='true']]:text-maple">
                  <button type="button" aria-pressed={!editingSecond} onClick={() => setCopyView('equipped')}>Equipped copy</button>
                  <button type="button" aria-pressed={editingSecond} onClick={() => setCopyView('second')}>Second copy</button>
                </div>
                {editingSecond && <>
                  <p className="hint text-[12px] text-muted mb-4.5">Editing the second {selected.name}. These stars, flames, and potential are saved separately; the equipped copy is unchanged. Both copies use the equipped item's enhancement modes and equipment type.</p>
                  {!selected.laddering.second_copy && <p className="hint text-[12px] text-muted mb-4.5">No second-copy stats recorded: the planner starts at 0 stars and zero roll scores, then calculates the required targets and preparation costs.</p>}
                  {selected.laddering.second_copy && <button type="button" onClick={() => updateEquipmentRoll(slot, { laddering: { ...selected.laddering, second_copy: null } })}>Clear second-copy stats</button>}
                </>}
              </>}
              {slot === FIXED_RING_SLOT
                ? <p className="hint text-[12px] text-muted mb-4.5">Ring 4 is fixed to Ring of Restraint. It has no editable enhancements and is excluded from upgrade rankings.</p>
                : <EquipmentAnalysis key={`${slot}-${selected.id}-${editingSecond}`} slot={slot} item={editingSecond ? secondCopyItem(selected) : selected}
                  secondCopy={editingSecond}
                  onOpenApproaches={onOpenApproaches}
                  offenseStat={classStats.offense} onChange={updates => updateEquipmentRoll(slot, editingSecond
                    ? { laddering: updateSecondCopy(selected.laddering, updates) } : updates)} />}
            </> : <>
              <h3>No equipment in this slot</h3>
              <p className="hint text-[12px] text-muted mb-4.5">Select an equipped item or add one in Equipment setup.</p>
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
