import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../../test/fakeSupabase'

/** «Glu in 3D» spento a metà visita: il palcoscenico se ne va subito, le schede tornano al glu-corner. */

let fake: FakeSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))
vi.mock('../enabled', () => ({ GLU_3D_ENABLED: true }))
const s = vi.hoisted(() => ({ choice: '3d' as '3d' | '2d' | 'pending' }))
vi.mock('../capability', async (original) => ({
  ...(await original<typeof import('../capability')>()),
  useGlu3dChoice: () => s.choice,
}))
vi.mock('./GluStage', () => ({ GluStage: () => <div data-testid="glu-stage" /> }))

import { AuthProvider } from '../../auth/AuthProvider'
import { ProfileProvider } from '../../auth/ProfileProvider'
import { HistoryPage } from '../../history/HistoryPage'
import { setGlu3dOn } from '../../mascot/glu3dPref'
import { MotionRoot } from '../../ui/motion/MotionRoot'
import { TabsLayout } from '../../ui/tabs'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone

function layout() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MotionRoot>
          <MemoryRouter initialEntries={['/storico']}>
            <Routes>
              <Route element={<TabsLayout />}>
                <Route path="/storico" element={<HistoryPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </MotionRoot>
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  s.choice = '3d'
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna Rossi', home_style: 'glu', drink_ml: 200, tz, sound: 'none', units: 'ml', avatar_path: null, background_path: null }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.pause_periods = []
})

describe('«Glu in 3D» durante la visita', () => {
  it('spento: niente palcoscenico, la scheda mostra il glu-corner; riacceso: palcoscenico di nuovo', async () => {
    const { container } = layout()
    await screen.findByText('Storico')
    await waitFor(() => expect(screen.getByTestId('glu-stage')).toBeInTheDocument())
    expect(container.querySelector('.glu-corner')).toBeNull()

    act(() => setGlu3dOn('u1', false))
    expect(screen.queryByTestId('glu-stage')).toBeNull()
    await waitFor(() => expect(container.querySelector('.glu-corner')).not.toBeNull())

    act(() => setGlu3dOn('u1', true))
    expect(screen.getByTestId('glu-stage')).toBeInTheDocument()
    await waitFor(() => expect(container.querySelector('.glu-corner')).toBeNull())
  })
})
