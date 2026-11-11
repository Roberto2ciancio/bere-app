import '@fontsource/baloo-2/latin-600.css'
import '@fontsource/baloo-2/latin-700.css'
import '@fontsource/baloo-2/latin-800.css'
import '@fontsource/nunito/latin-500.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './lib/appUpdate'
import { installErrorReporting } from './lib/errorReporting'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { MotionRoot } from './ui/motion/MotionRoot'
import { rememberStartupData } from './profile/whatsNew'

// Prima del render: serve a distinguere un aggiornamento da una nuova installazione.
rememberStartupData()

// L'app di prova non ha un server: i suoi errori restano nella console.
if (import.meta.env.PROD && import.meta.env.MODE !== 'devapp') installErrorReporting()

if ('serviceWorker' in navigator) {
  watchForUpdates({ sw: navigator.serviceWorker, reload: () => location.reload(), doc: document })
}

if (import.meta.env.MODE === 'devapp') void import('./dev/mountDevBar')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionRoot>
        <App />
      </MotionRoot>
    </ErrorBoundary>
  </StrictMode>,
)
