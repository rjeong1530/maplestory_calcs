import { useRef, useState } from 'react'
import { EQUIPMENT_SLOTS, SLOT_LABELS, equipmentChoices } from '../data/flameEquipment'
import EquipmentAnalysis from './EquipmentAnalysis'
import './EquipmentWindow.css'

function EquipmentIcon({ item }) {
  const [failedUrls, setFailedUrls] = useState([])
  const url = item?.icon && !failedUrls.includes(item.icon) ? item.icon : null
  return url && (
    <img src={url} alt="" width="38" height="38" loading="lazy" decoding="async"
      onError={() => setFailedUrls(current => [...current, url])} />
  )
}

export default function EquipmentWindow({
  equipmentClass, mapleClasses, onMapleClassChange, equipment, activeSlot,
  onActivate, onSelect, onRemove, busy: calculating, classStats, onUpdateEquipmentRoll,
  onExport, onImport,
}) {
  const [pickerSlot, setPickerSlot] = useState(null)
  const fileInput = useRef(null)
  const [importing, setImporting] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferMessage, setTransferMessage] = useState('')
  const busy = calculating || importing
  const type = pickerSlot?.split('-')[0]
  const choices = pickerSlot ? equipmentChoices(pickerSlot, equipmentClass) : []
  const selected = equipment[activeSlot]

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
      setPickerSlot(null)
      setTransferMessage('Equipment imported. Your current set has been replaced.')
    } catch (error) {
      setTransferError(error.message || 'Could not read the equipment file.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="panel equipment-window" aria-label="Equipment selector">
      <div className="equipment-window-heading">
        <div>
          <h2>Equipment</h2><span className="eyebrow">SELECT A SLOT</span>
        </div>
        <div className="equipment-transfer-actions">
          <button type="button" disabled={busy} onClick={downloadEquipment}>Export JSON</button>
          <button type="button" disabled={busy} aria-describedby="equipment-import-help"
            onClick={() => fileInput.current?.click()}>
            {importing ? 'Importing…' : 'Import JSON'}
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden
            aria-label="Import equipment JSON file" onChange={uploadEquipment} />
        </div>
      </div>
      <p className="hint" id="equipment-import-help">
        Export your class, equipped items, Star Force, potentials, and flames.
        Import replaces your current equipment set.
      </p>
      {transferError && <p className="error" role="alert">{transferError}</p>}
      {transferMessage && <p className="hint" role="status">{transferMessage}</p>}
      <label className="equipment-class-selector">Equipment class
        <select disabled={busy} value={equipmentClass} onChange={event => onMapleClassChange(event.target.value)}>
          {mapleClasses.map(mapleClass => (
            <option key={mapleClass} value={mapleClass}>{mapleClass}</option>
          ))}
        </select>
      </label>
      <div className="equipment-slots">
        {EQUIPMENT_SLOTS.map((slot, index) => {
          if (!slot) return <span key={`space-${index}`} aria-hidden="true" />
          const kind = slot.split('-')[0]
          const item = equipment[slot]
          const label = `${SLOT_LABELS[kind]}${slot.includes('-') ? ` ${slot.split('-')[1]}` : ''}`
          if (slot === 'android') {
            return <span key={slot} className="equipment-slot equipment-slot-unavailable"
              aria-label={`${label}: not selectable`}>
              {label}
            </span>
          }
          return (
            <button type="button" key={slot} disabled={busy}
              className={`equipment-slot${item ? ' equipped' : ''}`}
              style={item ? { '--item-color': item.color } : undefined}
              aria-pressed={(pickerSlot ?? activeSlot) === slot}
              aria-label={`${label}: ${item?.name || 'empty'}`}
              title={item?.name || `Choose ${label.toLowerCase()}`}
              onClick={() => {
                setPickerSlot(slot)
                onActivate(slot)
                if (item) onSelect(slot, item)
              }}>
              {item && <EquipmentIcon key={item.id} item={item} />}
              {item && <small>{item.config.equipment_level}</small>}
              {!item && <span>{label}</span>}
            </button>
          )
        })}
      </div>
      <p className="equipment-summary" aria-live="polite">
        {selected ? <><strong>{selected.name}</strong><br />Level {selected.config.equipment_level}
          {` · ${selected.currentStarForce ?? 0}★ Star Force`}
          {selected.needsFlameType ? ' · Check the Boss equipment setting below for this accessory.'
            : ` · ${selected.config.boss_equipment ? 'Boss' : 'Normal'} flames`}</>
          : activeSlot
            ? `${SLOT_LABELS[activeSlot.split('-')[0]]} selected · No equipment selected.`
            : 'Select a slot to choose equipment.'}
      </p>
      {selected && activeSlot && (
        <details className="equipped-item-analyses" open>
          <summary>Equipment stat selection</summary>
          <h3>{SLOT_LABELS[activeSlot.split('-')[0]]}
            {activeSlot.includes('-') ? ` ${activeSlot.split('-')[1]}` : ''} — {selected.name}
          </h3>
          <p className="hint">Record this item's current potential and flames. Options match its level and type.</p>
          <EquipmentAnalysis key={`${activeSlot}-${selected.id}`} slot={activeSlot} item={selected}
            offenseStat={classStats.offense}
            onChange={updates => onUpdateEquipmentRoll(activeSlot, updates)} />
        </details>
      )}
      {pickerSlot && (
        <div className="equipment-picker">
          <div className="equipment-window-heading">
            <h3>Choose {SLOT_LABELS[type].toLowerCase()}</h3>
          </div>
          <label className="equipment-dropdown">Equipment for {equipmentClass}
            <select disabled={busy || !choices.length}
              value={choices.some(item => item.id === equipment[pickerSlot]?.id)
                ? equipment[pickerSlot].id : ''}
              onChange={event => {
                const item = choices.find(choice => choice.id === Number(event.target.value))
                if (item) onSelect(pickerSlot, item)
              }}>
              <option value="" disabled>Choose equipment…</option>
              {choices.map(item => <option key={item.id} value={item.id}>
                {item.name} — Lv. {item.config.equipment_level}
              </option>)}
            </select>
          </label>
          {!choices.length && <p className="hint">
            No matching equipment for this slot and class in the catalog.
          </p>}
          {equipment[pickerSlot] && <button type="button" className="secondary" onClick={() => {
            onRemove(pickerSlot); setPickerSlot(null)
          }}>Remove equipment</button>}
        </div>
      )}
    </section>
  )
}
