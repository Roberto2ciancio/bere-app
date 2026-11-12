import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../../test/fakeSupabase'

/** Le schede col palcoscenico (provider finto): niente GluCorner, Glu dichiarato nell'angolo con la frase di oggi. */

let fake: FakeSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

const s = vi.hoisted(() => ({ active: false, shows: false, choice: '2d' as '3d' | '2d' | 'pending', spots: [] as unknown[] }))
vi.mock('./stageContext', async (original) => ({
  ...(await original<typeof import('./stageContext')>()),
  useGluStageActive: () => s.active,
  useGluStageShowsGlu: () => s.shows,
  useGluSpot: (spec: unknown) => {
    s.spots.push(spec)
  },
}))
vi.mock('../capability', async (original) => ({
  ...(await original<typeof import('../capability')>()),
  useGlu3dChoice: () => s.choice,
}))
vi.mock('./GluStage', () => ({ GluStage: () => <div data-testid="glu-stage" /> }))

import { AuthProvider } from '../../auth/AuthProvider'
import { ProfileProvider } from '../../auth/ProfileProvider'
import { HistoryPage } from '../../history/HistoryPage'
import { LeaderboardPage } from '../../leaderboard/LeaderboardPage'
import { EmptyState } from '../../mascot/EmptyState'
import { CORNER_PHRASES } from '../../mascot/phrases'
import { ProfilePage } from '../../profile/ProfilePage'
import { MotionRoot } from '../../ui/motion/MotionRoot'
import { TabsLayout } from '../../ui/tabs'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone

function renderIn(children: React.ReactNode) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

const cornerSpecs = () => s.spots.filter((x) => (x as { spot?: string } | null)?.spot === 'corner') as Array<{ text: string; mood: string }>

beforeEach(() => {
  localStorage.clear()
  s.active = false
  s.shows = false
  s.choice = '2d'
  s.spots = []
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna Rossi', home_style: 'glu', drink_ml: 200, tz, sound: 'none', units: 'ml', avatar_path: null, background_path: null }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.pause_periods = []
  fake.rpcResults.get_leaderboard = [
    { user_id: 'u2', display_name: 'Bruno', avatar_path: null, days_met: 3, streak: 2 },
    { user_id: 'u1', display_name: 'Anna', avatar_path: null, days_met: 1, streak: 1 },
  ]
})

describe('schede con il palcoscenico', () => {
  it('Storico: niente glu-corner, Glu nell’angolo con la frase di oggi', async () => {
    s.active = true
    const { container } = renderIn(<HistoryPage />)
    await screen.findByText('Storico')
    await waitFor(() => expect(cornerSpecs().at(-1)?.text).toBe(CORNER_PHRASES.historyIdle))
    expect(container.querySelector('.glu-corner')).toBeNull()
    expect(container.querySelector('main')).toHaveClass('has-glu-stage')
  })

  it('Classifica: niente glu-corner, Glu nell’angolo con la frase di oggi', async () => {
    s.active = true
    const { container } = renderIn(<LeaderboardPage />)
    await screen.findByText('Bruno')
    await waitFor(() => expect(cornerSpecs().at(-1)?.text).toBe(CORNER_PHRASES.boardIdle))
    expect(container.querySelector('.glu-corner')).toBeNull()
    expect(container.querySelector('main')).toHaveClass('has-glu-stage')
  })

  it('Profilo: niente glu-corner, Glu nell’angolo col saluto', async () => {
    s.active = true
    const { container } = renderIn(<ProfilePage />)
    await waitFor(() => expect(cornerSpecs().at(-1)).toMatchObject({ mood: 'hello', text: 'Ciao Anna! Qui sistemi tutto a modo tuo.' }))
    expect(container.querySelector('.glu-corner')).toBeNull()
    expect(container.querySelector('main')).toHaveClass('has-glu-stage')
  })

  it('senza palcoscenico le schede hanno il glu-corner di oggi', async () => {
    const history = renderIn(<HistoryPage />)
    await waitFor(() => expect(history.container.querySelector('.glu-corner')).not.toBeNull())
    expect(history.container.querySelector('main')).not.toHaveClass('has-glu-stage')
    history.unmount()
    const board = renderIn(<LeaderboardPage />)
    await screen.findByText('Bruno')
    expect(board.container.querySelector('.glu-corner')).not.toBeNull()
    board.unmount()
    const profile = renderIn(<ProfilePage />)
    await waitFor(() => expect(profile.container.querySelector('.glu-corner')).not.toBeNull())
    expect(cornerSpecs()).toHaveLength(0)
  })
})

describe('EmptyState col palcoscenico', () => {
  it('con Glu in scena nasconde il suo Glu', () => {
    s.shows = true
    render(<EmptyState mood="idle" title="Vuoto" />)
    expect(screen.queryByTestId('glu')).toBeNull()
    expect(screen.getByText('Vuoto')).toBeInTheDocument()
  })

  it('senza Glu in scena mostra il suo Glu', () => {
    render(<EmptyState mood="idle" title="Vuoto" />)
    expect(screen.getByTestId('glu')).toBeInTheDocument()
  })
})

describe('TabsLayout e la scelta 3D', () => {
  const layout = () =>
    render(
      <AuthProvider>
        <ProfileProvider>
          <MotionRoot>
            <MemoryRouter initialEntries={['/home']}>
              <Routes>
                <Route element={<TabsLayout />}>
                  <Route path="/home" element={<main><h1>Pagina oggi</h1></main>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </MotionRoot>
        </ProfileProvider>
      </AuthProvider>,
    )

  it('con la scelta in sospeso dice «Caricamento…» al posto della pagina', () => {
    s.choice = 'pending'
    layout()
    expect(screen.getByText('Caricamento…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pagina oggi' })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Sezioni' })).toBeInTheDocument()
  })

  it('con la scelta 2D niente palcoscenico', () => {
    layout()
    expect(screen.getByRole('heading', { name: 'Pagina oggi' })).toBeInTheDocument()
    expect(screen.queryByTestId('glu-stage')).toBeNull()
  })
})
