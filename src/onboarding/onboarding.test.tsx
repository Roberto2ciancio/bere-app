import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { formatLiters } from '../domain/format'
import { goalChangeDate } from '../domain/goals'
import { suggestGoal } from '../domain/hydration'
import { markOnboarded, pendingOnboardingStep, saveOnboardingProgress } from './onboardingFlag'

const heading = (name: string) => screen.findByRole('heading', { name })
const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }))

function seedSchedule() {
  fake.tables.schedules = [{ id: 's1', user_id: 'u1', name: 'Mio', weekdays: [1], enabled: true }]
  fake.tables.schedule_times = [{ id: 't1', schedule_id: 's1', minutes: 480 }]
}

beforeEach(() => {
  localStorage.clear()
  // Salvo diversa indicazione i test partono dai promemoria, cioè dopo i primi quattro passi.
  saveOnboardingProgress('u1', 'cup')
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
  it('un nuovo utente conosce Glu e, concluso il resto, arriva ai promemoria', async () => {
    localStorage.clear()
    render(<App />)
    expect(await screen.findByRole('progressbar', { name: 'Passo 1 di 7' })).toBeInTheDocument()
    expect(screen.getByText(/Sono Glu/)).toBeInTheDocument()
    await click('Iniziamo!')
    expect(await screen.findByRole('progressbar', { name: 'Passo 2 di 7' })).toBeInTheDocument()
    await click('Salta')
    await screen.findByRole('progressbar', { name: 'Passo 3 di 7' })
    await click('Salta')
    await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })
    await click('Salta')
    expect(await heading('Quando vuoi bere?')).toBeInTheDocument()
    expect(localStorage.getItem('bere.onboardingStep.u1')).toContain('cup')
  })

  it("chi ha chiuso l'app a metà riparte dal passo successivo", async () => {
    saveOnboardingProgress('u1', 'avatar')
    render(<App />)
    expect(await screen.findByRole('progressbar', { name: 'Passo 3 di 7' })).toBeInTheDocument()
  })

  it('dopo i primi passi non ci sono promemoria già pronti', async () => {
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

describe('passi 1-4', () => {
  beforeEach(() => localStorage.clear())

  it("l'avatar scelto si salva subito", async () => {
    saveOnboardingProgress('u1', 'hello')
    render(<App />)
    await screen.findByText('Come ti fai vedere in classifica?')
    await userEvent.click(screen.getAllByRole('radio')[0])
    await waitFor(() => expect(String(fake.tables.profiles[0].avatar_path)).toMatch(/^preset:/))
  })

  it('un avatar non salvato non risulta scelto e lo dice', async () => {
    saveOnboardingProgress('u1', 'hello')
    render(<App />)
    await screen.findByText('Come ti fai vedere in classifica?')
    fake.failures.update = 'offline'
    await userEvent.click(screen.getAllByRole('radio')[0])
    expect(await screen.findByRole('alert')).toHaveTextContent(/salvataggio non riuscito/i)
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it("con peso 70 e attività normale propone l'obiettivo calcolato e lo imposta da oggi", async () => {
    saveOnboardingProgress('u1', 'avatar')
    render(<App />)
    await screen.findByRole('progressbar', { name: 'Passo 3 di 7' })
    const goal = suggestGoal(70, 'light', false)
    fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '70' } })
    await click('Normale')
    expect(screen.getByText(`Per te: ${formatLiters(goal)} al giorno`)).toBeInTheDocument()
    await click('Avanti')
    expect(await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })).toBeInTheDocument()
    expect(fake.rpcCalls).toContainEqual({ name: 'set_initial_goal', args: { p_goal_ml: goal } })
    expect(fake.tables.profiles[0]).toMatchObject({ weight_kg: 70, activity: 'light' })
  })

  it("l'obiettivo si ritocca di 100 ml", async () => {
    saveOnboardingProgress('u1', 'avatar')
    render(<App />)
    await screen.findByRole('progressbar', { name: 'Passo 3 di 7' })
    const goal = suggestGoal(70, 'light', false)
    await click('Più acqua')
    expect(screen.getByText(`Per te: ${formatLiters(goal + 100)} al giorno`)).toBeInTheDocument()
  })

  it("se il server non accetta l'obiettivo da oggi, vale da domani e Glu lo dice", async () => {
    saveOnboardingProgress('u1', 'avatar')
    render(<App />)
    await screen.findByRole('progressbar', { name: 'Passo 3 di 7' })
    vi.spyOn(fake.client, 'rpc').mockResolvedValue({ data: null, error: { message: 'has_drinks' } } as never)
    await click('Avanti')
    expect(await screen.findByText(/Da domani/)).toBeInTheDocument()
    const goal = suggestGoal(70, 'light', false)
    expect(fake.tables.goal_changes).toContainEqual(expect.objectContaining({ user_id: 'u1', effective_from: goalChangeDate(new Date(), 'Europe/Rome'), goal_ml: goal }))
    await click('Avanti')
    expect(await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })).toBeInTheDocument()
  })

  it('il bicchiere scelto si salva e dice quanti ne servono', async () => {
    saveOnboardingProgress('u1', 'goal')
    fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 2300 }]
    render(<App />)
    await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })
    await click(/Bottiglietta/)
    expect(await screen.findByText(/Circa 5 bicchieri/)).toBeInTheDocument()
    await click('Avanti')
    expect(await heading('Quando vuoi bere?')).toBeInTheDocument()
    expect(fake.tables.profiles[0].drink_ml).toBe(500)
  })
})

describe('pendingOnboardingStep', () => {
  beforeEach(() => localStorage.clear())

  it('per chi non ha mai iniziato è il primo passo', () => {
    expect(pendingOnboardingStep('u1', 0)).toBe('hello')
  })
  it('dopo un passo concluso è il successivo, ma senza programmi non oltre i promemoria', () => {
    saveOnboardingProgress('u1', 'goal')
    expect(pendingOnboardingStep('u1', 0)).toBe('cup')
    saveOnboardingProgress('u1', 'notifications')
    expect(pendingOnboardingStep('u1', 0)).toBe('schedule')
  })
  it('chi ha programmi parte dalle notifiche, chi ha finito da nessuna parte', () => {
    push.pushSupportState.mockReturnValue('prompt')
    expect(pendingOnboardingStep('u1', 2)).toBe('notifications')
    markOnboarded('u1')
    expect(pendingOnboardingStep('u1', 0)).toBeNull()
  })
})
