import { potentialEquipmentType, FIXED_RING_SLOT } from './flameEquipment.js'
import { replacementCostForEquipment } from './starforce.js'
import { isFiniteNumeric } from './equipmentLines.js'

export const FLAME_WEIGHT_LABELS = {
  all_stat_pct_value: 'Points per 1% all stat',
  secondary_stat_value: 'Points per secondary stat',
  attack_value: 'Points per ATT / MATT',
  boss_damage_pct_value: 'Points per 1% boss damage',
}

export function restoreSecondaryStatWeight(saved) {
  const value = saved?.secondary_stat_value
  if (isFiniteNumeric(value) && Number(value) >= 0) {
    return String(value)
  }
  const legacy = saved?.secondary_stat_per_main
  return isFiniteNumeric(legacy) && Number(legacy) > 0 ? String(1 / Number(legacy)) : '0.1'
}
export const DEFAULT_FLAME_WEIGHTS = {
  all_stat_pct_value: '10', secondary_stat_value: '0.1', attack_value: '3', boss_damage_pct_value: '10',
}

export function restoreFlameWeights(saved) {
  return Object.fromEntries(Object.entries(DEFAULT_FLAME_WEIGHTS).map(([key, fallback]) => [key,
    key === 'secondary_stat_value' ? restoreSecondaryStatWeight(saved)
      : isFiniteNumeric(saved?.[key]) && Number(saved[key]) >= 0 ? String(saved[key]) : fallback,
  ]))
}
export const POTENTIAL_WEIGHT_LABELS = {
  base_stat_pct_value: 'Points per 1% main stat',
  attack_pct_value: 'Points per 1% ATT / MATT',
  crit_damage_pct_value: 'Points per 1% critical damage',
}
export const UPGRADE_CATEGORIES = { starforce: 'Star Force', flames: 'Flames', potential: 'Potential' }
export const MVP_RANKS = {
  none: 'None',
  silver: 'Silver — 3%',
  gold: 'Gold — 5%',
  diamond_plus: 'Diamond+ — 10%',
}
export const DEFAULT_UPGRADE_SETTINGS = {
  categories: Object.keys(UPGRADE_CATEGORIES),
  cube_type: 'black',
  cube_sale: false,
  shining_starforce_sunday: true,
  mvp_rank: 'none',
  base_stat_pct_value: '10', attack_pct_value: '10', crit_damage_pct_value: '8',
}

export function restoreUpgradeSettings(saved) {
  return {
    categories: Array.isArray(saved?.categories) && saved.categories.some(key => Object.hasOwn(UPGRADE_CATEGORIES, key))
      ? Object.keys(UPGRADE_CATEGORIES).filter(key => saved.categories.includes(key))
      : [...DEFAULT_UPGRADE_SETTINGS.categories],
    cube_type: saved?.cube_type === 'red' ? 'red' : 'black',
    cube_sale: saved?.cube_sale === true,
    shining_starforce_sunday: typeof saved?.shining_starforce_sunday === 'boolean'
      ? saved.shining_starforce_sunday
      : DEFAULT_UPGRADE_SETTINGS.shining_starforce_sunday,
    mvp_rank: Object.hasOwn(MVP_RANKS, saved?.mvp_rank)
      ? saved.mvp_rank
      : DEFAULT_UPGRADE_SETTINGS.mvp_rank,
    ...Object.fromEntries(Object.keys(POTENTIAL_WEIGHT_LABELS).map(key => [key,
      isFiniteNumeric(saved?.[key]) && Number(saved[key]) >= 0
        ? String(saved[key]) : DEFAULT_UPGRADE_SETTINGS[key],
    ])),
  }
}

