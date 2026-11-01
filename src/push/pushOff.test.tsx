import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import App from '../App'

const ENDPOINT = 'https://push.example/telefono'

function browser(permission: NotificationPermission = 'granted') {
  const device = {
    current: null as unknown,
    unsubscribe: vi.fn(async () => {
      device.current = null
      return true
    }),
    subscribe: vi.fn(async () => {
      device.current = subscription
      return subscription
    }),
  }
  const subscription = {
    endpoint: ENDPOINT,
    toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: device.unsubscribe,
  }
  device.current = subscription
  const registration = {
    pushManager: { getSubscription: async () => device.current, subscribe: device.subscribe },
    showNotification: vi.fn(async () => {}),
  }
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', { permission, requestPermission: async () => permission })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: async () => registration },
  })
  return device
}

const registrations = () => fake.rpcCalls.filter((call) => call.name === 'register_push_subscription')

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.push_subscriptions = [{ user_id: 'u1', endpoint: ENDPOINT }]
  fake.tables.push_log = []
  fake.tables.service_status = [{ id: 1, last_run_at: new Date().toISOString() }]
  window.location.hash = '#/profilo'
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

async function turnOff() {
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Disattiva le notifiche' }))
  await screen.findByRole('button', { name: 'Attiva le notifiche' })
}

describe('spegnere le notifiche dal profilo', () => {
  it('toglie il telefono dal server e dal browser', async () => {
    const device = browser()
    await turnOff()
    expect(device.unsubscribe).toHaveBeenCalledTimes(1)
    expect(fake.tables.push_subscriptions).toHaveLength(0)
    expect(screen.getByText(/disattivate su questo telefono/i)).toBeInTheDocument()
  })

  it('riaprendo l\'app restano spente, senza registrare di nuovo il telefono', async () => {
    const device = browser()
    await turnOff()
    await waitFor(() => expect(device.unsubscribe).toHaveBeenCalled())
    const before = registrations().length
    cleanup()
    render(<App />)
    await screen.findByRole('button', { name: 'Attiva le notifiche' })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(device.subscribe).not.toHaveBeenCalled()
    expect(registrations()).toHaveLength(before)
    expect(fake.tables.push_subscriptions).toHaveLength(0)
  })

  it('si possono riattivare, e riaprendo restano attive', async () => {
    const device = browser()
    await turnOff()
    await userEvent.click(screen.getByRole('button', { name: 'Attiva le notifiche' }))
    expect(await screen.findByRole('button', { name: 'Disattiva le notifiche' })).toBeInTheDocument()
    expect(device.subscribe).toHaveBeenCalledTimes(1)
    const before = registrations().length
    expect(before).toBeGreaterThan(0)
    cleanup()
    render(<App />)
    await screen.findByRole('button', { name: 'Disattiva le notifiche' })
    await waitFor(() => expect(registrations().length).toBeGreaterThan(before))
  })

  it('se lo spegnimento fallisce lo dice e non finge di averlo fatto', async () => {
    const device = browser()
    device.unsubscribe.mockRejectedValueOnce(new Error('no'))
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Disattiva le notifiche' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è stato possibile disattivare/i)
    expect(screen.getByRole('button', { name: 'Disattiva le notifiche' })).toBeInTheDocument()
    expect(localStorage.getItem('bere.pushOff')).toBeNull()
  })

  it('se la riattivazione fallisce lo dice e restano spente', async () => {
    const device = browser()
    await turnOff()
    device.subscribe.mockRejectedValueOnce(new Error('no'))
    await userEvent.click(screen.getByRole('button', { name: 'Attiva le notifiche' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è stato possibile attivare/i)
    expect(screen.getByText(/disattivate su questo telefono/i)).toBeInTheDocument()
  })

  it('uscire dall\'account non equivale a spegnerle: al prossimo accesso tornano', async () => {
    browser()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Esci' }))
    await screen.findByRole('heading', { name: 'Accedi' })
    expect(localStorage.getItem('bere.pushOff')).toBeNull()
  })

  it('con il permesso da chiedere propone di attivarle', async () => {
    browser('default')
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Attiva le notifiche' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disattiva le notifiche' })).not.toBeInTheDocument()
  })

  it('con il permesso negato spiega dove intervenire, senza pulsanti inutili', async () => {
    browser('denied')
    render(<App />)
    expect(await screen.findByText(/bloccate dalle impostazioni/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /(dis)?attiva le notifiche/i })).not.toBeInTheDocument()
  })

  it('i programmi restano salvati', async () => {
    browser()
    fake.tables.schedules = [{ id: 's', user_id: 'u1', name: 'x', weekdays: [1], enabled: true }]
    await turnOff()
    expect(fake.tables.schedules).toHaveLength(1)
  })
})

describe('spegnere le notifiche da Stato notifiche', () => {
  beforeEach(() => {
    window.location.hash = '#/notifiche'
  })

  it('si spengono da lì e la pagina lo dice, senza allarmi né notifica di prova', async () => {
    browser()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Disattiva le notifiche' }))
    expect(await screen.findByText(/disattivate su questo telefono/i)).toBeInTheDocument()
    expect(screen.queryByText(/non è registrato/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /invia notifica di prova/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /attiva le notifiche/i })).toBeInTheDocument()
  })

  it('dopo la riattivazione un vecchio invio mancato non fa scattare il falso allarme', async () => {
    browser()
    window.location.hash = '#/profilo'
    await turnOff()
    await userEvent.click(screen.getByRole('button', { name: 'Attiva le notifiche' }))
    await screen.findByRole('button', { name: 'Disattiva le notifiche' })
    cleanup()
    fake.tables.push_log = [{ id: 'l', user_id: 'u1', scheduled_at: new Date(Date.now() - 3600_000).toISOString(), sent_at: null, received_at: null, status: 'no-device' }]
    window.location.hash = '#/notifiche'
    render(<App />)
    expect(await screen.findByRole('button', { name: /invia notifica di prova/i })).toBeInTheDocument()
    expect(await screen.findByText('Non inviata: nessun telefono registrato')).toBeInTheDocument()
    expect(screen.queryByText(/questo telefono non è registrato/i)).not.toBeInTheDocument()
  })

  it('un invio mancato dopo la riattivazione invece avvisa', async () => {
    browser()
    window.location.hash = '#/profilo'
    await turnOff()
    await userEvent.click(screen.getByRole('button', { name: 'Attiva le notifiche' }))
    await screen.findByRole('button', { name: 'Disattiva le notifiche' })
    cleanup()
    fake.tables.push_log = [{ id: 'l', user_id: 'u1', scheduled_at: new Date(Date.now() + 60_000).toISOString(), sent_at: null, received_at: null, status: 'no-device' }]
    window.location.hash = '#/notifiche'
    render(<App />)
    expect(await screen.findByText(/questo telefono non è registrato/i)).toBeInTheDocument()
  })

  it('riattivate torna la notifica di prova', async () => {
    browser()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Disattiva le notifiche' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Attiva le notifiche' }))
    expect(await screen.findByRole('button', { name: /invia notifica di prova/i })).toBeInTheDocument()
  })
})
