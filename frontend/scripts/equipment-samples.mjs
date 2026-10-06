import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CLASS_STATS } from '../src/data/classStats.js'
import { equipmentChoices, FLAME_SLOTS, potentialEquipmentType } from '../src/data/flameEquipment.js'
import { exportEquipment, importEquipment } from '../src/data/equipmentSave.js'
import { buildUpgradeRequest, DEFAULT_FLAME_WEIGHTS, restoreUpgradeSettings } from '../src/data/equipmentUpgrade.js'
import { supportsStarForce, maxStarForceForEquipment } from '../src/data/starforce.js'

export const sampleDirectory = new URL('../../examples/equipment/', import.meta.url)

export function sampleEquipment(mapleClass) {
  const stats = CLASS_STATS[mapleClass]
  const primary = [stats.main].flat()[0]
  const equipment = {}
  for (const slot of ['hat', 'weapon', 'secondary', 'top', 'bottom', 'gloves', 'ring-1', 'pendant-1']) {
    const choices = equipmentChoices(slot, mapleClass).filter(item => !item.overall)
    const item = choices.find(item => slot === 'secondary'
      ? item.name.startsWith('Astra ') : item.config.equipment_level === 200) ?? choices[0]
    if (!item) throw new Error(`Missing ${slot} for ${mapleClass}`)
    const stars = supportsStarForce(item, slot) ? Math.min(17, maxStarForceForEquipment(item)) : 0
    const potentialType = potentialEquipmentType(slot, item)
    const offense = ['weapon', 'secondary', 'emblem'].includes(slot)
    equipment[slot] = {
      ...item, currentStarForce: stars, maxStarForce: supportsStarForce(item, slot) ? stars + 1 : 0,
      currentPotential: potentialType ? [{
        effect: offense ? (stats.offense === 'MATT' ? 'MAGIC_ATT_PCT' : 'ATT_PCT')
          : primary === 'HP' ? 'MAX_HP_PCT' : `${primary}_PCT`,
        value: item.config.equipment_level > 150 ? 13 : 12,
      }] : [],
      currentFlames: FLAME_SLOTS.has(item.slot)
        ? [{ option: primary === 'HP' ? 'MAX_HP' : primary, stage: 4 }] : [],
      currentFlameType: 'black',
    }
    // Exercise negative cooldown values and all three Xenon primary stats.
    if (slot === 'hat' && mapleClass === 'Bishop') {
      equipment[slot].currentPotential.push({ effect: 'COOLDOWN_SEC', value: -2 })
    }
    if (slot === 'hat' && mapleClass === 'Xenon') {
      equipment[slot].currentFlames = stats.main.map(option => ({ option, stage: 4 }))
      equipment[slot].currentPotential = [{ effect: 'ALL_STAT_PCT', value: 10 }]
    }
  }
  return equipment
}

export function readSamples() {
  return readdirSync(sampleDirectory).filter(name => name.endsWith('.json')).sort().map(name => ({
    name, text: readFileSync(new URL(name, sampleDirectory), 'utf8'),
  }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--requests')) {
    console.log(JSON.stringify(readSamples().map(({ text }) => {
      const { equipment, equipmentClass } = importEquipment(text)
      return { maple_class: equipmentClass, request: buildUpgradeRequest(equipment,
        CLASS_STATS[equipmentClass], DEFAULT_FLAME_WEIGHTS, restoreUpgradeSettings()) }
    })))
  } else {
    mkdirSync(sampleDirectory, { recursive: true })
    for (const mapleClass of Object.keys(CLASS_STATS)) {
      const name = mapleClass.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
      writeFileSync(new URL(`${name}.json`, sampleDirectory), `${exportEquipment(sampleEquipment(mapleClass), mapleClass)}\n`)
    }
    console.log(`Generated ${Object.keys(CLASS_STATS).length} importable equipment samples.`)
  }
}
