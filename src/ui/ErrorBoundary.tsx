import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../lib/errorReporting'

/** Un errore in una pagina non lascia lo schermo bianco: si segnala e si offre di ricaricare. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError('react', error, info.componentStack ?? undefined)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page error-page" role="alert">
        <h1>Qualcosa è andato storto</h1>
        <p>Abbiamo ricevuto la segnalazione. Le tue bevute sono al sicuro.</p>
        <button className="primary" onClick={() => location.reload()}>Ricarica l'app</button>
      </main>
    )
  }
}
