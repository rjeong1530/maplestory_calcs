import { Component } from 'react'

export default class PageErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <section className="panel bg-surface border border-solid border-rule rounded-sm p-6 [@media(max-width:480px)]:p-5" role="alert">
        <h2>This page could not load</h2>
        <p>Check your connection and reload to try again. Saved equipment will be restored;
          unsaved calculator inputs may need to be entered again.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload page</button>
      </section>
    }
    return this.props.children
  }
}
