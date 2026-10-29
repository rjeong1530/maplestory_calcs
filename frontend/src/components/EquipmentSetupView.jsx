import { motion } from 'framer-motion'
import { ContentCard } from '../ui/layout'
import { useWorkshopMotion } from '../ui/motion'
import { CalculatorLoadingOverlay, LoadingButtonContent } from '../ui/loading'
import { CLASS_FAMILIES, SLOT_LABELS, FIXED_RING_SLOT } from '../data/flameEquipment'
import EquipmentGrid, { EquipmentIcon } from './EquipmentGrid'
import { EQUIPMENT_GROUPS, equipmentGroup } from '../data/equipmentGroups'
import EquipmentDetails from './EquipmentDetails'

export default function EquipmentSetupView({ equipmentClass, mapleClasses, onMapleClassChange, equipment, onActivate, onSelect, onRemove, onOpenStats, dirty, onSave, onDiscard, saveError, saveConfirmed, slots, pickerSlot, fileInput, importing, transferError, transferMessage, setPreferredFamily, family, jobClasses, busy, type, choices, selected, downloadEquipment, uploadEquipment }) {
 const { entrance, transition } = useWorkshopMotion()
 return <section className="equipment-window equipment-setup workshop-equipment" aria-label="Equipment selector">
 <ContentCard className="equipment-build-toolbar">
 <div><h2>Equipment setup</h2><p className="mw-help">Preview your gear, then Save equips to apply it to stats and upgrades.</p></div>
 <div className="equipment-build-actions">        <div className="equipment-transfer-panel pt-6.5 text-muted text-[12px] text-right [@media(max-width:720px)]:pt-0
        [&_.equipment-transfer-actions]:justify-end [&_.equipment-transfer-actions]:mb-2 [&_p]:mb-0" role="group" aria-label="Import or export equipment">
          <div className="equipment-transfer-actions flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={downloadEquipment}>Export JSON</button>
            <button type="button" disabled={busy} aria-describedby="equipment-import-help"
              onClick={() => fileInput.current?.click()}>
              <LoadingButtonContent busy={importing} label="Importing…">Import JSON</LoadingButtonContent>
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
        </div>      <div className="mt-7 pt-5 border-t border-rule">
        <p className="hint text-[12px] text-muted mb-4.5" role="status">{dirty ? 'Unsaved equipment changes.'
          : saveError ? 'Equipment could not be saved in this browser.'
            : saveConfirmed ? '✓ Equipment saved in this browser.' : 'No unsaved equipment changes.'}</p>
        <div className="equipment-transfer-actions flex flex-wrap gap-2">
          <button type="button" className="primary w-full font-bold bg-maple text-[#201b12] border-maple p-3.5 [&:hover:not(:disabled)]:bg-[#f2ce91]" disabled={busy || !dirty} onClick={onSave}>
            {saveConfirmed && !dirty && !saveError ? 'Saved equips' : 'Save equips'}
          </button>
          <button type="button" disabled={busy || !dirty} onClick={onDiscard}>Discard changes</button>
        </div>
      </div></div>
 </ContentCard>
 <div className="equipment-workshop-columns">
 <ContentCard className="equipment-character-panel">        <fieldset className="equipment-job-selection [&_legend]:text-[14px] [&_legend]:font-medium [&_legend]:mb-3">
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
          <CalculatorLoadingOverlay loading={importing} variant="equipment" label="Reading equipment file…">
            <EquipmentGrid equipment={equipment} activeSlot={pickerSlot} onActivate={onActivate} busy={busy} workshop />
          </CalculatorLoadingOverlay>
          <p className="equipment-summary text-[12px] text-muted leading-[1.7] mt-4 mx-0 mb-0 [&_strong]:text-[#eeede6]" aria-live="polite">
            {selected ? <><strong>{selected.name}</strong><br />Level {selected.config.equipment_level} · {selected.currentStarForce ?? 0}★ Star Force</>
              : 'Select an item from the list to preview it.'}
          </p>
          <p className="hint text-[12px] text-muted mb-4.5">Stats and upgrades use your saved equipment.</p>
          <button type="button" onClick={onOpenStats}>Edit stats & upgrades &rarr;</button></ContentCard>
 <ContentCard className="equipment-picker-panel">
 <motion.div key={pickerSlot} {...entrance} transition={transition} className="equipment-editor-heading"><h2>Selected Item</h2><EquipmentDetails item={selected} slot={pickerSlot} onOpenStats={onOpenStats} /></motion.div>
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

 </ContentCard>
 </div>
 </section>
}
