import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import useCalculationRequest from '../hooks/useCalculationRequest'
import StarForceStrategies from './StarForceStrategies'
import { SUCCESS_CHANCES } from '../data/successChances'
import { SegmentedControl } from '../ui/controls'
import StarForceEstimateView from './StarForceEstimateView'
import './starforce-workshop.css'

const initialForm = {
  item_level: '200',
  start_star: '15',
  target_star: '22',
  replacement_cost_mesos: '0',
  shining_starforce_sunday: true,
  mvp_rank: 'none',
  superior_item: false,
  mode_by_star: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index + 15, '1'])),
  safeguard_by_star: { 15: false, 16: false, 17: false },
}

export default function StarForceCalculator({ planner, view, setView }) {
  const [form, setForm] = useState(initialForm)
  const { busy, error, result, run, clear } = useCalculationRequest(JSON.stringify(form))
  const [costRows, setCostRows] = useState(null)
  const [costsBusy, setCostsBusy] = useState(true)
  const [costsError, setCostsError] = useState('')

  useEffect(() => {
    const level = Number(form.item_level)
    if (!Number.isInteger(level) || level <= 0 || level > 300) {
      return undefined
    }

    const controller = new AbortController()
    const query = new URLSearchParams({
      level: String(level),
      shining_starforce_sunday: String(form.shining_starforce_sunday),
      mvp_rank: form.mvp_rank,
      superior_item: String(form.superior_item),
    })
    // Wait for typing to settle instead of fetching a cost table per keystroke.
    const timer = setTimeout(() => {
      apiRequest(`/api/starforce-costs?${query}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setCostRows(data.costs_by_star) })
        .catch(requestError => {
          if (!controller.signal.aborted) {
            setCostRows(null)
            setCostsError(requestError.message)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setCostsBusy(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [form.item_level, form.shining_starforce_sunday, form.mvp_rank, form.superior_item])

  function update(event) {
    const { name, value, type, checked } = event.target
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    if (['item_level', 'shining_starforce_sunday', 'mvp_rank', 'superior_item'].includes(name)) {
      const level = Number(name === 'item_level' ? value : form.item_level)
      if (Number.isInteger(level) && level > 0 && level <= 300) {
        setCostsBusy(true)
        setCostsError('')
      } else {
        setCostRows(null)
        setCostsBusy(false)
        setCostsError('Enter an equipment level from 1 to 300 to view tap costs.')
      }
    }
    clear()
  }

  function updateStarSetting(name, star, value) {
    setForm(current => ({
      ...current,
      [name]: { ...current[name], [star]: value },
    }))
    clear()
  }

  async function submit(event) {
    event.preventDefault()

    const payload = {
      percentiles: SUCCESS_CHANCES.map(chance => chance / 100),
      include_budget_distribution: true,
      item_level: Number(form.item_level),
      start_star: Number(form.start_star),
      target_star: Number(form.target_star),
      replacement_cost_mesos: Number(form.replacement_cost_mesos),
      shining_starforce_sunday: Boolean(form.shining_starforce_sunday),
      mvp_rank: form.mvp_rank,
      superior_item: form.superior_item,
      mode_by_star: Object.fromEntries(
        Object.entries(form.mode_by_star).map(([star, mode]) => [star, Number(mode)]),
      ),
      safeguard_by_star: form.safeguard_by_star,
    }

    await run('/api/starforce-estimate', payload)
  }

  return (
    <div className="sf-workshop">
      <SegmentedControl className="starforce-view-switch mb-6" label="Star Force view" value={view} onChange={setView}
        options={[{ value: 'estimate', label: 'Custom estimate' }, { value: 'strategies', label: 'Compare strategies' }]} />
      <div hidden={view !== 'strategies'}><StarForceStrategies form={form} onChange={update} planner={planner} /></div>
      <div hidden={view !== 'estimate'}>
        <StarForceEstimateView form={form} update={update} updateStarSetting={updateStarSetting} submit={submit}
          busy={busy} error={error} result={result} costRows={costRows} costsBusy={costsBusy} costsError={costsError} />
      </div>
    </div>
  )
}
