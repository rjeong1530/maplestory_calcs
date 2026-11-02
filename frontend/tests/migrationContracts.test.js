import assert from 'node:assert/strict'
import test from 'node:test'
import { legacyRoutes, legacySavedBuild, upgradeRequest, potentialMultipleRequest } from './fixtures/preMigrationContracts.js'
import { PAGE_PATHS, pageForPath } from '../src/data/routes.js'
import { restoreEquipment, serializeEquipment, exportEquipment, importEquipment } from '../src/data/equipmentSave.js'
import { EQUIPMENT_STORAGE_KEY, readEquipmentSelection } from '../src/data/equipmentStorage.js'
import { buildUpgradeRequest, restoreUpgradeSettings } from '../src/data/equipmentUpgrade.js'
import { buildPotentialTargets } from '../src/data/potentialTargets.js'
import { CLASS_STATS } from '../src/data/classStats.js'

test('migration contract: every route keeps its pre-Workshop URL', () => {
  assert.deepEqual(PAGE_PATHS, legacyRoutes)
  for (const [page, path] of Object.entries(legacyRoutes)) assert.equal(pageForPath(path), page)
})

test('migration contract: old browser saves and version-1 exports round-trip without schema drift', () => {
  assert.equal(EQUIPMENT_STORAGE_KEY, 'maplestory-flame-equipment')
  const old = structuredClone(legacySavedBuild)
  const browser = {localStorage: {getItem: key => key === 'maplestory-flame-equipment' ? JSON.stringify(old) : null}}
  assert.deepEqual(readEquipmentSelection(browser), old)
  const equipment = restoreEquipment(old.equipment, old.equipment_class)
  assert.equal(equipment.hat.id, 1005980)
  assert.equal(equipment.hat.currentStarForce, 17)
  assert.deepEqual(serializeEquipment(equipment), old.equipment)
  const exported = JSON.parse(exportEquipment(equipment, old.equipment_class))
  assert.deepEqual(exported, {format: 'maplestory-equipment', version: 1, equipment_class: 'Hero', equipment: old.equipment})
  assert.deepEqual(serializeEquipment(importEquipment(JSON.stringify(exported)).equipment), old.equipment)
  assert.deepEqual(old, legacySavedBuild, 'restoring does not mutate the source save')
})

test('migration contract: equipment upgrade payload matches the old full request', () => {
  const equipment = restoreEquipment(legacySavedBuild.equipment, 'Hero')
  assert.deepEqual(buildUpgradeRequest(equipment, CLASS_STATS.Hero, legacySavedBuild.equipment_score_weights,
    restoreUpgradeSettings(legacySavedBuild.upgrade_settings)), upgradeRequest)
})

test('migration contract: combined All Stat requirements keep their old interpretation', () => {
  const requirements = [{id: 0, effect: 'STR_PCT', target: '13'}, {id: 1, effect: 'COOLDOWN_SEC', target: '4'}, {id: 2, effect: 'ALL_STAT_PCT', target: '1'}]
  assert.deepEqual(buildPotentialTargets(requirements), potentialMultipleRequest.targets)
})
