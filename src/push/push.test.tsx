import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

const push = vi.hoisted(() => ({ state: 'granted', hasSubscription: true, subscribe: vi.fn(async () => {}) }))
vi.mock('./subscribe', async (original) => ({
  ...(await original<typeof import('./subscribe')>()),
  pushSupportState: () => push.state,
  hasDeviceSubscription: async () => push.hasSubscription,
  subscribePush: push.subscribe,
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { NotificationStatusPage } from './NotificationStatusPage'
import { detectPushState, type PushEnvironment } from './subscribe'

const env = (over: Partial<PushEnvironment> = {}): PushEnvironment => ({
  isIos: false,
  isStandalone: false,
  hasPush: true,
  permission: 'default',
  ...over,
})

describe('detectPushState', () => {
  it('iPhone non installato: serve l\'installazione', () => {
    expect(detectPushState(env({ isIos: true, hasPush: false }))).toBe('needs-install')
  })
  it('iPhone installato con permesso da chiedere', () => {
    expect(detectPushState(env({ isIos: true, isStandalone: true }))).toBe('prompt')
  })
  it('iPhone installato ma iOS troppo vecchio', () => {
    expect(detectPushState(env({ isIos: true, isStandalone: true, hasPush: false }))).toBe('unsupported')
  })
  it('browser senza push', () => {
    expect(detectPushState(env({ hasPush: false }))).toBe('unsupported')
  })
  it('permesso negato', () => {
    expect(detectPushState(env({ permission: 'denied' }))).toBe('denied')
  })
  it('permesso concesso', () => {
    expect(detectPushState(env({ permission: 'granted' }))).toBe('granted')
  })
})

function renderPage() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>
          <NotificationStatusPage />
        </MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
  fake.tables.push_log = []
  fake.tables.service_status = [{ id: 1, last_run_at: new Date().toISOString() }]
  fake.setInvokeResult({ status: 'sent' })
  push.state = 'granted'
  push.hasSubscription = true
  push.subscribe.mockClear()
  push.subscribe.mockImplementation(async () => {})
})

describe('NotificationStatusPage', () => {
  it('iPhone non installato mostra la guida', async () => {
    push.state = 'needs-install'
    renderPage()
    expect(await screen.findByText(/aggiungi alla schermata home/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /attiva le notifiche/i })).not.toBeInTheDocument()
  })

  it('il permesso si chiede solo dopo un tocco', async () => {
    push.state = 'prompt'
    renderPage()
    const button = await screen.findByRole('button', { name: /attiva le notifiche/i })
    expect(push.subscribe).not.toHaveBeenCalled()
    await userEvent.click(button)
    expect(push.subscribe).toHaveBeenCalledTimes(1)
  })

  it('un errore di attivazione viene mostrato', async () => {
    push.state = 'prompt'
    push.subscribe.mockRejectedValueOnce(new Error('no'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /attiva le notifiche/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è stato possibile attivare/i)
  })

  it('permesso negato mostra come risolvere', async () => {
    push.state = 'denied'
    renderPage()
    expect(await screen.findByText(/notifiche sono bloccate/i)).toBeInTheDocument()
    expect(screen.getByText(/impostazioni/i)).toBeInTheDocument()
  })

  it('permesso concesso ma nessuna iscrizione: avvisa e permette di riattivare', async () => {
    push.hasSubscription = false
    renderPage()
    expect(await screen.findByText(/questo telefono non è registrato/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /attiva le notifiche/i })).toBeInTheDocument()
  })

  it('tutto a posto: permette la notifica di prova', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /invia notifica di prova/i }))
    await waitFor(() => expect(fake.invocations).toEqual([{ name: 'test-push', body: undefined }]))
    expect(await screen.findByRole('status')).toHaveTextContent(/inviata/i)
  })

  it('una prova fallita viene segnalata', async () => {
    fake.failures.invoke = 'boom'
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /invia notifica di prova/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è partita/i)
  })

  it('iscrizione scartata: l\'ultimo invio senza telefono prevale e permette di riattivare', async () => {
    fake.tables.push_log = [
      { user_id: 'u1', scheduled_at: '2026-11-02T08:00:00Z', sent_at: null, received_at: null, status: 'no-device' },
      { user_id: 'u1', scheduled_at: '2026-11-02T07:00:00Z', sent_at: '2026-11-02T07:00:00Z', received_at: null, status: 'sent' },
    ]
    renderPage()
    expect(await screen.findByText(/questo telefono non è registrato/i)).toBeInTheDocument()
    expect(screen.queryByText(/notifiche sono attive/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /attiva le notifiche/i }))
    expect(push.subscribe).toHaveBeenCalledTimes(1)
  })

  it('una prova senza telefono registrato lo spiega e permette di riattivare', async () => {
    fake.setInvokeResult({ status: 'no-device' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /invia notifica di prova/i }))
    expect(await screen.findByText(/questo telefono non è registrato/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /attiva le notifiche/i })).toBeInTheDocument()
  })

  it('una prova rifiutata dal servizio push viene segnalata', async () => {
    fake.setInvokeResult({ status: 'failed' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /invia notifica di prova/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è partita/i)
  })

  it('servizio fermo da oltre 5 minuti: lo dice invece di mostrare tutto a posto', async () => {
    fake.tables.service_status = [{ id: 1, last_run_at: new Date(Date.now() - 6 * 60_000).toISOString() }]
    renderPage()
    expect(await screen.findByText(/servizio di invio è fermo/i)).toBeInTheDocument()
  })

  it('servizio mai partito: lo dice', async () => {
    fake.tables.service_status = [{ id: 1, last_run_at: null }]
    renderPage()
    expect(await screen.findByText(/servizio di invio è fermo/i)).toBeInTheDocument()
  })

  it('servizio attivo: nessun avviso', async () => {
    renderPage()
    await screen.findByText(/notifiche sono attive/i)
    expect(screen.queryByText(/servizio di invio è fermo/i)).not.toBeInTheDocument()
  })

  it('mostra invii recenti e ritardo', async () => {
    fake.tables.push_log = [
      { user_id: 'u1', scheduled_at: '2026-11-02T07:00:00Z', sent_at: '2026-11-02T07:03:00Z', received_at: '2026-11-02T07:03:30Z', status: 'sent' },
      { user_id: 'u1', scheduled_at: '2026-11-02T08:30:00Z', sent_at: null, received_at: null, status: 'missed' },
    ]
    renderPage()
    expect(await screen.findByText(/inviata con 3 min di ritardo/i)).toBeInTheDocument()
    expect(screen.getByText(/arrivata dopo 30 s/i)).toBeInTheDocument()
    expect(screen.getByText(/non inviata/i)).toBeInTheDocument()
  })
})
