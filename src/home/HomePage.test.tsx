import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { localParts } from '../domain/time'
import { pendingDrinks } from '../drinks/drinkQueue'
import { HomePage } from './HomePage'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

function seed(style = 'bottle') {
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: style, drink_ml: 200, tz, sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
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

const drinkButton = () => screen.findByRole('button', { name: /ho bevuto/i })

// Ogni tocco avviene oltre la soglia anti doppio tocco.
let clock = 1_800_000_000_000
function tapLater(button: HTMLElement) {
  clock += 1000
  vi.spyOn(Date, 'now').mockReturnValue(clock)
  fireEvent.click(button)
}

beforeEach(() => {
  fake = createFakeSupabase()
  seed()
})

describe('HomePage', () => {
  it('mostra il totale già bevuto oggi', async () => {
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'x', amount_ml: 400, local_date: today(), drunk_at: new Date().toISOString() }]
    renderHome()
    expect((await screen.findAllByText('0,4 L')).length).toBeGreaterThan(0)
    expect(screen.getByText(/su 3 L/)).toBeInTheDocument()
  })

  it('segnare una bevuta salva sul server con la quantità del profilo', async () => {
    fake.tables.profiles[0].drink_ml = 250
    renderHome()
    tapLater(await drinkButton())
    expect((await screen.findAllByText('0,25 L')).length).toBeGreaterThan(0)
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    expect(fake.tables.drinks[0]).toMatchObject({ user_id: 'u1', amount_ml: 250, local_date: today() })
  })

  it('offline la bevuta aumenta il totale e resta in coda', async () => {
    fake.failures.upsert = 'Failed to fetch'
    renderHome()
    tapLater(await drinkButton())
    expect((await screen.findAllByText('0,2 L')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByText(/appena torna la rete/i)).toBeInTheDocument())
    expect(pendingDrinks('u1')).toHaveLength(1)
    expect(fake.tables.drinks).toHaveLength(0)
  })

  it('al ritorno della rete sincronizza una sola volta', async () => {
    fake.failures.upsert = 'Failed to fetch'
    renderHome()
    tapLater(await drinkButton())
    await screen.findByText(/appena torna la rete/i)
    fake.failures.upsert = null
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(fake.tables.drinks).toHaveLength(1)
    expect((await screen.findAllByText('0,2 L')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/appena torna la rete/i)).not.toBeInTheDocument()
  })

  it('tornando in primo piano sincronizza la coda', async () => {
    fake.failures.upsert = 'Failed to fetch'
    renderHome()
    tapLater(await drinkButton())
    await screen.findByText(/appena torna la rete/i)
    fake.failures.upsert = null
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
  })

  it('con bevute in coda ritenta da solo, anche se il telefono risulta sempre online', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      fake.failures.upsert = 'Failed to fetch'
      renderHome()
      tapLater(await drinkButton())
      await screen.findByText(/appena torna la rete/i)
      fake.failures.upsert = null
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })
      await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    } finally {
      vi.useRealTimers()
    }
  })

  it('il doppio tocco entro 400 ms registra una sola bevuta', async () => {
    renderHome()
    const button = await drinkButton()
    clock += 1000
    const now = vi.spyOn(Date, 'now').mockReturnValue(clock)
    fireEvent.click(button)
    now.mockReturnValue(clock + 399)
    fireEvent.click(button)
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    now.mockReturnValue(clock + 400)
    fireEvent.click(button)
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(2))
  })

  it('annulla toglie solo l\'ultima bevuta', async () => {
    renderHome()
    const button = await drinkButton()
    tapLater(button)
    tapLater(button)
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: /annulla/i }))
    expect((await screen.findAllByText('0,2 L')).length).toBeGreaterThan(0)
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
  })

  it('annulla una bevuta ancora in coda senza contattare il server', async () => {
    fake.failures.upsert = 'Failed to fetch'
    renderHome()
    tapLater(await drinkButton())
    await screen.findByText(/appena torna la rete/i)
    fireEvent.click(screen.getByRole('button', { name: /annulla/i }))
    expect((await screen.findAllByText('0 L')).length).toBeGreaterThan(0)
    expect(pendingDrinks('u1')).toEqual([])
  })

  it.each([
    ['bottle', 'bottle-view'],
    ['ring', 'ring-view'],
    ['drops', 'drops-view'],
  ])('home_style %s mostra la vista giusta', async (style, testId) => {
    seed(style)
    renderHome()
    expect(await screen.findByTestId(testId)).toBeInTheDocument()
  })

  it('obiettivo superato: la bottiglia resta piena e il testo mostra il totale reale', async () => {
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'x', amount_ml: 3400, local_date: today(), drunk_at: new Date().toISOString() }]
    renderHome()
    expect((await screen.findAllByText('3,4 L')).length).toBeGreaterThan(0)
    expect(screen.getByTestId('bottle-water').style.height).toBe('100%')
    expect(screen.getByText(/obiettivo raggiunto/i)).toBeInTheDocument()
  })

  it('riaperta senza rete usa profilo e obiettivo salvati', async () => {
    fake.tables.profiles[0].drink_ml = 300
    fake.tables.goal_changes[0].goal_ml = 2000
    const first = renderHome()
    await screen.findByRole('button', { name: /300 ml/ })
    await screen.findByText(/su 2 L/)
    first.unmount()
    fake.failures.select = 'Failed to fetch'
    fake.failures.upsert = 'Failed to fetch'
    renderHome()
    const button = await screen.findByRole('button', { name: /300 ml/ })
    expect(screen.getByText(/su 2 L/)).toBeInTheDocument()
    tapLater(button)
    expect((await screen.findAllByText('0,3 L')).length).toBeGreaterThan(0)
  })

  it('senza promemoria invita a impostarli', async () => {
    renderHome()
    expect(await screen.findByRole('link', { name: /imposta i promemoria/i })).toBeInTheDocument()
  })

  it('mostra il prossimo promemoria impostato', async () => {
    fake.tables.schedules = [{ id: 's1', user_id: 'u1', name: 'x', weekdays: [1, 2, 3, 4, 5, 6, 7], enabled: true }]
    fake.tables.schedule_times = [{ id: 't1', schedule_id: 's1', minutes: 0 }]
    renderHome()
    expect(await screen.findByText(/prossimo promemoria/i)).toHaveTextContent('0:00')
  })

  it('un programma disattivato non conta', async () => {
    fake.tables.schedules = [{ id: 's1', user_id: 'u1', name: 'x', weekdays: [1, 2, 3, 4, 5, 6, 7], enabled: false }]
    fake.tables.schedule_times = [{ id: 't1', schedule_id: 's1', minutes: 0 }]
    renderHome()
    expect(await screen.findByRole('link', { name: /imposta i promemoria/i })).toBeInTheDocument()
  })
})

