export async function apiRequest(path, init = {}) {
  let response
  try {
    response = await fetch(path, { ...init, signal: init.signal ?? AbortSignal.timeout(30000) })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not reach the calculator. Check that the API is running on port 8000, then try again.')
  }
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server returned an unexpected response. Check that the API is running and restart the Vite development server.')
  }
  if (!response.ok) {
    const detail = data.detail
    const message = Array.isArray(detail)
      ? detail.map(item => item.msg).join('; ')
      : typeof detail === 'string' ? detail : 'Calculation failed. Please try again.'
    throw new Error(message)
  }
  return data
}

