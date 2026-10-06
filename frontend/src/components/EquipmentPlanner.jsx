import EquipmentPage from './EquipmentPage'
import FlameCalculator from './FlameCalculator'
import useEquipmentPlanner from '../hooks/useEquipmentPlanner'
import useFlameCalculation from '../hooks/useFlameCalculation'
import { lazy, useState } from 'react'
import DeferredPage from './DeferredPage'

const StarForceCalculator = lazy(() => import('./StarForceCalculator'))

// Keep shared state and flame results alive across all routes.
export default function EquipmentPlanner({ activeTab, onNavigate }) {
  const [starforceView, setStarforceView] = useState('estimate')
  const planner = useEquipmentPlanner()
  const calculation = useFlameCalculation(planner.form)

  if (!['equipment', 'flame', 'starforce'].includes(activeTab)) return null

  return <>
    {planner.saveError && <p className="error" role="alert">{planner.saveError}</p>}
    {activeTab === 'equipment'
    ? <EquipmentPage planner={planner} busy={calculation.busy}
        onOpenApproaches={() => {
          setStarforceView('strategies')
          onNavigate('starforce')
        }}
        onFlameResultInvalidated={calculation.clear} />
    : activeTab === 'flame' ? <FlameCalculator form={planner.form} setForm={planner.setForm}
        calculation={calculation} /> : null}
    <DeferredPage active={activeTab === 'starforce'}>
      <StarForceCalculator planner={planner} view={starforceView} setView={setStarforceView} />
    </DeferredPage>
  </>
}
