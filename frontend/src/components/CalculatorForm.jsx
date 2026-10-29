import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { buildPotentialTargets } from '../data/potentialTargets'
import PotentialFormView from './PotentialFormView'


export default function CalculatorForm({ options, busy, onCalculate, onChange, results }) {
  const [equipment, setEquipment] = useState('hat')
  const [level, setLevel] = useState(250)
  const [cube, setCube] = useState('black')
  const [cubeSale, setCubeSale] = useState(false)
  const [targets, setTargets] = useState([
    { id: 0, effect: 'STR_PCT', target: '13' },
    { id: 1, effect: 'COOLDOWN_SEC', target: '4' },
  ])
  const [nextId, setNextId] = useState(2)
  const [itemOptions, setItemOptions] = useState(null)
  const [retry, setRetry] = useState(0)
  const optionsKey = new URLSearchParams({
    potential_equipment_type: equipment, level: String(level), cube_type: cube,
  }).toString()
  const currentOptions = itemOptions?.key === optionsKey ? itemOptions : null
  const loadingOptions = !currentOptions
  const effects = (currentOptions?.potential?.effects ?? [])
    .filter(effect => effect === 'ALL_STAT_PCT' || options.effects.includes(effect))
  const availableTargets = targets.filter(row => effects.includes(row.effect))
  const canCalculate = currentOptions?.potential?.available && availableTargets.length > 0

  useEffect(() => {
    const controller = new AbortController()
    apiRequest(`/api/item-options?${optionsKey}`, {
      signal: controller.signal,
    }).then(data => {
      if (controller.signal.aborted) return
      const allowedEffects = data.potential.effects
        .filter(effect => effect === 'ALL_STAT_PCT' || options.effects.includes(effect))
      setTargets(rows => {
        const validRows = rows.filter(row => allowedEffects.includes(row.effect))
        return validRows.length || !allowedEffects.length
          ? validRows : [{ id: 0, effect: allowedEffects[0], target: '1' }]
      })
      setItemOptions({ key: optionsKey, potential: data.potential })
    }).catch(error => {
      if (!controller.signal.aborted) setItemOptions({ key: optionsKey, error: error.message })
    })
    return () => controller.abort()
  }, [optionsKey, options.effects, retry])

  function updateTarget(id, patch) {
    setTargets(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row))
    onChange()
  }

  function submit(event) {
    event.preventDefault()
    if (!canCalculate || busy) return
    onCalculate({
      equipment_type: equipment, level: Number(level), cube_type: cube,
      cube_sale: cubeSale,
      targets: buildPotentialTargets(availableTargets),
      percentiles: [],
    })
  }

  return <PotentialFormView {...{options, busy, onChange, equipment, setEquipment, level, setLevel, cube, setCube, cubeSale, setCubeSale, availableTargets, effects, canCalculate, loadingOptions, currentOptions, setItemOptions, setRetry, setTargets, nextId, setNextId, updateTarget, submit, results}} />
}
