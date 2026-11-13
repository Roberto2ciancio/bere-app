import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

vi.mock('../ui/motion/effects', async (original) => ({
  ...(await original<typeof import('../ui/motion/effects')>()),
  confetti: vi.fn(),
}))

import App from '../App'
import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { addDays, localParts } from '../domain/time'
import { HomePage } from '../home/HomePage'
import { readCache, writeCache } from '../lib/cache'
import { markOnboarded } from '../onboarding/onboardingFlag'
import { isGluCalm, setGluCalm } from './calm'
import { PHRASES, SPECIAL_PHRASES } from './phrases'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const nowLocal = new Date()
// Le 14:00 locali di oggi: abbastanza tardi perché «3 ore fa» sia dopo l'inizio giornata (8:00).
const AFTERNOON = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 14, 0, 0)
const today = () => localParts(new Date(), tz).date
const HOUR = 3_600_000
const MIN = 60_000

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const drinkAt = (ms: number) => ({ user_id: 'u1', client_id: `d${ms}`, amount_ml: 200, local_date: today(), drunk_at: ago(ms) })
const coffeeAt = (ms: number) => ({ user_id: 'u1', client_id: `k${ms}`, kind: 'coffee', mg: 80, local_date: today(), taken_at: ago(ms) })
const total = (day: string, ml: number) => ({ day, total_ml: ml, drinks: 3 })
const streakOf = (days: number) => Array.from({ length: days }, (_, i) => total(addDays(today(), -(i + 1)), 3000))

function seed() {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  markOnboarded('u1')
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'glu', drink_ml: 200, tz, sound: 'none', units: 'ml' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.caffeine_intakes = []
  fake.tables.goal_boosts = []
  fake.tables.pause_periods = []
  fake.rpcResults.daily_totals = []
  // Saluto di oggi già dato: niente «hello» tra i piedi.
  writeCache('bere.gluHello.u1', today())
}

function renderHome() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

const glu = () => screen.getByTestId('glu')
const mood = () => glu().getAttribute('data-mood')
const droop = () => document.querySelector('.glu-droop')?.getAttribute('transform') ?? null
const bubble = () => document.querySelector('.glu-bubble')?.textContent ?? ''

beforeEach(() => {
  seed()
  vi.useFakeTimers({ shouldAdvanceTime: true, now: AFTERNOON })
})
afterEach(() => vi.useRealTimers())

describe('Glu: sete', () => {
  it('3 ore dall’ultima bevuta: mezza sete; a 4 ore thirsty con la sventolata; col tempo cresce', async () => {
    fake.tables.drinks = [drinkAt(3 * HOUR)]
    renderHome()
    await screen.findByTestId('glu')
    await waitFor(() => expect(droop()).toContain('scale(1 0.96)'))
    expect(mood()).not.toBe('thirsty')
    expect(document.querySelector('.glu-fan')).toBeNull()

    // L'orologio avanza e nessun dato cambia: la sete cresce da sola.
    await act(() => vi.advanceTimersByTimeAsync(HOUR + MIN))
    expect(mood()).toBe('thirsty')
    expect(document.querySelector('.glu-fan')).not.toBeNull()
    expect(SPECIAL_PHRASES.thirstyStrong).toContain(bubble())
  })

  it('una bevuta nuova azzera tutto', async () => {
    fake.tables.drinks = [drinkAt(4 * HOUR)]
    renderHome()
    await waitFor(() => expect(mood()).toBe('thirsty'))
    fireEvent.click(await screen.findByRole('button', { name: /ho bevuto/i }))
    await waitFor(() => expect(mood()).toBe('drink'))
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(mood()).not.toBe('thirsty')
    expect(document.querySelector('.glu-fan')).toBeNull()
    expect(droop()).toBeNull()
  })
})

describe('Glu: obiettivo raggiunto', () => {
  it('ultima bevuta 5 ore fa ma obiettivo già centrato: niente sete né ventaglio, umore goal', async () => {
    fake.tables.drinks = [{ ...drinkAt(5 * HOUR), amount_ml: 3000 }]
    renderHome()
    await screen.findByTestId('glu')
    await waitFor(() => expect(mood()).toBe('goal'))
    expect(droop()).toBeNull()
    expect(document.querySelector('.glu-fan')).toBeNull()
  })
})

