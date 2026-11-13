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

vi.mock('../ui/motion/effects', async (original) => ({ ...(await original<object>()), confetti: vi.fn(), haptic: vi.fn() }))

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
  it('propone un ritmo regolare nella fascia scelta e lo salva', async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    fireEvent.change(screen.getByLabelText(/Mi sveglio/), { target: { value: '540' } })
    expect(screen.getByLabelText(/Mi sveglio/)).toHaveAttribute('aria-valuetext', '9:00')
    await click('Crea i promemoria')
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
    expect(fake.tables.schedules[0].weekdays).toEqual([1, 2, 3, 4, 5, 6, 7])
    const minutes = fake.tables.schedule_times.map((t) => t.minutes as number)
    expect(minutes[0]).toBe(540)
    expect(Math.max(...minutes)).toBeLessThanOrEqual(22 * 60)
  })

  it('lascia scegliere ogni quanto: il consigliato è già scelto, e la scelta guida gli orari', async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    const group = screen.getByRole('radiogroup', { name: 'Ogni quanto?' })
    const radios = Array.from(group.querySelectorAll('[role="radio"]'))
    expect(radios.map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('30 min'), expect.stringContaining('1 ora'), expect.stringContaining('3 ore')]))
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toMatch(/consigliato/)
    await userEvent.click(screen.getByRole('radio', { name: /^3 ore/ }))
    expect(screen.getByRole('radio', { name: /^3 ore/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/ogni 3 ore/)).toBeInTheDocument()
    await click('Crea i promemoria')
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
    const minutes = fake.tables.schedule_times.map((t) => t.minutes as number).sort((a, b) => a - b)
    expect(minutes.slice(0, 3)).toEqual([480, 660, 840])
  })

  it("il sonno non può scendere sotto un'ora dalla sveglia", async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    fireEvent.change(screen.getByLabelText(/Vado a dormire/), { target: { value: '0' } })
    expect(screen.getByLabelText(/Vado a dormire/)).toHaveAttribute('aria-valuetext', '9:00')
  })

  it('si possono scegliere gli orari a mano e poi proseguire', async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Scelgo io gli orari')
    await userEvent.type(screen.getByLabelText('Nome del programma'), 'Mio')
    await userEvent.type(screen.getByLabelText('Nuovo orario'), '10:15')
    await click('Aggiungi orario')
    await click('Salva programma')
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
  })

  it('«Salta» non crea promemoria e passa avanti', async () => {
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Salta')
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
    expect(fake.tables.schedules ?? []).toHaveLength(0)
  })
})

