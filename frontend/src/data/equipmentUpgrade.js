import { potentialEquipmentType } from './flameEquipment.js'

export const FLAME_WEIGHT_LABELS = {
  all_stat_pct_value: 'Points per 1% all stat',
  secondary_stat_per_main: 'Secondary stat per main stat',
  attack_value: 'Points per ATT / MATT',
  boss_damage_pct_value: 'Points per 1% boss damage',
}
export const POTENTIAL_WEIGHT_LABELS = {
  base_stat_pct_value: 'Points per 1% main stat',
  attack_pct_value: 'Points per 1% ATT / MATT',
  crit_damage_pct_value: 'Points per 1% critical damage',
}
export const DEFAULT_UPGRADE_SETTINGS = {
  cube_type: 'black', base_stat_pct_value: '10', attack_pct_value: '10', crit_damage_pct_value: '8',
}

export function restoreUpgradeSettings(saved) {
  return {
    cube_type: saved?.cube_type === 'red' ? 'red' : 'black',
    ...Object.fromEntries(Object.keys(POTENTIAL_WEIGHT_LABELS).map(key => [key,
      saved?.[key] !== '' && saved?.[key] != null
        && Number.isFinite(Number(saved[key])) && Number(saved[key]) >= 0
        ? String(saved[key]) : DEFAULT_UPGRADE_SETTINGS[key],
    ])),
  }
}

export function buildUpgradeRequest(equipment, classStats, flameWeights, settings) {
  return {
    main_stat: classStats.main,
    secondary_stats: classStats.secondary,
    offense_stat: classStats.offense,
    cube_type: settings.cube_type,
    flame_weights: Object.fromEntries(Object.keys(FLAME_WEIGHT_LABELS)
      .map(key => [key, Number(flameWeights[key])])),
    potential_weights: Object.fromEntries(Object.keys(POTENTIAL_WEIGHT_LABELS)
      .map(key => [key, Number(settings[key])])),
    equipment: Object.entries(equipment).filter(([, item]) => item).map(([slot, item]) => ({
      name: item.name,
      slot,
      equipment_level: item.config.equipment_level,
      equipment_type: item.config.equipment_type,
      potential_equipment_type: potentialEquipmentType(slot, item),
      current_star_force: item.currentStarForce ?? 0,
      mode_by_star: item.starForceModes ?? {},
      safeguard_by_star: item.starForceSafeguards ?? {},
      boss_equipment: item.currentBossEquipment ?? item.config.boss_equipment ?? false,
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
