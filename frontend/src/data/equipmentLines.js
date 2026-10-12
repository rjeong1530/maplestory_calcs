// Shared by the editor and persistence validation so saved rolls use the same keys.
export const POTENTIAL_LABELS = {
  STR_PCT: 'STR %', DEX_PCT: 'DEX %', INT_PCT: 'INT %', LUK_PCT: 'LUK %',
  ALL_STAT_PCT: 'All stats %', MAX_HP_PCT: 'Max HP %', MAX_MP_PCT: 'Max MP %',
  ATT_PCT: 'Attack %', MAGIC_ATT_PCT: 'Magic attack %', BOSS_DAMAGE_PCT: 'Boss damage %',
  DAMAGE_PCT: 'Damage %', IED_PCT: 'Ignore enemy defense %',
  CRIT_RATE_PCT: 'Critical rate %', CRIT_DAMAGE_PCT: 'Critical damage %',
  MESO_PCT: 'Meso obtained %', DROP_PCT: 'Item drop rate %',
  COOLDOWN_SEC: 'Cooldown reduction',
}

export const FLAME_LABELS = {
  STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK',
  'STR+DEX': 'STR + DEX', 'STR+INT': 'STR + INT', 'STR+LUK': 'STR + LUK',
  'DEX+INT': 'DEX + INT', 'DEX+LUK': 'DEX + LUK', 'INT+LUK': 'INT + LUK',
  ALL_STAT_PCT: 'All stats %', MAX_HP: 'Max HP', MAX_MP: 'Max MP',
  LEVEL_REDUCTION: 'Level reduction', DEF: 'Defense', ATT: 'Attack', MATT: 'Magic attack',
  BOSS_DAMAGE_PCT: 'Boss damage %', DAMAGE_PCT: 'Damage %',
  MOVE_SPEED: 'Movement speed', JUMP: 'Jump',
}

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export const isFiniteNumeric = value => (typeof value === 'number' || typeof value === 'string')
  && String(value).trim() !== '' && Number.isFinite(Number(value))

export const LINE_FIELDS = {
  current_potential: { label: 'effect', value: 'value', limit: 3, labels: POTENTIAL_LABELS },
  current_flames: { label: 'option', value: 'stage', limit: 4, labels: FLAME_LABELS },
}

export function equipmentLinesForRequest(lines, key) {
  const { label, value } = LINE_FIELDS[key]
  return (lines || []).filter(line => line[label] && line[value] !== '' && line[value] != null)
    .map(line => ({ [label]: line[label], [value]: Number(line[value]) }))
}

export function validEquipmentLine(line, key) {
  const { label, value, labels } = LINE_FIELDS[key]
  if (!isObject(line) || typeof line[label] !== 'string'
    || (line[label] !== '' && !Object.hasOwn(labels, line[label]))) return false
  if (line[value] === '') return true // The editor persists partially filled rows.
  if (!isFiniteNumeric(line[value])) return false
  const number = Number(line[value])
  return key === 'current_flames'
    ? Number.isInteger(number) && number >= 1 && number <= 7
    : number >= 0 || line.effect === 'COOLDOWN_SEC'
}

export function restoreEquipmentLines(lines, key) {
  if (!Array.isArray(lines)) return []
  const seen = new Set()
  return lines.filter(line => {
    if (!validEquipmentLine(line, key)) return false
    if (key === 'current_flames' && line.option) {
      if (seen.has(line.option)) return false
      seen.add(line.option)
    }
    return true
  }).slice(0, LINE_FIELDS[key].limit)
}
