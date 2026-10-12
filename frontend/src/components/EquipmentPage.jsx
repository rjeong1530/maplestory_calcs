import { useState } from 'react'
import { equipmentSetup, equipmentStats } from '../preloadPage'
import DeferredPage from './DeferredPage'
import { CLASS_STATS } from '../data/classStats'
import { FIXED_RING_SLOT } from '../data/flameEquipment'
import './EquipmentWindow.css'

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

  return (
    <div className="equipment-page-layout">
      <nav className="equipment-section-navigation" aria-label="Equipment sections">
        <button type="button" aria-pressed={view === 'setup'} aria-controls="equipment-setup-view"
          onClick={() => setView('setup')}>Equipment setup</button>
        <button type="button" aria-pressed={view === 'stats'} aria-controls="equipment-stats-view"
          onClick={() => setView('stats')}>Stats & upgrades</button>
      </nav>
      <div className="equipment-page-content">
        <div id="equipment-setup-view" hidden={view !== 'setup'}>
          <DeferredPage active={view === 'setup'}>
            <EquipmentWindow equipmentClass={setupClass}
              mapleClasses={Object.keys(CLASS_STATS).sort()}
              onMapleClassChange={updateEquipmentClass} equipment={setupEquipment}
              activeSlot={activeSlot} onActivate={setActiveSlot}
              onSelect={selectEquipment} onRemove={removeEquipment}
              busy={busy} onExport={exportEquipmentJson}
              onImport={importEquipmentJson}
              dirty={setupDirty} onSave={saveEquipmentSetup} onDiscard={discardEquipmentSetup}
              saveError={planner.saveError} saveConfirmed={planner.saveConfirmed}
              onOpenStats={() => setView('stats')} />
          </DeferredPage>
        </div>
        <div id="equipment-stats-view" hidden={view !== 'stats'}>
          <DeferredPage active={view === 'stats'}>
            <EquipmentStats planner={planner} busy={busy}
              onOpenApproaches={onOpenApproaches}
              onOpenSetup={() => setView('setup')} />
          </DeferredPage>
        </div>
      </div>
    </div>
  )
}