describe('passo delle notifiche', () => {
  beforeEach(seedSchedule)

  it('attivate le notifiche parte la prova e Glu chiede se è arrivata', async () => {
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    expect(push.subscribePush).toHaveBeenCalledTimes(1)
    expect(push.syncPushSubscription).toHaveBeenCalled()
    expect(await screen.findByText('Arrivata?')).toBeInTheDocument()
    expect(fake.invocations.map((i) => i.name)).toContain('test-push')
  })

  it('«Sì» porta al primo sorso', async () => {
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    await screen.findByText('Arrivata?')
    await click('Sì, è arrivata')
    expect(await heading('Primo sorso!')).toBeInTheDocument()
  })

  it('«No» porta al primo sorso e alla fine allo stato delle notifiche', async () => {
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    await screen.findByText('Arrivata?')
    await click('No, non è arrivata')
    await heading('Primo sorso!')
    await click('Salta')
    expect(await heading('Stato notifiche')).toBeInTheDocument()
  })

  it('dopo «No» il primo sorso non parla di Home e finisce sulle notifiche', async () => {
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    await screen.findByText('Arrivata?')
    await click('No, non è arrivata')
    await heading('Primo sorso!')
    await click('Registra il primo bicchiere')
    expect(await screen.findByText('Evviva! Ora sistemiamo le notifiche')).toBeInTheDocument()
    expect(screen.queryByText(/Home/)).not.toBeInTheDocument()
    await click('Sistemiamo le notifiche')
    expect(await heading('Stato notifiche')).toBeInTheDocument()
  })

  it('«Salta» dopo una prova fallita finisce sulle notifiche', async () => {
    fake.setInvokeResult({ status: 'failed' })
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    await screen.findByRole('alert')
    await click('Salta')
    await heading('Primo sorso!')
    await click('Salta')
    expect(await heading('Stato notifiche')).toBeInTheDocument()
  })

  it("se l'attivazione fallisce si può riprovare", async () => {
    push.subscribePush.mockRejectedValueOnce(new Error('no'))
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è stato possibile attivare/i)
    expect(screen.getByRole('button', { name: 'Attiva le notifiche' })).toBeEnabled()
  })

  it('se la prova non parte lo dice e lascia riprovare', async () => {
    fake.setInvokeResult({ status: 'failed' })
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è partita/i)
    fake.setInvokeResult({ status: 'sent' })
    await click('Riprova')
    expect(await screen.findByText('Arrivata?')).toBeInTheDocument()
  })

  it('se la registrazione fallisce non invia una prova destinata a fallire', async () => {
    render(<App />)
    await heading('Attiva le notifiche')
    push.syncPushSubscription.mockRejectedValueOnce(new Error('offline'))
    await click('Attiva le notifiche')
    expect(await screen.findByRole('alert')).toHaveTextContent(/controlla la connessione/i)
    expect(fake.invocations).toHaveLength(0)
  })

  it('se il permesso viene negato spiega come riattivarlo e lascia proseguire', async () => {
    push.subscribePush.mockImplementationOnce(async () => {
      push.pushSupportState.mockReturnValue('denied')
      throw new Error('permesso negato')
    })
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Attiva le notifiche')
    expect(await screen.findByText(/le notifiche sono bloccate\./i)).toBeInTheDocument()
    await click('Continua senza notifiche')
    expect(await heading('Primo sorso!')).toBeInTheDocument()
  })

  it('su iPhone senza installazione spiega come installare', async () => {
    fake.tables.schedules = []
    fake.tables.schedule_times = []
    push.pushSupportState.mockReturnValue('needs-install')
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Salta')
    expect(await heading("Prima installa l'app")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Attiva le notifiche' })).not.toBeInTheDocument()
    await click('Continua')
    expect(await heading('Primo sorso!')).toBeInTheDocument()
  })

  it('un browser che non supporta le notifiche lo dice e lascia proseguire', async () => {
    fake.tables.schedules = []
    fake.tables.schedule_times = []
    push.pushSupportState.mockReturnValue('unsupported')
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Salta')
    expect(await screen.findByText(/non può ricevere notifiche/i)).toBeInTheDocument()
    await click('Continua')
    expect(await heading('Primo sorso!')).toBeInTheDocument()
  })

  it('con il permesso già concesso il passo non compare', async () => {
    fake.tables.schedules = []
    fake.tables.schedule_times = []
    push.pushSupportState.mockReturnValue('granted')
    render(<App />)
    await heading('Quando vuoi bere?')
    await click('Crea i promemoria')
    expect(await heading('Primo sorso!')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Passo 7 di 7' })).toBeInTheDocument()
  })

  it('«Salta» non lo riproporrà', async () => {
    render(<App />)
    await heading('Attiva le notifiche')
    await click('Salta')
    await heading('Primo sorso!')
    await click('Salta')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(localStorage.getItem('bere.onboarded.u1')).not.toBeNull()
  })
})

describe('passo del primo sorso', () => {
  beforeEach(() => {
    seedSchedule()
    saveOnboardingProgress('u1', 'notifications')
    push.pushSupportState.mockReturnValue('granted')
  })

  it('registra una bevuta di drink_ml e porta alla Home', async () => {
    fake.tables.profiles[0].drink_ml = 500
    window.location.hash = '#/inizia'
    render(<App />)
    await heading('Primo sorso!')
    await click('Registra il primo bicchiere')
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    expect(fake.tables.drinks[0].amount_ml).toBe(500)
    expect(await screen.findByText('Evviva, il primo sorso è fatto!')).toBeInTheDocument()
    await click('Vai alla Home')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(localStorage.getItem('bere.onboarded.u1')).not.toBeNull()
  })

  it('si può saltare senza registrare nulla', async () => {
    window.location.hash = '#/inizia'
    render(<App />)
    await heading('Primo sorso!')
    await click('Salta')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(fake.tables.drinks ?? []).toHaveLength(0)
  })
})

