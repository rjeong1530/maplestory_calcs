import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PageErrorBoundary from './components/PageErrorBoundary'
import { preloadPage } from './preloadPage'
import { pageForPath } from './data/routes'
import { apiRequest } from './api'

// Start waking the backend on arrival without delaying rendering or showing errors.
// Run outside React so StrictMode and component remounts do not repeat the request.
void apiRequest('/api/health', { cache: 'no-store' }).catch(() => {})

const root = createRoot(document.getElementById('root'))
const renderApp = () => root.render(<StrictMode><PageErrorBoundary><App /></PageErrorBoundary></StrictMode>)
const initialPage = pageForPath(window.location.pathname)
if (!initialPage || initialPage === 'home') {
  renderApp()
} else {
  // Keep the build-time guide visible until the interactive route is ready.
  if (!document.getElementById('root').hasChildNodes()) {
    root.render(<p role="status">Loading calculator tools…</p>)
  }
  // On failure, retry through the ordinary lazy loading path.
  preloadPage(initialPage).catch(() => {}).then(renderApp)
}
