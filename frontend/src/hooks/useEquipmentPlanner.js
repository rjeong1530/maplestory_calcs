import { useEffect, useState } from 'react'
import { CLASS_STATS } from '../data/classStats'
import { restoreEquipment, serializeEquipment, exportEquipment, importEquipment } from '../data/equipmentSave'
import { restoreUpgradeSettings, restoreFlameWeights, DEFAULT_FLAME_WEIGHTS, POTENTIAL_WEIGHT_LABELS } from '../data/equipmentUpgrade'
import { equipInSlot, compatibleEquipment, FIXED_RING_SLOT } from '../data/flameEquipment'
import { readEquipmentSelection, saveEquipmentSelection } from '../data/equipmentStorage'
import { applyStrategyToEquipment } from '../data/equipmentGroups'

const initialForm = {
  equipment_level: '150',
  equipment_type: 'armor',
  boss_equipment: true,
  flame_type: 'black',
  maple_class: 'Hero',
  weapon_series: 'fafnir',
  weapon_kind: 'two_handed_sword',
  ...DEFAULT_FLAME_WEIGHTS,
  target_score: '120',
}

const SCORE_WEIGHT_FIELDS = Object.keys(DEFAULT_FLAME_WEIGHTS)

export default function useEquipmentPlanner() {
  const [savedSelection] = useState(readEquipmentSelection)
  const [saveError, setSaveError] = useState('')
  const savedClass = Object.hasOwn(CLASS_STATS, savedSelection.maple_class) ? savedSelection.maple_class : initialForm.maple_class
  const savedEquipmentClass = Object.hasOwn(CLASS_STATS, savedSelection.equipment_class)
    ? savedSelection.equipment_class : savedClass
  const [form, setForm] = useState(() => ({
    ...initialForm,
    maple_class: savedClass,
    ...restoreFlameWeights(savedSelection.score_weights),
  }))
  const [equipmentClass, setEquipmentClass] = useState(savedEquipmentClass)
  const [equipmentWeights, setEquipmentWeights] = useState(() =>
    restoreFlameWeights(savedSelection.equipment_score_weights ?? savedSelection.score_weights))
  const [equipment, setEquipment] = useState(() =>
    restoreEquipment(savedSelection.equipment, savedEquipmentClass))
  const [activeSlot, setActiveSlot] = useState(null)
  const [setupDraft, setSetupDraft] = useState(null)
  const setupEquipment = setupDraft?.equipment ?? equipment
  const setupClass = setupDraft?.equipmentClass ?? equipmentClass
  const [upgradeSettings, setUpgradeSettings] = useState(() =>
    restoreUpgradeSettings(savedSelection.upgrade_settings))
  const savedClassName = form.maple_class
  const scoreWeightsKey = JSON.stringify(Object.fromEntries(SCORE_WEIGHT_FIELDS.map(field => [field, form[field]])))

  useEffect(() => {
    const savedEquipment = serializeEquipment(equipment)
    const saved = saveEquipmentSelection({
      maple_class: savedClassName,
      equipment_class: equipmentClass,
      equipment: savedEquipment,
      score_weights: JSON.parse(scoreWeightsKey),
      equipment_score_weights: equipmentWeights,
      upgrade_settings: upgradeSettings,
    })
    // Report the external storage write outcome; it cannot be derived during render.
    // oxlint-disable-next-line react/set-state-in-effect
    setSaveError(saved ? '' : 'Equipment could not be saved in this browser. Export your equipment JSON before closing or refreshing this page.')
  }, [equipment, equipmentClass, savedClassName, scoreWeightsKey, equipmentWeights, upgradeSettings])

  function selectEquipment(slot, item) {
    if (slot === FIXED_RING_SLOT) return
    setSetupDraft(draft => {
      const current = draft?.equipment ?? equipment
      const previous = current[slot]?.id === item.id ? current[slot] : equipment[slot]
      const selected = previous?.id === item.id
        ? { ...item, currentPotential: previous.currentPotential, currentFlames: previous.currentFlames,
          currentFlameType: previous.currentFlameType, currentBossEquipment: previous.currentBossEquipment,
          currentStarForce: previous.currentStarForce ?? 0, starForceModes: previous.starForceModes,
          maxStarForce: previous.maxStarForce,
          replacementCostMesos: previous.replacementCostMesos,
          minimumCooldownSeconds: previous.minimumCooldownSeconds,
          starForceSafeguards: previous.starForceSafeguards }
        : { ...item, currentStarForce: 0, currentPotential: [], currentFlames: [], currentFlameType: form.flame_type,
          currentBossEquipment: item.config.boss_equipment ?? form.boss_equipment }
      return { ...draft, equipmentClass: draft?.equipmentClass ?? equipmentClass,
        equipment: equipInSlot(current, slot, selected) }
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
    setSetupDraft(draft => {
      const next = { ...(draft?.equipment ?? equipment) }
      delete next[slot]
      return { ...draft, equipmentClass: draft?.equipmentClass ?? equipmentClass, equipment: next }
    })
    if (activeSlot === slot) setActiveSlot(null)
  }

  function updateEquipmentClass(value) {
    const compatible = compatibleEquipment(setupEquipment, value)
    setSetupDraft(current => ({ ...current, equipmentClass: value, equipment: compatible }))
    if (!compatible[activeSlot]) setActiveSlot(null)
  }

  function importEquipmentJson(text) {
    const imported = importEquipment(text)
    setSetupDraft({ ...imported, imported: true })
    setActiveSlot(null)
  }

  function saveEquipmentSetup() {
    if (!setupDraft) return
    setEquipmentClass(setupDraft.equipmentClass)
    // Keep any stats edited in another tab for unchanged items; imports supply their own stats.
    setEquipment(current => Object.fromEntries(Object.entries(setupDraft.equipment).map(([slot, item]) =>
      [slot, !setupDraft.imported && current[slot]?.id === item.id ? current[slot] : item])))
    if (setupDraft.scoreWeights) {
      setEquipmentWeights(current => ({ ...current, ...setupDraft.scoreWeights.flame }))
      setUpgradeSettings(current => ({ ...current, ...setupDraft.scoreWeights.potential }))
    }
    setSetupDraft(null)
  }

  return {
    applyEquipmentStrategy: (slots, strategy) => setEquipment(current => applyStrategyToEquipment(current, slots, strategy)),
    saveError,
    setupEquipment, setupClass, setupDirty: setupDraft !== null, saveEquipmentSetup,
    discardEquipmentSetup: () => setSetupDraft(null),
    form, setForm, equipmentWeights, setEquipmentWeights, equipment, equipmentClass, activeSlot, setActiveSlot,
    upgradeSettings, setUpgradeSettings, selectEquipment, removeEquipment,
    updateEquipmentRoll, updateEquipmentClass, importEquipmentJson,
    exportEquipmentJson: () => exportEquipment(setupEquipment, setupClass, {
      flame: { ...equipmentWeights, ...setupDraft?.scoreWeights?.flame },
      potential: { ...Object.fromEntries(Object.keys(POTENTIAL_WEIGHT_LABELS).map(key => [key, upgradeSettings[key]])),
        ...setupDraft?.scoreWeights?.potential },
    }),
  }
}
