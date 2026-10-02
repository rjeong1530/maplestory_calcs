import EquipmentWindow from './EquipmentWindow'
import EquipmentUpgradePlan from './EquipmentUpgradePlan'
import { CLASS_STATS } from '../data/classStats'

export default function EquipmentPage({ planner, busy, onFlameResultInvalidated }) {
  const {
    form, setForm, equipment, equipmentClass, activeSlot, setActiveSlot,
    upgradeSettings, setUpgradeSettings, selectEquipment, removeEquipment,
    updateEquipmentRoll, updateEquipmentClass, importEquipmentJson, exportEquipmentJson,
  } = planner

  function changeEquipment(action, ...args) {
    action(...args)
    onFlameResultInvalidated()
  }

  return (
    <>
      <EquipmentWindow equipmentClass={equipmentClass}
        mapleClasses={Object.keys(CLASS_STATS).sort()}
        onMapleClassChange={updateEquipmentClass} equipment={equipment}
        activeSlot={activeSlot} onActivate={setActiveSlot}
        onSelect={(...args) => changeEquipment(selectEquipment, ...args)}
        onRemove={slot => changeEquipment(removeEquipment, slot)}
        busy={busy} classStats={CLASS_STATS[equipmentClass]}
        onUpdateEquipmentRoll={updateEquipmentRoll}
        onExport={exportEquipmentJson}
        onImport={text => changeEquipment(importEquipmentJson, text)} />
      <EquipmentUpgradePlan equipment={equipment} equipmentClass={equipmentClass}
        classStats={CLASS_STATS[equipmentClass]} flameWeights={form}
        settings={upgradeSettings} onSettingsChange={setUpgradeSettings}
        onFlameWeightChange={(key, value) => {
          setForm(current => ({ ...current, [key]: value }))
          onFlameResultInvalidated()
        }} />
    </>
  )
}