describe('Glu: caffè', () => {
  it('un caffè appena segnato: coffee con la sua frase per 4 secondi, poi basta', async () => {
    fake.tables.drinks = [drinkAt(10 * MIN)]
    fake.tables.caffeine_intakes = [coffeeAt(1000)]
    renderHome()
    await waitFor(() => expect(mood()).toBe('coffee'))
    expect(PHRASES.coffee).toContain(bubble())
    expect(document.querySelector('.glu-jitter')).not.toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(4000))
    expect(mood()).not.toBe('coffee')
    expect(document.querySelector('.glu-jitter')).toBeNull()
  })

  it('un caffè di 5 minuti fa (all’apertura) non scatena niente', async () => {
    fake.tables.drinks = [drinkAt(10 * MIN)]
    fake.tables.caffeine_intakes = [coffeeAt(5 * MIN)]
    renderHome()
    await screen.findByTestId('glu')
    expect(mood()).not.toBe('coffee')
    expect(document.querySelector('.glu-jitter')).toBeNull()
  })
})

describe('Glu: allenamento', () => {
  it('attivarlo: workout per 6 s, poi resta la fascia', async () => {
    fake.tables.drinks = [drinkAt(10 * MIN)]
    renderHome()
    await screen.findByTestId('glu')
    expect(document.querySelector('.glu-headband')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /ho fatto allenamento/i }))
    await waitFor(() => expect(mood()).toBe('workout'))
    expect(bubble()).toMatch(/^Obiettivo di oggi \+/)
    expect(document.querySelector('.glu-headband')).not.toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(6100))
    expect(mood()).not.toBe('workout')
    expect(document.querySelector('.glu-headband')).not.toBeNull()
  })

  it('già attivo al caricamento: fascia sì, scenetta no', async () => {
    fake.tables.drinks = [drinkAt(10 * MIN)]
    fake.tables.goal_boosts = [{ user_id: 'u1', local_date: today(), kind: 'workout', extra_ml: 500, note: null }]
    renderHome()
    await waitFor(() => expect(document.querySelector('.glu-headband')).not.toBeNull())
    expect(mood()).not.toBe('workout')
  })
})

describe('Glu: serie e corona', () => {
  it('7 giorni la prima volta: la corona cade e il fumetto festeggia, una volta sola', async () => {
    fake.tables.drinks = [drinkAt(10 * MIN)]
    fake.rpcResults.daily_totals = streakOf(7)
    const first = renderHome()
    await waitFor(() => expect(document.querySelector('.glu-crown-drop')).not.toBeNull())
    expect(bubble()).toBe('7 giorni di fila! Guarda che corona.')
    expect(readCache<number>('bere.streakReward.u1')).toBe(7)
    await act(() => vi.advanceTimersByTimeAsync(6100))
    expect(document.querySelector('.glu-crown-drop')).toBeNull()
    expect(document.querySelector('.glu-crown')).not.toBeNull()

    first.unmount()
    renderHome()
    await waitFor(() => expect(fake.rpcCalls.filter((c) => c.name === 'daily_totals')).toHaveLength(2))
    await waitFor(() => expect(document.querySelector('.glu-crown')).not.toBeNull())
    expect(document.querySelector('.glu-crown-drop')).toBeNull()
    expect(bubble()).not.toContain('giorni di fila')
  })

  it('la bevuta di oggi conta subito: al 7º giorno la corona arriva senza aspettare', async () => {
    fake.tables.drinks = [{ ...drinkAt(10 * MIN), amount_ml: 3000 }]
    fake.rpcResults.daily_totals = streakOf(6)
    renderHome()
    await waitFor(() => expect(document.querySelector('.glu-crown-drop')).not.toBeNull())
    expect(readCache<number>('bere.streakReward.u1')).toBe(7)
  })

  it('finché gli obiettivi non arrivano dal server la serie non si calcola né si salva', async () => {
    fake.tables.drinks = [drinkAt(10 * MIN)]
    fake.rpcResults.daily_totals = streakOf(7)
    writeCache('bere.streakReward.u1', 7)
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const from = fake.client.from.bind(fake.client)
    vi.spyOn(fake.client, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as { select: (...args: unknown[]) => PromiseLike<unknown> }
      if (table !== 'goal_changes') return query
      return { ...query, select: (...args: unknown[]) => ({ eq: (...a: unknown[]) => gate.then(() => (query.select(...args) as unknown as { eq: (...x: unknown[]) => unknown }).eq(...a)) }) }
    }) as never)
    renderHome()
    await screen.findByTestId('glu')
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(document.querySelector('.glu-crown')).toBeNull()
    expect(readCache<number>('bere.streakReward.u1')).toBe(7)
    await act(async () => release())
    await waitFor(() => expect(document.querySelector('.glu-crown')).not.toBeNull())
    expect(document.querySelector('.glu-crown-drop')).toBeNull()
  })

  it('senza i totali giornalieri niente corona', async () => {
    fake.tables.drinks = [drinkAt(10 * MIN)]
    fake.rpcResults.daily_totals = streakOf(7)
    // Il server risponde con un errore: la serie è sconosciuta.
    const rpc = vi.spyOn(fake.client, 'rpc')
    rpc.mockImplementation(((name: string) => Promise.resolve({ data: null, error: { message: 'x' }, name })) as never)
    renderHome()
    await screen.findByTestId('glu')
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(document.querySelector('.glu-crown')).toBeNull()
  })
})

