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

  it('un utente con un avatar pronto mostra il disegno e nessuna foto', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2, 'preset:glu-cuffie')]
    const { container } = renderPage()
    const row = (await screen.findByText('Bruno')).closest('li')!
    expect(row.querySelector('.avatar svg')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('a pari giorni e serie mostra la stessa posizione', async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 3, 2), entry('u2', 'Bruno', 3, 2), entry('u3', 'Carla', 1, 1)]
    renderPage()
    await screen.findByText('Anna')
    const rank = (name: string) => within(screen.getByText(name).closest('li')!).getByTestId('rank').textContent
    expect([rank('Anna'), rank('Bruno'), rank('Carla')]).toEqual(['1', '1', '3'])
  })

  it('da solo invita ad aggiungere un amico con il codice', async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 0, 0)]
    renderPage()
    expect(await screen.findByText(/aggiungi un amico con il suo codice/i)).toBeInTheDocument()
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
    expect(await screen.findByText(/nome e foto li vedono solo i tuoi amici/i)).toBeInTheDocument()
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
    expect(fake.invocations).toContainEqual({ name: 'cheer', body: { to: 'u2', reaction: '👏' } })
    expect(await screen.findByRole('status')).toHaveTextContent('Complimenti inviati a Bruno 👏')
    expect(within(bruno).getByRole('button', { name: 'Complimenti già inviati a Bruno' })).toBeDisabled()
  })

  it('i complimenti già inviati restano segnati', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2)]
    fake.rpcResults.cheerable_today = [{ user_id: 'u2', cheered: true }]
    renderPage()
    expect(await screen.findByRole('button', { name: 'Complimenti già inviati a Bruno' })).toBeDisabled()
  })

  it('si può reagire anche con 💪 o 🔥', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2)]
    fake.rpcResults.cheerable_today = [{ user_id: 'u2', cheered: false, reaction: null }]
    fake.setInvokeResult({ status: 'sent' })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Sei on fire a Bruno' }))
    expect(fake.invocations).toContainEqual({ name: 'cheer', body: { to: 'u2', reaction: '🔥' } })
    expect(await screen.findByRole('button', { name: 'Complimenti già inviati a Bruno' })).toHaveTextContent('🔥 Inviati')
    expect(screen.queryByRole('button', { name: 'Che forza a Bruno' })).toBeNull()
  })

  it("con un codice amico aggiunge l'amico e ricarica la classifica", async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 0, 0)]
    fake.rpcResults.use_code = { ok: true, kind: 'friend', name: 'Bruno', already: false }
    renderPage()
    await userEvent.type(await screen.findByLabelText('Codice di un amico o di un gruppo'), 'abc 234')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(fake.rpcCalls).toContainEqual({ name: 'use_code', args: { p_code: 'abc 234' } })
    expect(await screen.findByText('Bruno ora è tra i tuoi amici.')).toBeInTheDocument()
    expect(fake.rpcCalls.filter((c) => c.name === 'get_leaderboard').length).toBeGreaterThan(1)
  })

  it('codice sbagliato: lo dice', async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 0, 0)]
    fake.rpcResults.use_code = { ok: false, reason: 'not-found' }
    renderPage()
    await userEvent.type(await screen.findByLabelText('Codice di un amico o di un gruppo'), 'XXXXXX')
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(await screen.findByText(/Codice non trovato/)).toBeInTheDocument()
  })

  it('ogni gruppo ha la sua classifica e il suo codice invito', async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 1, 1)]
    fake.rpcResults.my_groups = [{ id: 'g1', name: 'Ufficio', invite_code: 'ABCDEFG', members: 3 }]
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Ufficio' }))
    expect(fake.rpcCalls).toContainEqual({ name: 'get_leaderboard', args: { week_start: expect.any(String), p_group: 'g1' } })
    expect(await screen.findByText('ABCDEFG')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ufficio' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Esci dal gruppo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Conferma: esci dal gruppo' }))
    expect(fake.rpcCalls).toContainEqual({ name: 'leave_group', args: { p_group: 'g1' } })
  })

  it('crea un gruppo con un nome', async () => {
    fake.rpcResults.get_leaderboard = [entry('u1', 'Anna', 0, 0)]
    fake.rpcResults.create_group = { ok: true, id: 'g2', name: 'Famiglia', invite_code: 'FAMIGL7' }
    renderPage()
    await userEvent.type(await screen.findByLabelText('Nuovo gruppo'), 'Famiglia')
    await userEvent.click(screen.getByRole('button', { name: 'Crea' }))
    expect(fake.rpcCalls).toContainEqual({ name: 'create_group', args: { p_name: 'Famiglia' } })
    expect(await screen.findByText(/Codice invito: FAMIGL7/)).toBeInTheDocument()
  })

  it('sfida un amico e mostra il punteggio della sfida', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2), entry('u1', 'Anna', 2, 1)]
    fake.rpcResults.challenge = 'ok'
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Sfida Bruno' }))
    expect(fake.rpcCalls).toContainEqual({ name: 'challenge', args: { p_to: 'u2', p_week: expect.any(String) } })
    expect(await screen.findByText(/Sfida lanciata a Bruno/)).toBeInTheDocument()
  })

  it('le sfide della settimana: punteggio e risposta a chi ti sfida', async () => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3, 2), entry('u3', 'Carla', 1, 1), entry('u1', 'Anna', 2, 1)]
    fake.rpcResults.my_challenges = [
      { id: 'c1', other: 'u2', other_name: 'Bruno', incoming: false, status: 'accepted', my_days: 2, their_days: 3 },
      { id: 'c2', other: 'u3', other_name: 'Carla', incoming: true, status: 'pending', my_days: 2, their_days: 1 },
    ]
    renderPage()
    expect(await screen.findByText('Tu 2 – 3 Bruno')).toBeInTheDocument()
    expect(screen.getByText('Sei dietro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sfida Bruno' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Accetta' }))
    expect(fake.rpcCalls).toContainEqual({ name: 'answer_challenge', args: { p_id: 'c2', p_accept: true } })
  })
})
