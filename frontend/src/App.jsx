import { bugReportPage, plannerPage, potentialPage } from './preloadPage'
import Navigation from './components/Navigation'
import LandingPage from './components/LandingPage'
import usePageRoute from './hooks/usePageRoute'
import DeferredPage from './components/DeferredPage'
import './App.css'

const PotentialCalculator = potentialPage.Component
const EquipmentPlanner = plannerPage.Component
const BugReportPage = bugReportPage.Component

export default function App() {
  const [calculator, navigate] = usePageRoute()

  return (
    <main>
      <Navigation activePage={calculator} onNavigate={navigate} />
      <header className="page-header">
        <span className="eyebrow">MAPLESTORY CALCULATOR · EQUIPMENT UPGRADE LAB</span>
        <div className="page-title">
          {calculator === 'home' && <img className="page-logo" src="/maplecalculator.png" alt="MapleStory Calculator logo" width="72" height="72" />}
          <h1>{calculator === 'bugs' ? 'Help improve the calculator.' : calculator === 'home' ? 'Plan your next upgrade.' : 'Plan your next roll.'}</h1>
        </div>
        <p>{calculator === 'bugs' ? 'Found an incorrect result or something that does not work? Share what happened.' : calculator === 'home'
          ? 'Explore your odds, estimate enhancement costs, and find the next step for your character.'
          : 'Estimate your odds or plan your equipment upgrades.'}</p>
      </header>

      {calculator === 'home' && <LandingPage onNavigate={navigate} />}
      <DeferredPage active={calculator === 'bugs'}>
        <BugReportPage />
      </DeferredPage>

      {!calculator && <section className="panel">
        <h2>Page not found</h2>
        <p>Choose a calculator or Equipment upgrade from the navigation.</p>
      </section>}
      <DeferredPage active={['equipment', 'flame', 'starforce'].includes(calculator)}>
        <EquipmentPlanner activeTab={calculator} onNavigate={navigate} />
      </DeferredPage>
      <DeferredPage active={calculator === 'potential'}>
        <PotentialCalculator />
      </DeferredPage>
    </main>
  )
}
