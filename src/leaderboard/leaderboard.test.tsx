import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('non mostra più Red Bull né segno Monster', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2)]
    renderPage()
    const row = (await screen.findByText('Bruno')).closest('li')!
    expect(row.querySelector('svg')).toBeNull()
    expect(screen.queryByText(/red bull|monster/i)).not.toBeInTheDocument()
  })

  it('spiega chi vede nome e foto', async () => {
    fake.rpcResults.get_leaderboard = []
    renderPage()
    expect(await screen.findByText(/nome e foto sono visibili/i)).toBeInTheDocument()
  })

  it("a chi ha raggiunto l'obiettivo oggi si possono mandare i complimenti, una volta", async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2), entry('u3', 'Carla', 1, 1), entry('u1', 'Anna', 2, 1)]
    fake.rpcResults.cheerable_today = [{ user_id: 'u2', cheered: false }]
    fake.setInvokeResult({ status: 'sent' })
    renderPage()
    const bruno = (await screen.findByText('Bruno')).closest('li')!
    expect(within(bruno).getByText(/obiettivo di oggi/)).toBeInTheDocument()
    expect(within(screen.getByText('Carla').closest('li')!).queryByRole('button', { name: /Complimenti/ })).toBeNull()
    await userEvent.click(within(bruno).getByRole('button', { name: 'Complimenti a Bruno' }))
    expect(fake.invocations).toContainEqual({ name: 'cheer', body: { to: 'u2' } })
    expect(await screen.findByRole('status')).toHaveTextContent('Complimenti inviati a Bruno 👏')
    expect(within(bruno).getByRole('button', { name: 'Complimenti già inviati a Bruno' })).toBeDisabled()
  })

  it('i complimenti già inviati restano segnati', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2)]
    fake.rpcResults.cheerable_today = [{ user_id: 'u2', cheered: true }]
    renderPage()
    expect(await screen.findByRole('button', { name: 'Complimenti già inviati a Bruno' })).toBeDisabled()
  })
})
