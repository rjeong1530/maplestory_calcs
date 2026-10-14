import { useMemo, useRef, useState } from 'react'
import { CLASS_FAMILIES, EQUIPMENT_SLOTS, SLOT_LABELS, equipmentChoices, FIXED_RING_SLOT } from '../data/flameEquipment'
import EquipmentGrid, { EquipmentIcon } from './EquipmentGrid'
import { EQUIPMENT_GROUPS, equipmentGroup } from '../data/equipmentGroups'

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

  return (
    <section className="panel equipment-window equipment-setup bg-transparent border-0 rounded-none pt-0 px-0 pb-12 col-span-full m-0
        [@media(max-width:480px)]:p-2.5 [&_>_.equipment-window-heading]:justify-center
        [&_>_.equipment-window-heading]:mb-6 [&_h2]:text-[clamp(24px,_3vw,_34px)]
        [@media(max-width:480px)]:[&.equipment-setup]:pb-12" aria-label="Equipment selector">
      <div className="equipment-window-heading flex flex-wrap items-center justify-between gap-3 mb-4 [&_h2]:m-0 [&_h3]:m-0
        [&_.eyebrow]:text-[9px] [&_button]:py-1.5 [&_button]:px-2.5 [&_button]:text-[12px]">
        <div>
          <h2>Equipment setup</h2>
        </div>
      </div>
      <p className="hint text-[12px] text-muted mb-4.5">Preview your gear, then click Save equips to use it for stats and upgrade calculations.</p>
      <div className="equipment-setup-toolbar grid grid-cols-[minmax(0,_1fr)_minmax(0,_320px)] items-start gap-y-5 gap-x-8 my-7 mx-0 [@media(max-width:720px)]:grid-cols-1">
        <fieldset className="equipment-job-selection [&_legend]:text-[14px] [&_legend]:font-medium [&_legend]:mb-3">
          <legend>1. Select your job type</legend>
          <div className="equipment-job-controls grid grid-cols-[minmax(0,_1fr)_minmax(0,_1.5fr)] max-w-105 gap-2">
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
        <div className="equipment-transfer-panel pt-6.5 text-muted text-[12px] text-right [@media(max-width:720px)]:pt-0
        [&_.equipment-transfer-actions]:justify-end [&_.equipment-transfer-actions]:mb-2 [&_p]:mb-0" role="group" aria-label="Import or export equipment">
          <div className="equipment-transfer-actions flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={downloadEquipment}>Export JSON</button>
            <button type="button" disabled={busy} aria-describedby="equipment-import-help"
              onClick={() => fileInput.current?.click()}>
              {importing ? 'Importing…' : 'Import JSON'}
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden
              aria-label="Import equipment JSON file" onChange={uploadEquipment} />
          </div>
          <p className="hint text-[12px] text-muted mb-4.5" id="equipment-import-help">
          Export your class, equipped items, recorded stats, and equipment score weights.
            Import replaces the preview. Save equips applies it to your current set.
          </p>
          {transferError && <p className="error text-[#ffb6b6] bg-[#38242d] p-3.5 rounded-sm [overflow-wrap:anywhere]" role="alert">{transferError}</p>}
          {transferMessage && <p className="hint text-[12px] text-muted mb-4.5" role="status">{transferMessage}</p>}
        </div>
      </div>
      <p className="hint text-[12px] text-muted mb-4.5">2. Set up your equipment. Click a slot in the equipment window to jump to its items.</p>
      <div className="equipment-setup-layout grid grid-cols-[minmax(0,_1fr)_230px] gap-7 items-start [@media(max-width:720px)]:grid-cols-1">
        <section className="equipment-catalog min-w-0 p-3.5 border border-solid border-rule rounded-sm bg-ink" aria-label="Available equipment">
          <div className="equipment-slot-navigation flex items-center justify-between gap-2 mb-3 [&_h3]:m-0 [&_h3]:text-[15px] [&_button]:py-1.5 [&_button]:px-2.5">
            <button type="button" disabled={busy} aria-label="Previous equipment slot"
              onClick={() => onActivate(slots[(slots.indexOf(pickerSlot) - 1 + slots.length) % slots.length])}>&larr;</button>
            <h3>{SLOT_LABELS[type]}{pickerSlot.includes('-') ? ' ' + pickerSlot.split('-')[1] : ''}</h3>
            <button type="button" disabled={busy} aria-label="Next equipment slot"
              onClick={() => onActivate(slots[(slots.indexOf(pickerSlot) + 1) % slots.length])}>&rarr;</button>
          </div>
          <div className="flex flex-col gap-2 h-[340px] overflow-y-auto mb-3.5" key={pickerSlot}>
            {Object.entries(EQUIPMENT_GROUPS).map(([group, label]) => {
              const items = choices.filter(item => equipmentGroup(item, pickerSlot) === group)
              return items.length > 0 && <div className="equipment-catalog-group grid gap-2 [&_h4]:mt-2.5 [&_h4]:mx-0 [&_h4]:mb-0 [&_h4]:text-[12px] [&_h4]:text-muted" key={group}>
                <h4>{label}</h4>
                {items.map(item => <button type="button" key={item.id} disabled={busy || pickerSlot === FIXED_RING_SLOT}
              className="equipment-catalog-item flex items-center gap-2.5 w-full p-2.5 text-left text-[12px] [&_img]:object-contain
        [&_img]:[image-rendering:pixelated] [&_img]:shrink-0 [&_small]:block [&_small]:mb-1 [&_small]:text-muted
        [&[aria-pressed='true']]:border-maple [&[aria-pressed='true']]:bg-[#373022]" aria-pressed={selected?.id === item.id}
              onClick={() => onSelect(pickerSlot, item)}>
              <EquipmentIcon item={item} />
              <span><small>Lv. {item.config.equipment_level}</small>{item.name}</span>
              {selected?.id === item.id && <span className="ml-auto text-maple text-[10px]">Selected</span>}
                </button>)}
              </div>
            })}
            {!choices.length && <p className="hint text-[12px] text-muted mb-4.5">No matching equipment for this slot and class in the catalog.</p>}
          </div>
          {pickerSlot === FIXED_RING_SLOT && <p className="hint text-[12px] text-muted mb-4.5">Ring 4 is fixed to Ring of Restraint and cannot be changed or removed.</p>}
          {selected && pickerSlot !== FIXED_RING_SLOT && <button type="button" className="secondary text-[12px] w-full bg-transparent" disabled={busy}
            onClick={() => { onRemove(pickerSlot); onActivate(pickerSlot) }}>Remove equipment</button>}
        </section>
        <div className="equipment-setup-preview min-w-0 text-center [@media(max-width:720px)]:row-[1] [&_>_.equipment-slots]:p-2.5
        [&_>_.equipment-slots]:border [&_>_.equipment-slots]:border-solid [&_>_.equipment-slots]:border-[#646258]
        [&_>_.equipment-slots]:rounded-sm [&_>_.equipment-slots]:bg-[#302f29]">
          <EquipmentGrid equipment={equipment} activeSlot={pickerSlot} onActivate={onActivate} busy={busy} />
          <p className="equipment-summary text-[12px] text-muted leading-[1.7] mt-4 mx-0 mb-0 [&_strong]:text-[#eeede6]" aria-live="polite">
            {selected ? <><strong>{selected.name}</strong><br />Level {selected.config.equipment_level} · {selected.currentStarForce ?? 0}★ Star Force</>
              : 'Select an item from the list to preview it.'}
          </p>
          <p className="hint text-[12px] text-muted mb-4.5">Stats and upgrades use your saved equipment.</p>
          <button type="button" onClick={onOpenStats}>Edit stats & upgrades &rarr;</button>
        </div>
      </div>
      <div className="mt-7 pt-5 border-t border-rule">
        <p className="hint text-[12px] text-muted mb-4.5" role="status">{dirty ? 'Unsaved equipment changes.'
          : saveError ? 'Equipment could not be saved in this browser.'
            : saveConfirmed ? '✓ Equipment saved in this browser.' : 'No unsaved equipment changes.'}</p>
        <div className="equipment-transfer-actions flex flex-wrap gap-2">
          <button type="button" className="primary w-full font-bold bg-maple text-[#201b12] border-maple p-3.5 [&:hover:not(:disabled)]:bg-[#f2ce91]" disabled={busy || !dirty} onClick={onSave}>
            {saveConfirmed && !dirty && !saveError ? 'Saved equips' : 'Save equips'}
          </button>
          <button type="button" disabled={busy || !dirty} onClick={onDiscard}>Discard changes</button>
        </div>
      </div>
    </section>
  )
}
