import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'

// Results belong to the exact inputs that produced them, including while a
// hidden calculator is still mounted or an aborted fetch resolves late.
export default function useCalculationRequest(inputKey) {
  const [request, setRequest] = useState(null)
  const controllerRef = useRef(null)
  useEffect(() => () => controllerRef.current?.abort(), [inputKey])
  const current = request?.key === inputKey ? request : null

  function clear() {
    controllerRef.current?.abort()
    setRequest(null)
  }

  async function run(path, payload) {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRequest({ key: inputKey, busy: true })
    try {
      const result = await apiRequest(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      })
      if (!controller.signal.aborted) setRequest({ key: inputKey, result })
    } catch (error) {
      if (!controller.signal.aborted) setRequest({ key: inputKey, error: error.message })
    }
  }

  return { busy: Boolean(current?.busy), error: current?.error || '', result: current?.result || null, run, clear }
}
