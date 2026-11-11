import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { localParts } from '../domain/time'
import { HistoryPage } from '../history/HistoryPage'
import { HomePage } from '../home/HomePage'
import { LeaderboardPage } from '../leaderboard/LeaderboardPage'
import { readCache, writeCache } from '../lib/cache'
import { confetti } from '../ui/motion/effects'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

function renderIn(children: React.ReactNode) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(confetti).mockClear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'glu', drink_ml: 200, tz, sound: 'none', units: 'ml' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.pause_periods = []
  fake.rpcResults.get_levels = [{ user_id: 'u1', points: 1200 }]
})

describe('festa al nuovo livello', () => {
  it('la prima volta scrive il livello senza fare festa', async () => {
    renderIn(<HomePage />)
    await waitFor(() => expect(readCache<number>('bere.lastLevel.u1')).toBe(5))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confetti).not.toHaveBeenCalled()
  })

  it('con un livello in più apre la festa, una volta sola', async () => {
    writeCache('bere.lastLevel.u1', 4)
    const view = renderIn(<HomePage />)
    const dialog = await screen.findByRole('dialog', { name: 'Livello 5 · Ruscello' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(confetti).toHaveBeenCalledWith('level')
    expect(screen.getAllByTestId('glu')[0]).toHaveAttribute('data-mood', 'levelup')
    fireEvent.click(screen.getByRole('button', { name: 'Evviva!' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(readCache<number>('bere.lastLevel.u1')).toBe(5)
    view.unmount()
    renderIn(<HomePage />)
    await screen.findByTestId('glu')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('se il server non dà i punti non c’è festa', async () => {
    delete fake.rpcResults.get_levels
    writeCache('bere.lastLevel.u1', 1)
    renderIn(<HomePage />)
    await screen.findByTestId('glu')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(readCache<number>('bere.lastLevel.u1')).toBe(1)
  })

  it('livello e obiettivo insieme: prima il livello, poi l’obiettivo', async () => {
    writeCache('bere.lastLevel.u1', 4)
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'c1', amount_ml: 2900, local_date: today(), drunk_at: new Date().toISOString() }]
    renderIn(<HomePage />)
    await screen.findByRole('dialog', { name: 'Livello 5 · Ruscello' })
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)
    fireEvent.click(screen.getByRole('button', { name: /ho bevuto/i }))
    // Con il livello aperto l'obiettivo aspetta: un solo dialogo alla volta.
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Evviva!' }))
    expect(await screen.findByRole('dialog', { name: 'Obiettivo raggiunto!' })).toBeInTheDocument()
    expect(confetti).toHaveBeenCalledWith('goal')
  })
})

describe('pagine vuote con Glu', () => {
  it('classifica con solo l’utente', async () => {
    fake.rpcResults.get_leaderboard = [{ user_id: 'u1', display_name: 'Anna', avatar_path: null, days_met: 0, streak: 0 }]
    renderIn(<LeaderboardPage />)
    expect(await screen.findByTestId('glu')).toBeInTheDocument()
    expect(screen.getByText(/Il primo posto è libero/)).toBeInTheDocument()
  })

  it('storico senza bevute', async () => {
    renderIn(<HistoryPage />)
    expect(await screen.findByText('Nessuna bevuta segnata in questo giorno.')).toBeInTheDocument()
    expect(screen.getByTestId('glu')).toBeInTheDocument()
  })
})
