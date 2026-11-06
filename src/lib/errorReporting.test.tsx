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
import { installErrorReporting, reportError, resetErrorReporting } from './errorReporting'

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
