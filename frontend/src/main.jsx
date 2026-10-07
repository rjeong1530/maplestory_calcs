import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PageErrorBoundary from './components/PageErrorBoundary'
import { preloadPage } from './preloadPage'
import { pageForPath } from './data/routes'

const root = createRoot(document.getElementById('root'))
const renderApp = () => root.render(<StrictMode><PageErrorBoundary><App /></PageErrorBoundary></StrictMode>)
const initialPage = pageForPath(window.location.pathname)
if (!initialPage || initialPage === 'home') {
  renderApp()
} else {
  root.render(<p role="status">Loading calculator tools…</p>)
  // On failure, retry through the ordinary lazy loading path.
  preloadPage(initialPage).catch(() => {}).then(renderApp)
}
