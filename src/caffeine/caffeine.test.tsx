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
import { addDays, localParts } from '../domain/time'
import { HomePage } from '../home/HomePage'
import { summarizeCaffeine } from './caffeine'
import { pendingCaffeine } from './caffeineQueue'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

function row(kind = 'coffee', date = today(), mg = 80) {
  return { user_id: 'u1', client_id: crypto.randomUUID(), kind, mg, taken_at: new Date().toISOString(), local_date: date }
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

const coffee = () => screen.findByRole('button', { name: /caffè/i })

// Ogni tocco avviene oltre la soglia anti doppio tocco.
let clock = 1_800_000_000_000
function tapLater(button: HTMLElement) {
  clock += 1000
  vi.spyOn(Date, 'now').mockReturnValue(clock)
  fireEvent.click(button)
}

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.caffeine_intakes = []
})

describe('summarizeCaffeine', () => {
  it('somma i milligrammi e conta i caffè', () => {
    expect(summarizeCaffeine([{ kind: 'coffee', mg: 80 }, { kind: 'coffee', mg: 80 }])).toEqual({ totalMg: 160, coffees: 2, overLimit: false })
  })

  it('il limite si supera solo oltre 400 mg', () => {
    const entries = (n: number) => Array.from({ length: n }, () => ({ kind: 'coffee' as const, mg: 80 }))
    expect(summarizeCaffeine(entries(5)).overLimit).toBe(false)
    expect(summarizeCaffeine(entries(6)).overLimit).toBe(true)
  })
})

describe('caffeina in home', () => {
  it('non ci sono più Red Bull e Monster', async () => {
    renderHome()
    await coffee()
    expect(screen.queryByRole('button', { name: /red bull/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /monster/i })).not.toBeInTheDocument()
  })

  it('le Red Bull e le Monster già segnate non contano più', async () => {
    fake.tables.caffeine_intakes = [row('redbull'), row('monster', today(), 160), row('coffee')]
    renderHome()
    expect(await screen.findByRole('button', { name: 'Caffè, 1 oggi. Aggiungi' })).toBeInTheDocument()
    expect(await screen.findByText('80 mg di caffeina su 400')).toBeInTheDocument()
  })

  it('annullare non cancella le vecchie Red Bull nascoste', async () => {
    const old = { ...row('redbull'), taken_at: '2030-01-01T00:00:00Z' }
    fake.tables.caffeine_intakes = [row('coffee'), old]
    renderHome()
    await screen.findByRole('button', { name: 'Caffè, 1 oggi. Aggiungi' })
    fireEvent.click(await screen.findByRole('button', { name: 'Annulla caffeina' }))
    await waitFor(() => expect(fake.tables.caffeine_intakes).toEqual([old]))
  })

  it('mostra caffè e milligrammi di oggi', async () => {
    fake.tables.caffeine_intakes = [row(), row()]
    renderHome()
    expect(await screen.findByRole('button', { name: 'Caffè, 2 oggi. Aggiungi' })).toBeInTheDocument()
    expect(screen.getByText('160 mg di caffeina su 400')).toBeInTheDocument()
  })

  it('non conta i giorni precedenti', async () => {
    fake.tables.caffeine_intakes = [row('coffee', addDays(today(), -1))]
    renderHome()
    expect(await screen.findByRole('button', { name: 'Caffè, 0 oggi. Aggiungi' })).toBeInTheDocument()
  })

  it('un caffè si salva con 20 mg e non cambia l\'acqua', async () => {
    renderHome()
    tapLater(await coffee())
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
    expect(fake.tables.caffeine_intakes[0]).toMatchObject({ user_id: 'u1', kind: 'coffee', mg: 80, local_date: today() })
    expect(fake.tables.drinks).toHaveLength(0)
    expect(screen.getAllByText('0 L')[0]).toBeInTheDocument()
  })

  it('i caffè già segnati a 20 mg restano a 20, i nuovi valgono 80', async () => {
    fake.tables.caffeine_intakes = [row('coffee', today(), 20)]
    renderHome()
    await screen.findByText('20 mg di caffeina su 400')
    tapLater(await coffee())
    expect(await screen.findByText('100 mg di caffeina su 400')).toBeInTheDocument()
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(2))
    expect(fake.tables.caffeine_intakes.map((r) => r.mg)).toEqual([20, 80])
  })

  it('il doppio tocco entro 400 ms ne registra uno solo', async () => {
    renderHome()
    const button = await coffee()
    clock += 1000
    const now = vi.spyOn(Date, 'now').mockReturnValue(clock)
    fireEvent.click(button)
    now.mockReturnValue(clock + 399)
    fireEvent.click(button)
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
  })

  it('senza rete conta subito e sincronizza una sola volta', async () => {
    fake.failures.upsert = 'Failed to fetch'
    renderHome()
    tapLater(await coffee())
    expect(await screen.findByRole('button', { name: 'Caffè, 1 oggi. Aggiungi' })).toBeInTheDocument()
    await screen.findByText(/appena torna la rete/i)
    expect(pendingCaffeine('u1')).toHaveLength(1)
    fake.failures.upsert = null
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(fake.tables.caffeine_intakes).toHaveLength(1)
  })

  it('riaperta senza rete mostra quanto già salvato oggi', async () => {
    fake.tables.caffeine_intakes = [row()]
    const first = renderHome()
    await screen.findByRole('button', { name: 'Caffè, 1 oggi. Aggiungi' })
    first.unmount()
    fake.failures.select = 'Failed to fetch'
    renderHome()
    expect(await screen.findByRole('button', { name: 'Caffè, 1 oggi. Aggiungi' })).toBeInTheDocument()
  })

  it('senza caffeina non propone di annullare', async () => {
    renderHome()
    await coffee()
    expect(screen.queryByRole('button', { name: 'Annulla caffeina' })).not.toBeInTheDocument()
  })

  it('oltre 400 mg lo segnala', async () => {
    fake.tables.caffeine_intakes = Array.from({ length: 6 }, () => row())
    renderHome()
    expect(await screen.findByText('480 mg di caffeina: oltre i 400 di riferimento')).toBeInTheDocument()
  })
})
