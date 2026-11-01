import '@fontsource-variable/bricolage-grotesque'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './lib/appUpdate'

if ('serviceWorker' in navigator) {
  watchForUpdates({ sw: navigator.serviceWorker, reload: () => location.reload(), doc: document })
}

if (import.meta.env.MODE === 'devapp') void import('./dev/mountDevBar')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
