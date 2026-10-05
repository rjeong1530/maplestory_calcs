import EquipmentAnalysis from './EquipmentAnalysis'
import EquipmentGrid from './EquipmentGrid'
import EquipmentUpgradePlan from './EquipmentUpgradePlan'
import { CLASS_STATS } from '../data/classStats'
import { EQUIPMENT_SLOTS, SLOT_LABELS } from '../data/flameEquipment'

export default function EquipmentStats({ planner, busy, onOpenSetup, onFlameResultInvalidated }) {
  const { equipment, equipmentClass, activeSlot, setActiveSlot, updateEquipmentRoll,
    form, setForm, upgradeSettings, setUpgradeSettings } = planner
  const slot = activeSlot || EQUIPMENT_SLOTS.find(key => key && equipment[key])
  const selected = equipment[slot]
  const classStats = CLASS_STATS[equipmentClass]

  return <>
    <section className="panel equipment-window" aria-label="Current equipment stats">
      <div className="equipment-window-heading">
        <h2>Current equipment stats</h2>
        <button type="button" onClick={onOpenSetup}>Change equipment setup</button>
      </div>
      <p className="hint">{equipmentClass} · Select an equipped item to record its current stats.</p>
      <div className="equipment-stats-layout">
        <EquipmentGrid equipment={equipment} activeSlot={slot} onActivate={setActiveSlot} busy={busy} />
        <div className="equipment-editor-panel">
          {selected ? <>
            <h3>{selected.name}</h3>
            <p className="hint">{SLOT_LABELS[slot.split('-')[0]]} · Level {selected.config.equipment_level}</p>
            <EquipmentAnalysis key={`${slot}-${selected.id}`} slot={slot} item={selected}
              offenseStat={classStats.offense} onChange={updates => updateEquipmentRoll(slot, updates)} />
          </> : <>
            <h3>No equipment in this slot</h3>
            <p className="hint">Select an equipped item or add one in Equipment setup.</p>
            <button type="button" onClick={onOpenSetup}>Choose equipment</button>
          </>}
        </div>
      </div>
    </section>
    <EquipmentUpgradePlan equipment={equipment} equipmentClass={equipmentClass}
      classStats={classStats} flameWeights={form}
      settings={upgradeSettings} onSettingsChange={setUpgradeSettings}
      onFlameWeightChange={(key, value) => {
        setForm(current => ({ ...current, [key]: value }))
        onFlameResultInvalidated()
      }} />
  </>
}
