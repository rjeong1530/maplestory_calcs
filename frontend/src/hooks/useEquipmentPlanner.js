import { useEffect, useState } from 'react'
import { CLASS_STATS } from '../data/classStats'
import { restoreEquipment, serializeEquipment, exportEquipment, importEquipment } from '../data/equipmentSave'
import { restoreUpgradeSettings } from '../data/equipmentUpgrade'
import { equipInSlot, compatibleEquipment, FIXED_RING_SLOT } from '../data/flameEquipment'
import { readEquipmentSelection, saveEquipmentSelection } from '../data/equipmentStorage'

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

const SCORE_WEIGHT_FIELDS = [
  'all_stat_pct_value',
  'secondary_stat_per_main',
  'attack_value',
  'boss_damage_pct_value',
]

function restoreScoreWeights(savedWeights) {
  return Object.fromEntries(SCORE_WEIGHT_FIELDS.map(field => {
    const value = savedWeights?.[field]
    return [field, value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
      ? String(value) : initialForm[field]]
  }))
}

export default function useEquipmentPlanner() {
  const [savedSelection] = useState(readEquipmentSelection)
  const [saveError, setSaveError] = useState('')
  const savedClass = CLASS_STATS[savedSelection.maple_class] ? savedSelection.maple_class : initialForm.maple_class
  const savedEquipmentClass = CLASS_STATS[savedSelection.equipment_class]
    ? savedSelection.equipment_class : savedClass
  const [form, setForm] = useState(() => ({
    ...initialForm,
    maple_class: savedClass,
    ...restoreScoreWeights(savedSelection.score_weights),
  }))
  const [equipmentClass, setEquipmentClass] = useState(savedEquipmentClass)
  const [equipment, setEquipment] = useState(() =>
    restoreEquipment(savedSelection.equipment, savedEquipmentClass))
  const [activeSlot, setActiveSlot] = useState(null)
  const [upgradeSettings, setUpgradeSettings] = useState(() =>
    restoreUpgradeSettings(savedSelection.upgrade_settings))

  useEffect(() => {
    const savedEquipment = serializeEquipment(equipment)
    const saved = saveEquipmentSelection({
      maple_class: form.maple_class,
      equipment_class: equipmentClass,
      equipment: savedEquipment,
      score_weights: Object.fromEntries(SCORE_WEIGHT_FIELDS.map(field => [field, form[field]])),
      upgrade_settings: upgradeSettings,
    })
    // Report the external storage write outcome; it cannot be derived during render.
    // oxlint-disable-next-line react/set-state-in-effect
    setSaveError(saved ? '' : 'Equipment could not be saved in this browser. Export your equipment JSON before closing or refreshing this page.')
  }, [equipment, equipmentClass, form, upgradeSettings])

  function selectEquipment(slot, item) {
    if (slot === FIXED_RING_SLOT) return
    setEquipment(current => {
      const previous = current[slot]
      const selected = previous?.id === item.id
        ? { ...item, currentPotential: previous.currentPotential, currentFlames: previous.currentFlames,
          currentFlameType: previous.currentFlameType, currentBossEquipment: previous.currentBossEquipment,
          currentStarForce: previous.currentStarForce ?? 0, starForceModes: previous.starForceModes,
          maxStarForce: previous.maxStarForce,
          replacementCostMesos: previous.replacementCostMesos,
          starForceSafeguards: previous.starForceSafeguards }
        : { ...item, currentStarForce: 0, currentPotential: [], currentFlames: [], currentFlameType: form.flame_type,
          currentBossEquipment: item.config.boss_equipment ?? form.boss_equipment }
      return equipInSlot(current, slot, selected)
    })
    setActiveSlot(slot)
  }

  function updateEquipmentRoll(slot, updates) {
    if (slot === FIXED_RING_SLOT) return
    setEquipment(current => current[slot] ? {
      ...current,
      [slot]: { ...current[slot], ...updates },
    } : current)
  }

  function removeEquipment(slot) {
    if (slot === FIXED_RING_SLOT) return
    setEquipment(current => {
      const next = { ...current }
      delete next[slot]
      return next
    })
    if (activeSlot === slot) setActiveSlot(null)
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
  }

  return {
    saveError,
    form, setForm, equipment, equipmentClass, activeSlot, setActiveSlot,
    upgradeSettings, setUpgradeSettings, selectEquipment, removeEquipment,
    updateEquipmentRoll, updateEquipmentClass, importEquipmentJson,
    exportEquipmentJson: () => exportEquipment(equipment, equipmentClass),
  }
}
