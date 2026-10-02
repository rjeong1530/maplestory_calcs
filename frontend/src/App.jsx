import { lazy } from 'react'
import Navigation from './components/Navigation'
import LandingPage from './components/LandingPage'
import usePageRoute from './hooks/usePageRoute'
import DeferredPage from './components/DeferredPage'
import './App.css'

const PotentialCalculator = lazy(() => import('./components/PotentialCalculator'))
const StarForceCalculator = lazy(() => import('./components/StarForceCalculator'))
const EquipmentPlanner = lazy(() => import('./components/EquipmentPlanner'))

export default function App() {
  const [calculator, navigate] = usePageRoute()

  return (
    <main>
      <Navigation activePage={calculator} onNavigate={navigate} />
      <header className="page-header">
        <span className="eyebrow">MAPLESTORY · POTENTIAL LAB</span>
        <h1>{calculator === 'home' ? 'Plan your next upgrade.' : 'Plan your next roll.'}</h1>
        <p>{calculator === 'home'
          ? 'Explore your odds, estimate enhancement costs, and find the next step for your character.'
          : 'Estimate your odds or plan your equipment upgrades.'}</p>
      </header>

      {calculator === 'home' && <LandingPage onNavigate={navigate} />}

      {!calculator && <section className="panel">
        <h2>Page not found</h2>
        <p>Choose a calculator or Equipment upgrade from the navigation.</p>
      </section>}
      <DeferredPage active={calculator === 'starforce'}>
        <StarForceCalculator />
      </DeferredPage>
      <DeferredPage active={calculator === 'equipment' || calculator === 'flame'}>
        <EquipmentPlanner activeTab={calculator} />
      </DeferredPage>
      <DeferredPage active={calculator === 'potential'}>
        <PotentialCalculator />
      </DeferredPage>
    </main>
  )
}
