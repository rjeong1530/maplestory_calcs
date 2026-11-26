import { useMemo, useRef, useState } from 'react'
import EquipmentSetupView from './EquipmentSetupView'
import './equipment-workshop.css'
import { CLASS_FAMILIES, EQUIPMENT_SLOTS, equipmentChoices } from '../data/flameEquipment'

export default function EquipmentWindow({
  equipmentClass, mapleClasses, onMapleClassChange, equipment, activeSlot,
  onActivate, onSelect, onRemove, busy: calculating,
  onExport, onImport, onOpenStats, dirty, onSave, onDiscard, saveError, saveConfirmed,
}) {
  const slots = EQUIPMENT_SLOTS.filter(slot => slot && slot !== 'android')
  const pickerSlot = activeSlot || slots[0]
  const fileInput = useRef(null)
  const [importing, setImporting] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferMessage, setTransferMessage] = useState('')
  const [preferredFamily, setPreferredFamily] = useState('')
  const family = CLASS_FAMILIES[preferredFamily]?.includes(equipmentClass)
    ? preferredFamily
    : Object.keys(CLASS_FAMILIES).find(key => CLASS_FAMILIES[key].includes(equipmentClass))
  const jobClasses = mapleClasses.filter(name => CLASS_FAMILIES[family]?.includes(name))
  const busy = calculating || importing
  const type = pickerSlot?.split('-')[0]
  const choices = useMemo(() => pickerSlot ? equipmentChoices(pickerSlot, equipmentClass) : [],
    [pickerSlot, equipmentClass])
  const selected = equipment[pickerSlot]

  function downloadEquipment() {
    setTransferError('')
    setTransferMessage('')
    try {
      const url = URL.createObjectURL(new Blob([onExport()], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `maplestory-equipment-${equipmentClass.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setTransferMessage('Equipment JSON export ready.')
    } catch {
      setTransferError('Could not export equipment. Please try again.')
    }
  }

  async function uploadEquipment(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImporting(true)
    setTransferError('')
    setTransferMessage('')
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose an equipment JSON file smaller than 1 MB.')
      onImport(await file.text())
      setTransferMessage('Equipment loaded into the preview. Click Save equips to apply it.')
    } catch (error) {
      setTransferError(error.message || 'Could not read the equipment file.')
    } finally {
      setImporting(false)
    }
  }

  return <EquipmentSetupView {...{ equipmentClass, mapleClasses, onMapleClassChange, equipment, onActivate, onSelect, onRemove, onOpenStats, dirty, onSave, onDiscard, saveError, saveConfirmed, slots, pickerSlot, fileInput, importing, transferError, transferMessage, setPreferredFamily, family, jobClasses, busy, type, choices, selected, downloadEquipment, uploadEquipment }} />
}
