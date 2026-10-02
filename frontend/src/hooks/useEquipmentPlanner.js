import { useEffect, useState } from 'react'
import { CLASS_STATS } from '../data/classStats'
import { restoreEquipment, serializeEquipment, exportEquipment, importEquipment } from '../data/equipmentSave'
import { restoreUpgradeSettings } from '../data/equipmentUpgrade'
import { equipInSlot, compatibleEquipment } from '../data/flameEquipment'

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

export default function useEquipmentPlanner() {
  const [savedSelection] = useState(readEquipmentCookie)
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
    document.cookie = `${EQUIPMENT_COOKIE}=${encodeURIComponent(JSON.stringify({
      maple_class: form.maple_class,
      equipment_class: equipmentClass,
      equipment: savedEquipment,
      score_weights: Object.fromEntries(SCORE_WEIGHT_FIELDS.map(field => [field, form[field]])),
      upgrade_settings: upgradeSettings,
    }))}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [equipment, equipmentClass, form, upgradeSettings])

  function selectEquipment(slot, item) {
    setEquipment(current => {
      const previous = current[slot]
      const selected = previous?.id === item.id
        ? { ...item, currentPotential: previous.currentPotential, currentFlames: previous.currentFlames,
          currentFlameType: previous.currentFlameType, currentBossEquipment: previous.currentBossEquipment,
          currentStarForce: previous.currentStarForce ?? 0, starForceModes: previous.starForceModes,
          maxStarForce: previous.maxStarForce,
          starForceSafeguards: previous.starForceSafeguards }
        : { ...item, currentStarForce: 0, currentPotential: [], currentFlames: [], currentFlameType: form.flame_type,
          currentBossEquipment: item.config.boss_equipment ?? form.boss_equipment }
      return equipInSlot(current, slot, selected)
    })
    setActiveSlot(slot)
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
    form, setForm, equipment, equipmentClass, activeSlot, setActiveSlot,
    upgradeSettings, setUpgradeSettings, selectEquipment, removeEquipment,
    updateEquipmentRoll, updateEquipmentClass, importEquipmentJson,
    exportEquipmentJson: () => exportEquipment(equipment, equipmentClass),
  }
}