describe('HomePage «Oggi»', () => {
  const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  it('dall’alto in basso: intestazione, fumetto, Glu, litri con %, Caffè e Allenamento, promemoria, «Ho bevuto»', async () => {
    seed('glu')
    renderHome()
    const drink = await drinkButton()
    const parts = [
      screen.getByRole('heading', { level: 1, name: 'Oggi' }),
      document.querySelector('.glu-bubble')!,
      screen.getByTestId('glu'),
      screen.getByText('su 3 L · 0%'),
      screen.getByRole('button', { name: /^Caffè/ }),
      screen.getByRole('button', { name: /allenamento/i }),
      screen.getByRole('link', { name: /imposta i promemoria/i }),
      drink,
    ]
    parts.forEach((el, i) => expect(el, `elemento ${i}`).toBeTruthy())
    for (let i = 1; i < parts.length; i++) expect(before(parts[i - 1], parts[i]), `elemento ${i - 1} prima di ${i}`).toBe(true)
    // La Newsletter resta nell'intestazione, accanto al titolo.
    expect(screen.getByRole('link', { name: /^Newsletter/ }).closest('.home-head')).not.toBeNull()
  })

  it('«Annulla l’ultima» compare solo dopo una bevuta', async () => {
    renderHome()
    const drink = await drinkButton()
    expect(screen.queryByRole('button', { name: "Annulla l'ultima" })).not.toBeInTheDocument()
    tapLater(drink)
    expect(await screen.findByRole('button', { name: "Annulla l'ultima" })).toBeInTheDocument()
  })

  it('la percentuale della riga è il livello dell’acqua di Glu e dell’anello', async () => {
    seed('glu')
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'x', amount_ml: 1400, local_date: today(), drunk_at: new Date().toISOString() }]
    renderHome()
    const row = await screen.findByText(/su 3 L · \d+%/)
    const percent = Number(/(\d+)%/.exec(row.textContent ?? '')![1])
    expect(percent).toBe(47)
    // Onda di Glu: y = 186 a corpo vuoto, 16 a corpo pieno.
    const wave = document.querySelector('.glu-water')!.getAttribute('d')!
    const y = Number(/^M0 (-?[\d.]+)/.exec(wave)![1])
    expect(Math.round(((186 - y) / 170) * 100)).toBe(percent)
    // Anello: la parte piena sulla circonferenza intera.
    const [dash, length] = screen.getByTestId('progress-ring-bar').getAttribute('stroke-dasharray')!.split(' ').map(Number)
    expect(Math.round((dash / length) * 100)).toBe(percent)
  })

  it.each([
    ['bottle', 'bottle-view'],
    ['drops', 'drops-view'],
    ['cat', 'character-cat'],
  ])('l’anello del progresso c’è anche con lo stile %s', async (style, testId) => {
    seed(style)
    renderHome()
    expect((await screen.findByTestId(testId)).closest('.progress-ring')).not.toBeNull()
  })

  it('lo stile Anello non ha un secondo anello attorno', async () => {
    seed('ring')
    renderHome()
    await screen.findByTestId('ring-view')
    expect(screen.queryByTestId('progress-ring')).not.toBeInTheDocument()
  })
})
