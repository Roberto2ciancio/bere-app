import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

const push = vi.hoisted(() => ({
  pushSupportState: vi.fn(),
  subscribePush: vi.fn(),
  syncPushSubscription: vi.fn(),
}))
vi.mock('../push/subscribe', async (original) => ({ ...(await original<object>()), ...push }))

import App from '../App'
import { markOnboarded } from './onboardingFlag'

const heading = (name: string) => screen.findByRole('heading', { name })
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }))

function seedSchedule() {
  fake.tables.schedules = [{ id: 's1', user_id: 'u1', name: 'Mio', weekdays: [1], enabled: true }]
  fake.tables.schedule_times = [{ id: 't1', schedule_id: 's1', minutes: 480 }]
}

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.setInvokeResult({ status: 'sent' })
  push.pushSupportState.mockReturnValue('prompt')
  push.subscribePush.mockResolvedValue(undefined)
  push.syncPushSubscription.mockResolvedValue(undefined)
  window.location.hash = '#/home'
})

describe('quando parte', () => {
  it('un nuovo utente arriva ai promemoria, senza programmi già pronti', async () => {
    render(<App />)
    expect(await heading('Quando vuoi bere?')).toBeInTheDocument()
    expect(screen.queryByText(/modello/i)).not.toBeInTheDocument()
    expect(fake.tables.schedules ?? []).toHaveLength(0)
  })

  it('chi ha concluso o saltato non lo rivede', async () => {
    markOnboarded('u1')
    render(<App />)
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('heading', { name: 'Quando vuoi bere?' })).not.toBeInTheDocument()
  })

  it('chi ha programmi e notifiche attive non lo vede', async () => {
    seedSchedule()
    push.pushSupportState.mockReturnValue('granted')
    render(<App />)
    await screen.findByRole('button', { name: /ho bevuto/i })
    await waitFor(() => expect(fake.tables.schedules).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(window.location.hash).toBe('#/home')
  })

  it('con programmi ma notifiche mai attivate su questo telefono parte dalle notifiche', async () => {
    seedSchedule()
    render(<App />)
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
  })

  it('se i programmi non si caricano non manda nessuno al primo avvio', async () => {
    fake.tables.schedules = []
    const original = fake.client.from
    vi.spyOn(fake.client, 'from').mockImplementation(((table: string) => {
      if (table === 'schedules') throw new Error('offline')
      return original(table)
    }) as typeof fake.client.from)
    render(<App />)
    await screen.findByRole('button', { name: /ho bevuto/i })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(window.location.hash).toBe('#/home')
  })
})

describe('passo dei promemoria', () => {
  it('dopo aver creato il programma passa alle notifiche', async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('30 min')
    await click('Crea promemoria')
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
    expect(fake.tables.schedules[0].name).toBe('Ogni 30 min')
  })

  it('si possono scegliere gli orari a mano e poi proseguire', async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Preferisco scegliere gli orari a mano')
    await userEvent.type(screen.getByLabelText('Nome del programma'), 'Mio')
    const time = screen.getByLabelText('Nuovo orario')
    await userEvent.type(time, '10:15')
    await click('Aggiungi orario')
    await click('Salva programma')
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
  })

  it('si può rimandare e non viene riproposto', async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Più tardi')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Oggi' })).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(window.location.hash).toBe('#/home')
  })
})

describe('passo delle notifiche', () => {
  beforeEach(seedSchedule)

  it('attivate le notifiche passa alla prova', async () => {
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    expect(push.subscribePush).toHaveBeenCalledTimes(1)
    expect(await heading('Prova la notifica')).toBeInTheDocument()
  })

  it('se l\'attivazione fallisce si può riprovare', async () => {
    push.subscribePush.mockRejectedValueOnce(new Error('no'))
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è stato possibile attivare/i)
    expect(screen.getByRole('button', { name: 'Attiva le notifiche' })).toBeEnabled()
  })

  it('se il permesso viene negato spiega come riattivarlo e lascia proseguire', async () => {
    push.subscribePush.mockImplementationOnce(async () => {
      push.pushSupportState.mockReturnValue('denied')
      throw new Error('permesso negato')
    })
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    expect(await screen.findByText(/le notifiche sono bloccate/i)).toBeInTheDocument()
    await click('Continua senza notifiche')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })

  it('su iPhone senza installazione spiega come installare', async () => {
    fake.tables.schedules = []
    fake.tables.schedule_times = []
    push.pushSupportState.mockReturnValue('needs-install')
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Crea promemoria')
    expect(await heading("Prima installa l'app")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Attiva le notifiche' })).not.toBeInTheDocument()
    await click('Continua')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })

  it('un browser che non supporta le notifiche lo dice e lascia proseguire', async () => {
    fake.tables.schedules = []
    fake.tables.schedule_times = []
    push.pushSupportState.mockReturnValue('unsupported')
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Crea promemoria')
    expect(await screen.findByText(/non può ricevere notifiche/i)).toBeInTheDocument()
    await click('Continua')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })

  it('con il permesso già concesso salta alla prova', async () => {
    fake.tables.schedules = []
    fake.tables.schedule_times = []
    push.pushSupportState.mockReturnValue('granted')
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Crea promemoria')
    expect(await heading('Prova la notifica')).toBeInTheDocument()
  })
})

describe('passo della prova', () => {
  beforeEach(() => {
    seedSchedule()
  })

  async function reachTest() {
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    await heading('Prova la notifica')
  }

  it('invia la prova, registra il telefono e chiede se è arrivata', async () => {
    await reachTest()
    await click('Invia notifica di prova')
    expect(push.syncPushSubscription).toHaveBeenCalled()
    expect(fake.invocations.map((i) => i.name)).toContain('test-push')
    expect(await screen.findByRole('status')).toHaveTextContent(/chiudi l'app/i)
    await click('È arrivata')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })

  it('finita la prova non viene più riproposto', async () => {
    await reachTest()
    await click('Invia notifica di prova')
    await screen.findByRole('status')
    await click('È arrivata')
    await screen.findByRole('button', { name: /ho bevuto/i })
    push.pushSupportState.mockReturnValue('prompt')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(window.location.hash).toBe('#/home')
    expect(localStorage.getItem('bere.onboarded.u1')).not.toBeNull()
  })

  it('se non arriva porta allo stato delle notifiche', async () => {
    await reachTest()
    await click('Invia notifica di prova')
    await screen.findByRole('status')
    await click('Non è arrivata')
    expect(await heading('Stato notifiche')).toBeInTheDocument()
  })

  it('se la prova non parte lo dice e lascia riprovare', async () => {
    fake.setInvokeResult({ status: 'failed' })
    await reachTest()
    await click('Invia notifica di prova')
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è partita/i)
    expect(screen.queryByRole('button', { name: 'È arrivata' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invia notifica di prova' })).toBeEnabled()
  })

  it('se il telefono non risulta registrato lo dice', async () => {
    fake.setInvokeResult({ status: 'no-device' })
    await reachTest()
    await click('Invia notifica di prova')
    expect(await screen.findByRole('alert')).toHaveTextContent(/non risulta registrato/i)
  })

  it('se la registrazione fallisce non invia una prova destinata a fallire', async () => {
    await reachTest()
    push.syncPushSubscription.mockRejectedValueOnce(new Error('offline'))
    await click('Invia notifica di prova')
    expect(await screen.findByRole('alert')).toHaveTextContent(/controlla la connessione/i)
    expect(fake.invocations).toHaveLength(0)
  })

  it('la prova si può saltare', async () => {
    await reachTest()
    await click('Salta la prova')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })
})
