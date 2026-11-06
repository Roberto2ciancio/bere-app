import { supabase } from './supabase'

export type ErrorKind = 'error' | 'rejection' | 'react'

/** Per sessione: lo stesso errore una volta sola, e non più di 10 in tutto. */
const MAX_PER_SESSION = 10
const seen = new Set<string>()

// Rumore che non dice nulla dell'app: rete assente, estensioni del browser, script di altri siti.
const IGNORED = [/failed to fetch/i, /load failed/i, /networkerror/i, /resizeobserver loop/i, /^script error\.?$/i, /aborterror/i]

// Robot che aprono il sito (Google, Bing, Lighthouse…): i loro errori non riguardano gli utenti.
const BOTS = /bot\b|crawler|spider|google-|googleother|lighthouse|headlesschrome|bingpreview|facebookexternalhit|slurp/i

/** Il service worker rifiutato (robot, navigazione privata, spazio pieno): l'app funziona lo stesso, senza notifiche. */
const serviceWorkerRefused = (stack: string | null) => !!stack && /serviceWorker\.register|registerSW\.js/.test(stack)

export const isBot = (userAgent: string) => BOTS.test(userAgent)

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack ?? null }
  if (typeof error === 'string') return { message: error, stack: null }
  try {
    return { message: JSON.stringify(error) ?? String(error), stack: null }
  } catch {
    return { message: String(error), stack: null }
  }
}

/** La pagina senza parametri: niente dati dell'utente nell'indirizzo. */
function currentRoute(): string {
  try {
    return (location.hash || '#/').split('?')[0]
  } catch {
    return ''
  }
}

export function reportError(kind: ErrorKind, error: unknown, extraStack?: string) {
  const { message, stack } = describe(error)
  if (!message.trim() || IGNORED.some((pattern) => pattern.test(message))) return
  if (isBot(navigator.userAgent) || serviceWorkerRefused(stack)) return
  const key = `${kind}:${message}`
  if (seen.has(key) || seen.size >= MAX_PER_SESSION) return
  seen.add(key)
  // Segnalare un errore non deve mai causarne un altro.
  void Promise.resolve(
    supabase.rpc('report_client_error', {
      p_kind: kind,
      p_message: message.slice(0, 500),
      p_stack: [stack, extraStack].filter(Boolean).join('\n--\n').slice(0, 4000) || null,
      p_route: currentRoute(),
      p_app_version: __APP_VERSION__,
      p_user_agent: navigator.userAgent.slice(0, 300),
    }),
  ).catch(() => {})
}

export function installErrorReporting(target: Window = window) {
  target.addEventListener('error', (event) => reportError('error', event.error ?? event.message))
  target.addEventListener('unhandledrejection', (event) => reportError('rejection', event.reason))
}

/** Solo per i test. */
export function resetErrorReporting() {
  seen.clear()
}
