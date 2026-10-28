import { bugReportPage, plannerPage, potentialPage } from './preloadPage'
import Navigation from './components/Navigation'
import LandingPage from './components/LandingPage'
import usePageRoute from './hooks/usePageRoute'
import DeferredPage from './components/DeferredPage'
import { PageGuide } from './components/PublicPageContent'
import usePageMetadata from './hooks/usePageMetadata'
import { AppShell, PageHeader, ContentCard } from './ui'
import PageTransition from './ui/PageTransition'
import { pageMetadata } from './data/pageContent'

const PotentialCalculator = potentialPage.Component
const EquipmentPlanner = plannerPage.Component
const BugReportPage = bugReportPage.Component

export default function App() {
  const [calculator, navigate] = usePageRoute()
  usePageMetadata(calculator)

  return (
    <AppShell navbar={<Navigation activePage={calculator} onNavigate={navigate} />}>
      <PageTransition page={calculator}>{visiblePage => <PageContent calculator={visiblePage} navigate={navigate} />}</PageTransition>
      <ContentCard id="about-workshop" className="mt-8" aria-labelledby="about-workshop-title">
        <h2 id="about-workshop-title" className="mw-heading mw-section-title">About Maple Workshop</h2>
        <p className="mw-muted mt-3 mb-0">Plan MapleStory upgrades with Star Force, flame and potential estimates, and compare upgrades across your equipment. Equipment is saved in this browser and can be exported as JSON. Results use the app’s bundled rules and tables, not live game data.</p>
      </ContentCard>
    </AppShell>
  )
}

function PageContent({ calculator, navigate }) {
  const metadata = pageMetadata(calculator)
  return <>
      <PageHeader title={calculator === 'starforce' ? 'Star Force Calculator' : metadata.heading}
        description={calculator === 'starforce' ? 'Calculate enhancement costs, success rates, and risk of destruction.' : metadata.description}
        icon={calculator === 'starforce' ? '🌟' : undefined} eyebrow="Maple Workshop · Upgrade planning" />
      <div className={calculator === 'starforce' ? 'mw-starforce-page' : 'mw-legacy-page'}>

      {calculator === 'home' && <LandingPage onNavigate={navigate} />}
      <DeferredPage active={calculator === 'bugs'}>
        <BugReportPage />
      </DeferredPage>

      {!calculator && <section className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5">
        <h2>Page not found</h2>
        <p>Choose a calculator or Equipment upgrade from the navigation.</p>
      </section>}
      <DeferredPage active={['equipment', 'flame', 'starforce'].includes(calculator)} loadingVariant={calculator === 'equipment' ? 'equipment' : 'card'}>
        <EquipmentPlanner activeTab={calculator} onNavigate={navigate} />
      </DeferredPage>
      <DeferredPage active={calculator === 'potential'}>
        <PotentialCalculator />
      </DeferredPage>
      <div id="workshop-guides" className={calculator === 'starforce' ? 'mw-legacy-page mt-8' : undefined} tabIndex={-1}><PageGuide page={calculator === 'bugs' || !calculator ? 'home' : calculator} onNavigate={navigate} /></div>
      </div>
    </>
}
