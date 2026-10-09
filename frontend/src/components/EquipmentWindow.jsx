import { useMemo, useRef, useState } from 'react'
import { CLASS_FAMILIES, EQUIPMENT_SLOTS, SLOT_LABELS, equipmentChoices, FIXED_RING_SLOT } from '../data/flameEquipment'
import EquipmentGrid, { EquipmentIcon } from './EquipmentGrid'
import { EQUIPMENT_GROUPS, equipmentGroup } from '../data/equipmentGroups'

export default function EquipmentWindow({
  equipmentClass, mapleClasses, onMapleClassChange, equipment, activeSlot,
  onActivate, onSelect, onRemove, busy: calculating,
  onExport, onImport, onOpenStats, dirty, onSave, onDiscard, saveError,
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

  return (
    <section className="panel equipment-window equipment-setup" aria-label="Equipment selector">
      <div className="equipment-window-heading">
        <div>
          <h2>Equipment setup</h2>
        </div>
      </div>
      <p className="hint">Preview your gear, then click Save equips to use it for stats and upgrade calculations.</p>
      <div className="equipment-setup-toolbar">
        <fieldset className="equipment-job-selection">
          <legend>1. Select your job type</legend>
          <div className="equipment-job-controls">
            <label>Job type
              <select disabled={busy} value={family} onChange={event => {
                const nextFamily = event.target.value
                setPreferredFamily(nextFamily)
                if (!CLASS_FAMILIES[nextFamily].includes(equipmentClass)) {
                  onMapleClassChange(mapleClasses.find(name => CLASS_FAMILIES[nextFamily].includes(name)))
                }
              }}>
                {Object.keys(CLASS_FAMILIES).map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label>Equipment class
              <select disabled={busy} value={equipmentClass} onChange={event => onMapleClassChange(event.target.value)}>
                {jobClasses.map(mapleClass => (
                  <option key={mapleClass} value={mapleClass}>{mapleClass}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <div className="equipment-transfer-panel" role="group" aria-label="Import or export equipment">
          <div className="equipment-transfer-actions">
            <button type="button" disabled={busy} onClick={downloadEquipment}>Export JSON</button>
            <button type="button" disabled={busy} aria-describedby="equipment-import-help"
              onClick={() => fileInput.current?.click()}>
              {importing ? 'Importing…' : 'Import JSON'}
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden
              aria-label="Import equipment JSON file" onChange={uploadEquipment} />
          </div>
          <p className="hint" id="equipment-import-help">
          Export your class, equipped items, recorded stats, and equipment score weights.
            Import replaces the preview. Save equips applies it to your current set.
          </p>
          {transferError && <p className="error" role="alert">{transferError}</p>}
          {transferMessage && <p className="hint" role="status">{transferMessage}</p>}
        </div>
      </div>
      <p className="hint">2. Set up your equipment. Click a slot in the equipment window to jump to its items.</p>
      <div className="equipment-setup-layout">
        <section className="equipment-catalog" aria-label="Available equipment">
          <div className="equipment-slot-navigation">
            <button type="button" disabled={busy} aria-label="Previous equipment slot"
              onClick={() => onActivate(slots[(slots.indexOf(pickerSlot) - 1 + slots.length) % slots.length])}>&larr;</button>
            <h3>{SLOT_LABELS[type]}{pickerSlot.includes('-') ? ' ' + pickerSlot.split('-')[1] : ''}</h3>
            <button type="button" disabled={busy} aria-label="Next equipment slot"
              onClick={() => onActivate(slots[(slots.indexOf(pickerSlot) + 1) % slots.length])}>&rarr;</button>
          </div>
          <div className="equipment-catalog-items" key={pickerSlot}>
            {Object.entries(EQUIPMENT_GROUPS).map(([group, label]) => {
              const items = choices.filter(item => equipmentGroup(item, pickerSlot) === group)
              return items.length > 0 && <div className="equipment-catalog-group" key={group}>
                <h4>{label}</h4>
                {items.map(item => <button type="button" key={item.id} disabled={busy || pickerSlot === FIXED_RING_SLOT}
              className="equipment-catalog-item" aria-pressed={selected?.id === item.id}
              onClick={() => onSelect(pickerSlot, item)}>
              <EquipmentIcon item={item} />
              <span><small>Lv. {item.config.equipment_level}</small>{item.name}</span>
              {selected?.id === item.id && <span className="equipment-equipped-label">Selected</span>}
                </button>)}
              </div>
            })}
            {!choices.length && <p className="hint">No matching equipment for this slot and class in the catalog.</p>}
          </div>
          {pickerSlot === FIXED_RING_SLOT && <p className="hint">Ring 4 is fixed to Ring of Restraint and cannot be changed or removed.</p>}
          {selected && pickerSlot !== FIXED_RING_SLOT && <button type="button" className="secondary" disabled={busy}
            onClick={() => { onRemove(pickerSlot); onActivate(pickerSlot) }}>Remove equipment</button>}
        </section>
        <div className="equipment-setup-preview">
          <EquipmentGrid equipment={equipment} activeSlot={pickerSlot} onActivate={onActivate} busy={busy} />
          <p className="equipment-summary" aria-live="polite">
            {selected ? <><strong>{selected.name}</strong><br />Level {selected.config.equipment_level} · {selected.currentStarForce ?? 0}★ Star Force</>
              : 'Select an item from the list to preview it.'}
          </p>
          <p className="hint">Stats and upgrades use your saved equipment.</p>
          <button type="button" onClick={onOpenStats}>Edit stats & upgrades &rarr;</button>
        </div>
      </div>
      <div className="equipment-setup-save">
        <p className="hint" role="status">{dirty ? 'Unsaved equipment changes.'
          : saveError ? 'Equipment could not be saved in this browser.' : 'No unsaved equipment changes.'}</p>
        <div className="equipment-transfer-actions">
          <button type="button" className="primary" disabled={busy || !dirty} onClick={onSave}>Save equips</button>
          <button type="button" disabled={busy || !dirty} onClick={onDiscard}>Discard changes</button>
        </div>
      </div>
    </section>
  )
}
