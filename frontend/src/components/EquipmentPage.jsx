import { useState } from 'react'
import { equipmentSetup, equipmentStats } from '../preloadPage'
import DeferredPage from './DeferredPage'
import { CLASS_STATS } from '../data/classStats'
import { FIXED_RING_SLOT } from '../data/flameEquipment'
import './equipment-workshop.css'

const EquipmentWindow = equipmentSetup.Component
const EquipmentStats = equipmentStats.Component

export default function EquipmentPage({ planner, busy, onOpenApproaches }) {
  const { equipment, setupEquipment, setupClass, setupDirty, saveEquipmentSetup, discardEquipmentSetup,
    activeSlot, setActiveSlot, selectEquipment,
    removeEquipment, updateEquipmentClass, importEquipmentJson, exportEquipmentJson } = planner
  const [view, setView] = useState(() => {
    // The automatically supplied Ring of Restraint is not a user-selected item.
    const selectedCount = Object.entries(equipment)
      .filter(([slot, item]) => slot !== FIXED_RING_SLOT && item?.id).length
    return selectedCount >= 5 ? 'stats' : 'setup'
  })

  const [openStatsAfterSave, setOpenStatsAfterSave] = useState(false)
  // Wait for the existing persistence flow to report the storage write outcome.
  if (openStatsAfterSave && !setupDirty) {
    if (planner.saveConfirmed && !planner.saveError) {
      setView('stats')
      setOpenStatsAfterSave(false)
    } else if (planner.saveError) {
      setOpenStatsAfterSave(false)
    }
  }

  function saveAndOpenStats() {
    if (busy) return
    if (!setupDirty) {
      if (!planner.saveError) setView('stats')
      return
    }
    setOpenStatsAfterSave(true)
    saveEquipmentSetup()
  }

  return (
    <div className="equipment-page-layout grid grid-cols-1 items-start gap-5">
      <nav className="equipment-section-navigation grid grid-cols-2 w-[min(100%,_420px)] gap-2 p-2 border border-solid border-outline
        rounded-sm bg-surface [&_button]:text-left [&_button]:p-3 [&_button]:text-[13px] [&_button]:border-transparent
        [&_button[aria-pressed='true']]:bg-[var(--surface-selected)] [&_button[aria-pressed='true']]:text-accent
        [&_button[aria-pressed='true']]:border-[var(--primary)]" aria-label="Equipment sections">
        <button type="button" aria-pressed={view === 'setup'} aria-controls="equipment-setup-view"
          onClick={() => setView('setup')}>Equipment setup</button>
        <button type="button" aria-pressed={view === 'stats'} aria-controls="equipment-stats-view"
          onClick={() => setView('stats')}>Stats & upgrades</button>
      </nav>
      <div className="min-w-0">
        <div id="equipment-setup-view" hidden={view !== 'setup'}>
          <DeferredPage active={view === 'setup'} loadingVariant="equipment">
            <EquipmentWindow equipmentClass={setupClass}
              mapleClasses={Object.keys(CLASS_STATS).sort()}
              onMapleClassChange={updateEquipmentClass} equipment={setupEquipment}
              activeSlot={activeSlot} onActivate={setActiveSlot}
              onSelect={selectEquipment} onRemove={removeEquipment}
              busy={busy} onExport={exportEquipmentJson}
              onImport={importEquipmentJson}
              dirty={setupDirty} onSave={saveEquipmentSetup} onDiscard={discardEquipmentSetup}
              saveError={planner.saveError} saveConfirmed={planner.saveConfirmed}
              onOpenStats={saveAndOpenStats} />
          </DeferredPage>
        </div>
        <div id="equipment-stats-view" hidden={view !== 'stats'}>
          <DeferredPage active={view === 'stats'} loadingVariant="equipment">
            <EquipmentStats planner={planner} busy={busy}
              onOpenApproaches={onOpenApproaches}
              onOpenSetup={() => setView('setup')} />
          </DeferredPage>
        </div>
      </div>
    </div>
  )
}
