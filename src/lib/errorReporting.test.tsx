import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('./supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import { ErrorBoundary } from '../ui/ErrorBoundary'
import { installErrorReporting, isBot, reportError, resetErrorReporting } from './errorReporting'

const reports = () => fake.rpcCalls.filter((c) => c.name === 'report_client_error').map((c) => c.args as Record<string, unknown>)

beforeEach(() => {
  fake = createFakeSupabase()
  resetErrorReporting()
  window.location.hash = '#/storico?giorno=2026-11-02'
})

describe('segnalazione errori', () => {
  it('manda messaggio, pagina senza parametri, versione e browser', () => {
    reportError('error', new TypeError('x is undefined'))
    expect(reports()).toEqual([
      expect.objectContaining({ p_kind: 'error', p_message: 'TypeError: x is undefined', p_route: '#/storico', p_app_version: __APP_VERSION__ }),
    ])
    expect(String(reports()[0].p_stack)).toContain('TypeError')
  })

  it('lo stesso errore una volta sola, e al massimo 10 per sessione', () => {
    reportError('error', new Error('uguale'))
    reportError('error', new Error('uguale'))
    for (let i = 0; i < 20; i++) reportError('rejection', `diverso ${i}`)
    expect(reports()).toHaveLength(10)
  })

  it('ignora il rumore: rete assente, script esterni, ResizeObserver', () => {
    for (const noise of [new TypeError('Failed to fetch'), 'Load failed', 'Script error.', 'ResizeObserver loop limit exceeded']) reportError('error', noise)
    expect(reports()).toEqual([])
  })

  it('non segnala il service worker rifiutato (robot, navigazione privata)', () => {
    const refused = new Error('Rejected')
    refused.stack = ['Error: Rejected', '    at navigator.serviceWorker.register (<anonymous>:12:648)', '    at https://x/bere-app/registerSW.js:1:98'].join('\n')
    reportError('rejection', refused)
    expect(reports()).toEqual([])
  })

  it('riconosce i robot, non i telefoni veri', () => {
    const read = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)'
    for (const ua of [read, 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'Mozilla/5.0 Chrome-Lighthouse', 'HeadlessChrome/120']) expect(isBot(ua)).toBe(true)
    for (const ua of [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    ]) expect(isBot(ua)).toBe(false)
  })

  it('dai robot non segnala nulla', () => {
    const spy = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (compatible; Googlebot/2.1)')
    reportError('error', new Error('qualsiasi'))
    expect(reports()).toEqual([])
    spy.mockRestore()
  })

  it('raccoglie errori e promesse rifiutate non gestiti', () => {
    const target = new EventTarget() as unknown as Window
    installErrorReporting(target)
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('esploso'), message: 'esploso' }))
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('rifiutata') }))
    expect(reports().map((r) => [r.p_kind, r.p_message])).toEqual([['error', 'Error: esploso'], ['rejection', 'Error: rifiutata']])
  })

  it('un errore in una pagina mostra «Ricarica» invece dello schermo bianco, e viene segnalato', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): never {
      throw new Error('pagina rotta')
    }
    render(<ErrorBoundary><Broken /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Qualcosa è andato storto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Ricarica l'app" })).toBeInTheDocument()
    expect(reports()).toEqual([expect.objectContaining({ p_kind: 'react', p_message: 'Error: pagina rotta' })])
  })
})