// Compare the next six stars and, below 15, targets 16–21 to account for
// post-15 gains. Include all prerequisite costs, then commit the winning range.
export function orderStarforceSteps(entries) {
  const queues = new Map()
  entries.forEach((entry, priority) => {
    if (!queues.has(entry.slot)) queues.set(entry.slot, [])
    queues.get(entry.slot).push({ entry, priority })
  })
  for (const queue of queues.values()) {
    queue.sort((a, b) => a.entry.start_star - b.entry.start_star)
  }
  const ordered = []
  while (queues.size) {
    let next
    for (const queue of queues.values()) {
      let gain = 0
      let cost = 0
      const startStar = queue[0].entry.start_star
      const horizon = startStar < 15 ? 21 - startStar : 6
      for (let index = 0; index < Math.min(horizon, queue.length); index++) {
        const { entry } = queue[index]
        if ((index > 0 && queue[index - 1].entry.next_star !== entry.start_star)
          || entry.next_star !== entry.start_star + 1
          || !Number.isFinite(entry.expected_score_gain)
          || !Number.isFinite(entry.action_cost_mesos) || entry.action_cost_mesos <= 0) break
        gain += entry.expected_score_gain
        cost += entry.action_cost_mesos
        // Traverse the bridge to 15 without treating it as an extra target.
        if (index >= 6 && entry.next_star <= 15) continue
        const efficiency = gain / cost
        if (!next || efficiency > next.efficiency
          || (efficiency === next.efficiency && queue[0].priority < next.priority)) {
          next = { queue, count: index + 1, efficiency, priority: queue[0].priority }
        }
      }
    }
    if (!next) break
    const slot = next.queue[0].entry.slot
    ordered.push(...next.queue.splice(0, next.count).map(({ entry }) => entry))
    if (!next.queue.length) queues.delete(slot)
  }
  return ordered
}

// Group after ranking so intervening items and nonsequential stars keep their place.
export function combineStarforceSteps(entries) {
  const groups = []
  for (const entry of entries) {
    const previous = groups.at(-1)
    if (previous && previous.slot === entry.slot && previous.name === entry.name
      && previous.next_star === entry.start_star && entry.next_star != null
      && previous.expected_score_gain != null && entry.expected_score_gain != null
      && previous.action_cost_mesos != null && entry.action_cost_mesos != null) {
      previous.next_star = entry.next_star
      previous.expected_score_gain += entry.expected_score_gain
      previous.action_cost_mesos += entry.action_cost_mesos
      previous.expected_attempts += entry.expected_attempts
      previous.expected_booms = (previous.expected_booms ?? 0) + (entry.expected_booms ?? 0)
      previous.expected_replacement_cost = (previous.expected_replacement_cost ?? 0) + (entry.expected_replacement_cost ?? 0)
      previous.gain_per_meso = previous.action_cost_mesos
        ? previous.expected_score_gain / previous.action_cost_mesos : null
    } else {
      groups.push({ ...entry })
    }
  }
  return groups
}

export function buildUpgradeRequest(equipment, classStats, flameWeights, settings) {
  return {
    include_overall: true,
    main_stat: classStats.main,
    secondary_stats: classStats.secondary,
    offense_stat: classStats.offense,
    cube_type: settings.cube_type,
    cube_sale: Boolean(settings.cube_sale),
    categories: settings.categories,
    shining_starforce_sunday: Boolean(settings.shining_starforce_sunday),
    mvp_rank: settings.mvp_rank,
    flame_weights: Object.fromEntries(Object.keys(FLAME_WEIGHT_LABELS)
      .map(key => [key, Number(flameWeights[key])])),
    potential_weights: Object.fromEntries(Object.keys(POTENTIAL_WEIGHT_LABELS)
      .map(key => [key, Number(settings[key])])),
    equipment: Object.entries(equipment).filter(([slot, item]) => item && slot !== FIXED_RING_SLOT).map(([slot, item]) => ({
      name: item.name,
      slot,
      equipment_level: item.config.equipment_level,
      equipment_type: item.config.equipment_type,
      potential_equipment_type: potentialEquipmentType(slot, item),
      current_star_force: item.currentStarForce ?? 0,
      minimum_cooldown_seconds: slot === 'hat' ? item.minimumCooldownSeconds ?? 0 : 0,
      replacement_cost_mesos: replacementCostForEquipment(item, slot),
      ...(item.maxStarForce != null ? { max_star_force: item.maxStarForce } : {}),
      mode_by_star: item.starForceModes ?? {},
      safeguard_by_star: item.starForceSafeguards ?? {},
      boss_equipment: (item.needsFlameType
        ? item.currentBossEquipment ?? item.config.boss_equipment
        : item.config.boss_equipment ?? item.currentBossEquipment) ?? false,
      base_weapon_offense: item.config.base_weapon_offense ?? null,
      current_potential: (item.currentPotential || [])
        .filter(line => line.effect && line.value !== '' && line.value != null)
        .map(line => ({ effect: line.effect, value: Number(line.value) })),
      current_flames: (item.currentFlames || [])
        .filter(line => line.option && line.stage !== '' && line.stage != null)
        .map(line => ({ option: line.option, stage: Number(line.stage) })),
    })),
  }
}
