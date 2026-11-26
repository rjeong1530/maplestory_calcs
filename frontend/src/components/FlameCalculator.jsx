import { CLASS_WEAPONS, getWeaponConfig } from '../data/flameWeapons'
import { CLASS_STATS } from '../data/classStats'
import FlameCalculatorView from './FlameCalculatorView'
import './flame-workshop.css'

export default function FlameCalculator({ form, setForm, calculation }) {
  const { busy, error, result, submit } = calculation
  const classStats = CLASS_STATS[form.maple_class]
  const isWeapon = form.equipment_type === 'weapon'
  const weaponChoices = CLASS_WEAPONS[form.maple_class]
  const weaponKind = weaponChoices.includes(form.weapon_kind) ? form.weapon_kind : weaponChoices[0]
  const weaponConfig = getWeaponConfig(form.maple_class, form.weapon_series, weaponKind)

  function update(event) {
    calculation.clear()
    const { name, value, type, checked } = event.target
    setForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'maple_class' ? {
        weapon_kind: CLASS_WEAPONS[value].includes(current.weapon_kind)
          ? current.weapon_kind : CLASS_WEAPONS[value][0],
      } : {}),
    }))
  }

  return <FlameCalculatorView {...{ form, classStats, isWeapon, weaponChoices, weaponKind, weaponConfig, update, busy, error, result, submit }} />
}
