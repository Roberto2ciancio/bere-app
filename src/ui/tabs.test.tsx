import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MotionRoot } from './motion/MotionRoot'
import { TabsLayout } from './tabs'

vi.mock('../auth/ProfileProvider', () => ({ useProfile: () => ({ profile: null }) }))
vi.mock('../lib/lastSeen', () => ({ touchLastSeen: () => {} }))
vi.mock('../push/subscribe', () => ({ syncPushSubscription: () => Promise.resolve() }))
vi.mock('../profile/WhatsNewDialog', () => ({ WhatsNew: () => null }))
vi.mock('../profile/imageUpload', () => ({ backgroundUrl: () => Promise.resolve(null) }))

function setup(path: string) {
  return render(
    <MotionRoot>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<TabsLayout />}>
            <Route path="/home" element={<main><h1>Pagina oggi</h1></main>} />
            <Route path="/storico" element={<main><h1>Pagina storico</h1></main>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </MotionRoot>,
  )
}

describe('TabsLayout', () => {
  it('mostra quattro link con icona e nome accessibile', () => {
    setup('/home')
    for (const name of ['Oggi', 'Storico', 'Classifica', 'Profilo']) {
      const link = screen.getByRole('link', { name })
      expect(link.querySelector('svg')).not.toBeNull()
    }
    expect(screen.getByRole('link', { name: 'Oggi' })).toHaveAttribute('aria-current', 'page')
  })

  it('cambiando scheda la nuova pagina è raggiungibile e la vecchia sparisce', async () => {
    setup('/storico')
    expect(screen.getByRole('heading', { name: 'Pagina storico' })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Sezioni' })).getByRole('link', { name: 'Oggi' }))
    expect(await screen.findByRole('heading', { name: 'Pagina oggi' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pagina storico' })).toBeNull()
  })
})