describe('«Glu tranquillo»', () => {
  it('niente caffè, allenamento, sete e discesa della corona; corona e fascia restano ferme', async () => {
    setGluCalm('u1', true)
    fake.tables.drinks = [drinkAt(4 * HOUR)]
    fake.tables.caffeine_intakes = [coffeeAt(5 * MIN)]
    fake.tables.goal_boosts = [{ user_id: 'u1', local_date: today(), kind: 'workout', extra_ml: 500, note: null }]
    fake.rpcResults.daily_totals = streakOf(14)
    renderHome()
    await waitFor(() => expect(document.querySelector('.glu-crown-gem')).not.toBeNull())
    expect(document.querySelector('.glu-headband')).not.toBeNull()
    expect(mood()).not.toBe('coffee')
    expect(mood()).not.toBe('thirsty')
    expect(document.querySelector('.glu-fan')).toBeNull()
    expect(document.querySelector('.glu-jitter')).toBeNull()
    expect(document.querySelector('.glu-crown-drop')).toBeNull()
    expect(droop()).toBeNull()
    // Spegne e riaccende l'allenamento: niente scenetta.
    fireEvent.click(screen.getByRole('button', { name: /allenamento segnato/i }))
    fireEvent.click(await screen.findByRole('button', { name: /ho fatto allenamento/i }))
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(mood()).not.toBe('workout')
  })

  it('l’interruttore in Profilo › Aspetto lo salva sul telefono', async () => {
    window.location.hash = '#/aspetto'
    render(<App />)
    const toggle = await screen.findByRole('checkbox', { name: /glu tranquillo/i })
    expect(toggle).not.toBeChecked()
    expect(screen.getByText('Glu resta, ma senza scenette e tremarelle.')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(isGluCalm('u1')).toBe(true)
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    expect(isGluCalm('u1')).toBe(false)
  })
})

describe('accessori sui Glu piccoli', () => {
  it('Storico con serie 14: corona con gemma', async () => {
    fake.rpcResults.daily_totals = [...streakOf(13), total(today(), 3000)]
    window.location.hash = '#/storico'
    render(<App />)
    await waitFor(() => expect(document.querySelector('.glu-crown-gem')).not.toBeNull())
  })

  it('Profilo: corona e fascia dai dati già salvati, senza scenette', async () => {
    writeCache('bere.gluStreak.u1', 14)
    writeCache('bere.boosts.u1', [{ local_date: today(), kind: 'workout', extra_ml: 500, note: null }])
    window.location.hash = '#/profilo'
    render(<App />)
    await waitFor(() => expect(document.querySelector('.glu-crown-gem')).not.toBeNull())
    expect(document.querySelector('.glu-headband')).not.toBeNull()
    expect(document.querySelector('.glu-crown-drop')).toBeNull()
  })
})
