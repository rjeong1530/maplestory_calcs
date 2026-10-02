import EquipmentPage from './EquipmentPage'
import FlameCalculator from './FlameCalculator'
import useEquipmentPlanner from '../hooks/useEquipmentPlanner'
import useFlameCalculation from '../hooks/useFlameCalculation'

// Keep shared state and the flame calculation alive across these two tabs.
export default function EquipmentPlanner({ activeTab, onTabChange }) {
  const planner = useEquipmentPlanner()
  const calculation = useFlameCalculation(planner.form)

  return activeTab === 'equipment'
    ? <EquipmentPage planner={planner} busy={calculation.busy}
        onFlameResultInvalidated={calculation.clear} />
    : <FlameCalculator form={planner.form} setForm={planner.setForm}
        calculation={calculation} equipmentCount={Object.keys(planner.equipment).length}
        onManageEquipment={() => onTabChange('equipment')} />
}
