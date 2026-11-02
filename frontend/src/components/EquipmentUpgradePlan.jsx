import { useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../api'
import { buildUpgradeRequest, combineStarforceSteps, orderStarforceSteps } from '../data/equipmentUpgrade'
import UpgradePlanView from './UpgradePlanView'

export default function EquipmentUpgradePlan({
  equipment, equipmentClass, classStats, flameWeights, settings, onSettingsChange, onFlameWeightChange,
}) {
  const [selectedCategory, setCategory] = useState('starforce')
  const [flameType, setFlameType] = useState('black')
  const category = selectedCategory === 'overall' || settings.categories.includes(selectedCategory)
    ? selectedCategory : settings.categories[0]
  const [request, setRequest] = useState(null)
  const controllerRef = useRef(null)
  const payload = useMemo(() => buildUpgradeRequest(equipment, classStats, flameWeights, settings),
    [equipment, classStats, flameWeights, settings])
  const requestKey = useMemo(() => JSON.stringify(payload), [payload])
  const current = request?.key === requestKey ? request : null
  const busy = current?.status === 'loading'
  const result = current?.result
  const flameRankings = result?.flame_rankings[flameType]
  const rankings = result?.rankings[category]
  const groupedRows = useMemo(() => {
    const rankedRows = rankings?.gain_per_meso_first ?? []
    return category === 'starforce' ? combineStarforceSteps(orderStarforceSteps(rankedRows)) : rankedRows
  }, [category, rankings])
  const rows = category === 'starforce' ? groupedRows.slice(0, 20) : groupedRows

  useEffect(() => () => {
    controllerRef.current?.abort()
    // An aborted pending request must not become loading again if inputs revert.
    setRequest(previous => previous?.status === 'loading' ? null : previous)
  }, [requestKey])

  async function submit(event) {
    event.preventDefault()
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRequest({ key: requestKey, status: 'loading' })
    try {
      const data = await apiRequest('/api/equipment-upgrade-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestKey,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setRequest({ key: requestKey, status: 'done', result: data })
    } catch (error) {
      if (!controller.signal.aborted) setRequest({ key: requestKey, status: 'error', error: error.message })
    }
  }

  return <UpgradePlanView {...{ equipment, equipmentClass, classStats, flameWeights, settings, onSettingsChange, onFlameWeightChange, category, setCategory, flameType, setFlameType, payload, current, busy, result, request, rankings, flameRankings, rows, groupedRows, submit }} />
}
