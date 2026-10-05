export const EQUIPMENT_STORAGE_KEY = 'maplestory-flame-equipment'

function parseSelection(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

export function readEquipmentSelection(browser = window) {
  try {
    const saved = parseSelection(browser.localStorage.getItem(EQUIPMENT_STORAGE_KEY))
    if (saved) return saved
  } catch {
    // Storage may be blocked; an existing cookie can still be recovered.
  }
  try {
    const cookie = browser.document.cookie.split(';').map(value => value.trim())
      .find(value => value.startsWith(`${EQUIPMENT_STORAGE_KEY}=`))
    return cookie ? parseSelection(decodeURIComponent(cookie.slice(EQUIPMENT_STORAGE_KEY.length + 1))) ?? {} : {}
  } catch {
    return {}
  }
}

export function saveEquipmentSelection(selection, browser = window) {
  try {
    browser.localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(selection))
  } catch {
    return false
  }
  // Retire the old cookie only after a successful write, preserving it on failure.
  try {
    browser.document.cookie = `${EQUIPMENT_STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
  } catch {
    // Cookie access need not be available for local storage to work.
  }
  return true
}
