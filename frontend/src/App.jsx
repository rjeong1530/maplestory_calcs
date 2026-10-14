import { bugReportPage, plannerPage, potentialPage } from './preloadPage'
import Navigation from './components/Navigation'
import LandingPage from './components/LandingPage'
import usePageRoute from './hooks/usePageRoute'
import DeferredPage from './components/DeferredPage'
import { PageHeader, PageGuide } from './components/PublicPageContent'
import usePageMetadata from './hooks/usePageMetadata'

const PotentialCalculator = potentialPage.Component
const EquipmentPlanner = plannerPage.Component
const BugReportPage = bugReportPage.Component

export default function App() {
  const [calculator, navigate] = usePageRoute()
  usePageMetadata(calculator)

  return (
    <main>
      <Navigation activePage={calculator} onNavigate={navigate} />
      <PageHeader page={calculator} />

      {calculator === 'home' && <LandingPage onNavigate={navigate} />}
      <DeferredPage active={calculator === 'bugs'}>
        <BugReportPage />
      </DeferredPage>

      {!calculator && <section className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5">
        <h2>Page not found</h2>
        <p>Choose a calculator or Equipment upgrade from the navigation.</p>
      </section>}
      <DeferredPage active={['equipment', 'flame', 'starforce'].includes(calculator)}>
        <EquipmentPlanner activeTab={calculator} onNavigate={navigate} />
      </DeferredPage>
      <DeferredPage active={calculator === 'potential'}>
        <PotentialCalculator />
      </DeferredPage>
      <PageGuide page={calculator} onNavigate={navigate} />
    </main>
  )
}
