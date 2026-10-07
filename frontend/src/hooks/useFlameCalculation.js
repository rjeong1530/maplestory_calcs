import useCalculationRequest from './useCalculationRequest'
import { CLASS_STATS } from '../data/classStats'
import { CLASS_WEAPONS, getWeaponConfig } from '../data/flameWeapons'

export default function useFlameCalculation(form) {
  const { busy, error, result, run, clear } = useCalculationRequest(JSON.stringify(form))
  const classStats = CLASS_STATS[form.maple_class]
  const isWeapon = form.equipment_type === 'weapon'
  const weaponChoices = CLASS_WEAPONS[form.maple_class]
  const weaponKind = weaponChoices.includes(form.weapon_kind) ? form.weapon_kind : weaponChoices[0]
  const weaponConfig = getWeaponConfig(form.maple_class, form.weapon_series, weaponKind)

  async function submit(event) {
    event.preventDefault()

    const payload = {
      config: {
        equipment_level: Number(form.equipment_level),
        equipment_type: form.equipment_type,
        boss_equipment: form.boss_equipment,
        flame_type: form.flame_type,
        main_stat: classStats.main,
        secondary_stats: classStats.secondary,
        offense_stat: classStats.offense,
        ...(isWeapon ? weaponConfig : {}),
        weights: {
          all_stat_pct_value: Number(form.all_stat_pct_value),
          secondary_stat_value: Number(form.secondary_stat_value),
          attack_value: Number(form.attack_value),
          boss_damage_pct_value: Number(form.boss_damage_pct_value),
        },
      },
      target_score: Number(form.target_score),
    }

    await run('/api/flame-probability', payload)
  }

  return { busy, error, result, submit, clear }
}
