import { useState } from 'react'
import EquipmentWindow from './EquipmentWindow'
import EquipmentStats from './EquipmentStats'
import { CLASS_STATS } from '../data/classStats'

export default function EquipmentPage({ planner, busy, onFlameResultInvalidated, onOpenApproaches }) {
  const [view, setView] = useState('setup')
  const { equipment, equipmentClass, activeSlot, setActiveSlot, selectEquipment,
    removeEquipment, updateEquipmentClass, importEquipmentJson, exportEquipmentJson } = planner

  function changeEquipment(action, ...args) {
    action(...args)
    onFlameResultInvalidated()
  }

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
          <EquipmentWindow equipmentClass={equipmentClass}
            mapleClasses={Object.keys(CLASS_STATS).sort()}
            onMapleClassChange={value => changeEquipment(updateEquipmentClass, value)} equipment={equipment}
            activeSlot={activeSlot} onActivate={setActiveSlot}
            onSelect={(...args) => changeEquipment(selectEquipment, ...args)}
            onRemove={slot => changeEquipment(removeEquipment, slot)}
            busy={busy} onExport={exportEquipmentJson}
            onImport={text => changeEquipment(importEquipmentJson, text)}
            onOpenStats={() => setView('stats')} />
        </div>
        <div id="equipment-stats-view" hidden={view !== 'stats'}>
          <EquipmentStats planner={planner} busy={busy}
            onOpenApproaches={onOpenApproaches}
            onOpenSetup={() => setView('setup')} onFlameResultInvalidated={onFlameResultInvalidated} />
        </div>
      </div>
    </div>
  )
}
