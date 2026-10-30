import { EquipmentIcon } from './EquipmentGrid'
import { FLAME_SLOTS, FIXED_RING_SLOT, potentialEquipmentType } from '../data/flameEquipment'
import { supportsStarForce } from '../data/starforce'
import { POTENTIAL_LABELS, FLAME_LABELS } from '../data/equipmentLines'

export default function EquipmentDetails({ item, slot, onOpenStats }) {
  if (!item) return <p className="mw-help">This slot is empty. Choose equipment below to add it to your preview.</p>
  return <div className="equipment-selected-details">
    <div className="equipment-selected-name"><EquipmentIcon item={item} /><div><h3>{item.name}</h3><p className="mw-help">Level {item.config.equipment_level}</p></div></div>
    {slot !== FIXED_RING_SLOT && <>
      <dl className="equipment-recorded-stats">
        {supportsStarForce(item, slot) && <div><dt>Star Force</dt><dd>{item.currentStarForce ?? 0} ★</dd></div>}
        {potentialEquipmentType(slot, item) && <div><dt>Potential Lines</dt><dd>{item.currentPotential?.some(line => line.effect) ? item.currentPotential.filter(line => line.effect).map((line, index) => <span key={index}>{POTENTIAL_LABELS[line.effect] ?? line.effect}: {line.value}</span>) : 'Not recorded'}</dd></div>}
        {FLAME_SLOTS.has(item.slot) && <div><dt>Flame Options</dt><dd>{item.currentFlames?.length ? item.currentFlames.map((line, index) => <span key={index}>{FLAME_LABELS[line.option] ?? line.option} · Tier {line.stage}</span>) : 'Not recorded'}</dd></div>}
      </dl>
      <button type="button" className="mw-button mw-button-secondary" onClick={onOpenStats}>Save equips & edit stats →</button>
      <p className="mw-help">Saves your current equipment, then opens stats & upgrades.</p>
    </>}
  </div>
}
