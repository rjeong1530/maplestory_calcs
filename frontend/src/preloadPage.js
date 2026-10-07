import { createElement, lazy } from 'react'

function lazyPage(load) {
  let loaded
  let pending
  const preload = () => {
    if (!pending) pending = load().then(module => {
      loaded = module.default
      return module
    }).catch(error => {
      pending = undefined
      throw error
    })
    return pending
  }
  const Lazy = lazy(preload)
  function Component(props) {
    return createElement(loaded || Lazy, props)
  }
  return { Component, preload }
}

export const potentialPage = lazyPage(() => import('./components/PotentialCalculator'))
export const plannerPage = lazyPage(() => import('./components/EquipmentPlanner'))
export const flamePage = lazyPage(() => import('./components/FlameCalculator'))
export const starforcePage = lazyPage(() => import('./components/StarForceCalculator'))
export const equipmentPage = lazyPage(() => import('./components/EquipmentPage'))
export const equipmentSetup = lazyPage(() => import('./components/EquipmentWindow'))
export const equipmentStats = lazyPage(() => import('./components/EquipmentStats'))

// Resolve the first route before mounting it so nested lazy boundaries do not
// repeatedly suspend. Other routes remain demand-loaded.
export async function preloadPage(page) {
  if (page === 'potential') return potentialPage.preload()
  if (!['equipment', 'flame', 'starforce'].includes(page)) return
  const requests = [plannerPage.preload()]
  if (page === 'flame') requests.push(flamePage.preload())
  if (page === 'starforce') requests.push(starforcePage.preload())
  if (page === 'equipment') requests.push(
    equipmentPage.preload(), equipmentSetup.preload(), equipmentStats.preload(),
  )
  await Promise.all(requests)
}
