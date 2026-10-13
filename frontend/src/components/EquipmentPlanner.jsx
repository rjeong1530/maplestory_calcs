import './Calculator.css'
import useEquipmentPlanner from '../hooks/useEquipmentPlanner'
import useFlameCalculation from '../hooks/useFlameCalculation'
import { useState } from 'react'
import { starforcePage, equipmentPage, flamePage } from '../preloadPage'
import DeferredPage from './DeferredPage'

const StarForceCalculator = starforcePage.Component
const EquipmentPage = equipmentPage.Component
const FlameCalculator = flamePage.Component

// Keep shared state and flame results alive across all routes.
export default function EquipmentPlanner({ activeTab, onNavigate }) {
  const [starforceView, setStarforceView] = useState('estimate')
  const planner = useEquipmentPlanner()
  const calculation = useFlameCalculation(planner.form)

  return <>
    {planner.saveError && <p className="error" role="alert">{planner.saveError}</p>}
    <DeferredPage active={activeTab === 'equipment'}>
      <EquipmentPage planner={planner} busy={calculation.busy}
        onOpenApproaches={() => {
          setStarforceView('strategies')
          onNavigate('starforce')
        }} />
    </DeferredPage>
    <DeferredPage active={activeTab === 'flame'}>
      <FlameCalculator form={planner.form} setForm={planner.setForm} calculation={calculation} />
    </DeferredPage>
    <DeferredPage active={activeTab === 'starforce'}>
      <StarForceCalculator planner={planner} view={starforceView} setView={setStarforceView} />
    </DeferredPage>
  </>
}