describe('ingresso e ripresa', () => {
  it('chiuso al passo 4 riparte dal passo 4 con il peso già salvato', async () => {
    saveOnboardingProgress('u1', 'goal')
    fake.tables.profiles[0].weight_kg = 82
    window.location.hash = '#/inizia'
    render(<App />)
    expect(await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })).toBeInTheDocument()
    expect(fake.tables.profiles[0].weight_kg).toBe(82)
  })

  it("lo stato {step:'notifications'} apre il passo delle notifiche", async () => {
    window.location.hash = '#/inizia'
    window.history.replaceState({ usr: { step: 'notifications' }, key: 'k', idx: 0 }, '')
    render(<App />)
    expect(await heading('Attiva le notifiche')).toBeInTheDocument()
  })

  it('tutti i passi con «Salta» portano alla Home', async () => {
    localStorage.clear()
    push.pushSupportState.mockReturnValue('prompt')
    render(<App />)
    await screen.findByRole('progressbar', { name: 'Passo 1 di 7' })
    await click('Iniziamo!')
    for (const n of [2, 3, 4, 5, 6, 7]) {
      await screen.findByRole('progressbar', { name: `Passo ${n} di 7` })
      await click('Salta')
    }
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(localStorage.getItem('bere.onboarded.u1')).not.toBeNull()
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

  it('scegliere un avatar pronto cancella la foto caricata prima', async () => {
    saveOnboardingProgress('u1', 'hello')
    fake.tables.profiles[0].avatar_path = 'u1/foto.jpg'
    render(<App />)
    await screen.findByText('Come ti fai vedere in classifica?')
    await userEvent.click(screen.getAllByRole('radio')[0])
    await waitFor(() => expect(String(fake.tables.profiles[0].avatar_path)).toMatch(/^preset:/))
    await waitFor(() => expect(fake.removed).toEqual([{ bucket: 'avatars', paths: ['u1/foto.jpg'] }]))
  })

  it('un avatar pronto già scelto non fa cancellare nulla', async () => {
    saveOnboardingProgress('u1', 'hello')
    fake.tables.profiles[0].avatar_path = 'preset:altro'
    render(<App />)
    await screen.findByText('Come ti fai vedere in classifica?')
    await userEvent.click(screen.getAllByRole('radio')[0])
    await waitFor(() => expect(fake.tables.profiles[0].avatar_path).not.toBe('preset:altro'))
    expect(fake.removed).toEqual([])
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
    const deviceTz = new Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(fake.tables.goal_changes).toContainEqual(expect.objectContaining({ user_id: 'u1', effective_from: goalChangeDate(new Date(), deviceTz), goal_ml: goal }))
    await click('Avanti')
    expect(await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })).toBeInTheDocument()
  })

  it("«Salta» dopo aver salvato l'obiettivo non lo sovrascrive con 2 L", async () => {
    saveOnboardingProgress('u1', 'avatar')
    render(<App />)
    await screen.findByRole('progressbar', { name: 'Passo 3 di 7' })
    vi.spyOn(fake.client, 'rpc').mockResolvedValue({ data: null, error: { message: 'has_drinks' } } as never)
    await click('Avanti')
    await screen.findByText(/Da domani/)
    await click('Salta')
    expect(await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })).toBeInTheDocument()
    expect(fake.tables.goal_changes.filter((g) => g.goal_ml === 2000)).toHaveLength(0)
  })

  it("«Salta» su un account non nuovo non cambia l'obiettivo", async () => {
    fake.signIn('u1', '2026-01-01T00:00:00Z')
    window.location.hash = '#/inizia'
    window.history.replaceState({ usr: { step: 'goal' }, key: 'k', idx: 0 }, '')
    render(<App />)
    await screen.findByRole('progressbar', { name: 'Passo 3 di 7' })
    vi.spyOn(fake.client, 'rpc').mockResolvedValue({ data: null, error: { message: 'account_not_new' } } as never)
    await click('Salta')
    expect(await screen.findByRole('progressbar', { name: 'Passo 4 di 7' })).toBeInTheDocument()
    expect(fake.tables.goal_changes).toEqual([{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }])
  })

  it('ogni passo ha un titolo e il fuoco passa al titolo del nuovo passo', async () => {
    localStorage.clear()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Iniziamo!' }))
    const avatar = await heading('Scegli il tuo avatar')
    expect(avatar).toHaveFocus()
    await click('Salta')
    expect(await heading('Il tuo obiettivo giornaliero')).toHaveFocus()
    await click('Salta')
    expect(await heading('Il tuo bicchiere')).toHaveFocus()
    await click('Salta')
    expect(await heading('Quando vuoi bere?')).toHaveFocus()
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

describe('chi usa già l app', () => {
  beforeEach(() => {
    localStorage.clear()
    fake.signIn('u1', '2026-01-01T00:00:00Z')
  })

  it('su un telefono nuovo senza programmi parte dai promemoria e non vede «Primo sorso!»', async () => {
    push.pushSupportState.mockReturnValue('prompt')
    render(<App />)
    expect(await heading('Quando vuoi bere?')).toBeInTheDocument()
    await click('Crea i promemoria')
    await heading('Attiva le notifiche')
    await click('Salta')
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Primo sorso!' })).not.toBeInTheDocument()
    expect(localStorage.getItem('bere.onboarded.u1')).not.toBeNull()
  })

  it('aprire /inizia dopo il primo avvio riporta alla Home', async () => {
    markOnboarded('u1')
    window.location.hash = '#/inizia'
    render(<App />)
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/home')
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
  it('un account vecchio senza programmi parte dai promemoria, uno nuovo o senza data dal primo passo', () => {
    expect(pendingOnboardingStep('u1', 0, '2026-01-01T00:00:00Z')).toBe('schedule')
    expect(pendingOnboardingStep('u1', 0, new Date().toISOString())).toBe('hello')
    expect(pendingOnboardingStep('u1', 0, undefined)).toBe('hello')
  })
  it('chi ha programmi parte dalle notifiche, chi ha finito da nessuna parte', () => {
    push.pushSupportState.mockReturnValue('prompt')
    expect(pendingOnboardingStep('u1', 2)).toBe('notifications')
    markOnboarded('u1')
    expect(pendingOnboardingStep('u1', 0)).toBeNull()
  })
})
