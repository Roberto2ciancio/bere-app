import { act, render, screen, within } from '@testing-library/react'
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
import { LeaderboardPage } from './LeaderboardPage'
import { weekStart } from './weekStart'

const entry = (user_id: string, display_name: string, days_met: number, streak: number, avatar_path: string | null = null) => ({
  user_id,
  display_name,
  avatar_path,
  days_met,
  streak,
  redbulls: 0,
  monster_until: null as string | null,
})

function renderPage() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <LeaderboardPage />
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
})

describe('weekStart', () => {
  it('di domenica restituisce il lunedì precedente', () => {
    expect(weekStart(new Date('2026-11-08T12:00:00Z'), 'Europe/Rome')).toBe('2026-11-02')
  })
  it('di lunedì restituisce lo stesso giorno', () => {
    expect(weekStart(new Date('2026-11-02T12:00:00Z'), 'Europe/Rome')).toBe('2026-11-02')
  })
  it('usa il giorno locale, non quello UTC', () => {
    expect(weekStart(new Date('2026-11-08T23:30:00Z'), 'Europe/Rome')).toBe('2026-11-09')
  })
})

describe('LeaderboardPage', () => {
  it('chiede la settimana corrente e mostra punteggio e serie', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2), entry('u1', 'Anna', 2, 1)]
    renderPage()
    const row = (await screen.findByText('Bruno')).closest('li')!
    expect(within(row).getByText('3/7')).toBeInTheDocument()
    expect(within(row).getByText(/serie 2/i)).toBeInTheDocument()
    expect(fake.rpcCalls.find((c) => c.name === 'get_leaderboard')?.args).toEqual({ week_start: weekStart(new Date(), new Intl.DateTimeFormat().resolvedOptions().timeZone) })
  })

  it('la riga dell\'utente è evidenziata', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2), entry('u1', 'Anna', 2, 1)]
    renderPage()
    expect((await screen.findByText('Anna')).closest('li')).toHaveClass('me')
    expect(screen.getByText('Bruno').closest('li')).not.toHaveClass('me')
  })

  it('un utente senza foto mostra le iniziali', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2)]
    renderPage()
    const row = (await screen.findByText('Bruno')).closest('li')!
    expect(within(row).getByText('B')).toBeInTheDocument()
  })

  it('un utente con foto mostra la foto', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2, 'u2/foto.jpg')]
    const { container } = renderPage()
    await screen.findByText('Bruno')
    expect(container.querySelector('img')?.getAttribute('src')).toContain('avatars/u2/foto.jpg')
  })

  it('a pari giorni e serie mostra la stessa posizione', async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 3, 2), entry('u2', 'Bruno', 3, 2), entry('u3', 'Carla', 1, 1)]
    renderPage()
    await screen.findByText('Anna')
    const rank = (name: string) => within(screen.getByText(name).closest('li')!).getByTestId('rank').textContent
    expect([rank('Anna'), rank('Bruno'), rank('Carla')]).toEqual(['1', '1', '3'])
  })

  it('senza punteggi mostra un messaggio di inizio settimana', async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 0, 0)]
    renderPage()
    expect(await screen.findByText(/nessuno ha ancora raggiunto/i)).toBeInTheDocument()
  })

  it('mostra le Red Bull della settimana accanto all\'icona', async () => {
    fake.rpcResults.get_leaderboard = [{ ...entry('u2', 'Bruno', 3, 2), redbulls: 7 }]
    renderPage()
    const row = (await screen.findByText('Bruno')).closest('li')!
    const count = within(row).getByLabelText('7 Red Bull questa settimana')
    expect(count).toHaveTextContent('7')
    expect(count.querySelector('svg')).toBeInTheDocument()
  })

  it('il segno Monster mostra i minuti che mancano', async () => {
    fake.rpcResults.get_leaderboard = [{ ...entry('u2', 'Bruno', 3, 2), monster_until: new Date(Date.now() + 42 * 60_000).toISOString() }]
    renderPage()
    const row = (await screen.findByText('Bruno')).closest('li')!
    expect(within(row).getByLabelText('Segno negativo per Monster, ancora 42 min')).toBeInTheDocument()
  })

  it('senza Monster non mostra il segno', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2)]
    renderPage()
    const row = (await screen.findByText('Bruno')).closest('li')!
    expect(within(row).queryByLabelText(/segno negativo/i)).not.toBeInTheDocument()
  })

  it('il segno sparisce da solo allo scadere, con la pagina aperta', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    try {
      fake.rpcResults.get_leaderboard = [{ ...entry('u2', 'Bruno', 3, 2), monster_until: new Date(Date.now() + 60_000).toISOString() }]
      renderPage()
      const row = (await screen.findByText('Bruno')).closest('li')!
      expect(within(row).getByLabelText(/segno negativo/i)).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000)
      })
      expect(within(row).queryByLabelText(/segno negativo/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('il segno Monster e le Red Bull non cambiano le posizioni', async () => {
    fake.rpcResults.get_leaderboard = [
      { ...entry('u1', 'Anna', 3, 2), monster_until: new Date(Date.now() + 60_000).toISOString() },
      { ...entry('u2', 'Bruno', 1, 1), redbulls: 20 },
    ]
    renderPage()
    await screen.findByText('Anna')
    expect(within(screen.getByText('Anna').closest('li')!).getByTestId('rank').textContent).toBe('1')
    expect(within(screen.getByText('Bruno').closest('li')!).getByTestId('rank').textContent).toBe('2')
  })

  it('spiega chi vede nome e foto', async () => {
    fake.rpcResults.get_leaderboard = []
    renderPage()
    expect(await screen.findByText(/nome e foto sono visibili/i)).toBeInTheDocument()
  })
})
