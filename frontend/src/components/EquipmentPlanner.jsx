import EquipmentPage from './EquipmentPage'
import FlameCalculator from './FlameCalculator'
import useEquipmentPlanner from '../hooks/useEquipmentPlanner'
import useFlameCalculation from '../hooks/useFlameCalculation'

// Keep shared state and flame results alive across all routes.
export default function EquipmentPlanner({ activeTab }) {
  const planner = useEquipmentPlanner()
  const calculation = useFlameCalculation(planner.form)

  if (activeTab !== 'equipment' && activeTab !== 'flame') return null

  return <>
    {planner.saveError && <p className="error" role="alert">{planner.saveError}</p>}
    {activeTab === 'equipment'
    ? <EquipmentPage planner={planner} busy={calculation.busy}
        onFlameResultInvalidated={calculation.clear} />
    : <FlameCalculator form={planner.form} setForm={planner.setForm}
        calculation={calculation} />}
  </>
}
