import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CHANGELOG } from '../profile/changelog'
import { compareVersions, hasUnreadNews, NEWS_READ_KEY } from '../profile/whatsNew'
import { NewsIcon } from './NewsIcon'
import { NewsPage } from './NewsPage'

// Icona e pagina da sole: la schermata Oggi intera può spostarsi sulla prima configurazione e rendere il test instabile.
function renderNews() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/home" element={<NewsIcon />} />
        <Route path="/novita" element={<NewsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('changelog', () => {
  it('parte dalla versione in package.json e va dalla più recente alla più vecchia', () => {
    expect(CHANGELOG[0].version).toBe(__APP_VERSION__)
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeGreaterThan(0)
      expect(CHANGELOG[i - 1].date >= CHANGELOG[i].date).toBe(true)
    }
  })
})

describe('Newsletter', () => {
  it("dall'icona si apre la Newsletter con tutte le versioni, e il pallino si spegne", async () => {
    renderNews()
    await userEvent.click(screen.getByRole('link', { name: 'Newsletter, novità da leggere' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Newsletter' })).toBeInTheDocument()
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(CHANGELOG.length)
    expect(within(cards[0]).getByText('Attuale')).toBeInTheDocument()
    expect(within(cards[0]).getByRole('heading', { name: CHANGELOG[0].title })).toBeInTheDocument()
    for (const note of CHANGELOG.at(-1)!.notes) expect(within(cards.at(-1)!).getByText(note)).toBeInTheDocument()
    expect(localStorage.getItem(NEWS_READ_KEY)).toBe(__APP_VERSION__)
    expect(hasUnreadNews()).toBe(false)
  })

  it('«‹ Indietro» torna da dove si è venuti (qui: Profilo › Aiuto)', async () => {
    render(
      <MemoryRouter initialEntries={['/profilo/aiuto']}>
        <Routes>
          <Route path="/profilo/aiuto" element={<Link to="/novita">Leggi le novità</Link>} />
          <Route path="/home" element={<h1>Oggi</h1>} />
          <Route path="/novita" element={<NewsPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('link', { name: 'Leggi le novità' }))
    await userEvent.click(await screen.findByRole('link', { name: '‹ Indietro' }))
    expect(await screen.findByRole('link', { name: 'Leggi le novità' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Oggi' })).toBeNull()
  })

  it('aperta direttamente (nessuna storia): «‹ Oggi» porta alla Home', async () => {
    render(
      <MemoryRouter initialEntries={['/novita']}>
        <Routes>
          <Route path="/home" element={<h1>Oggi</h1>} />
          <Route path="/novita" element={<NewsPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const back = screen.getByRole('link', { name: '‹ Oggi' })
    expect(back).toHaveAttribute('href', '/home')
    await userEvent.click(back)
    expect(await screen.findByRole('heading', { name: 'Oggi' })).toBeInTheDocument()
  })

  it('una versione nuova riaccende il pallino, una già letta no', () => {
    localStorage.setItem(NEWS_READ_KEY, '0.1.0')
    const { unmount } = renderNews()
    expect(screen.getByRole('link', { name: 'Newsletter, novità da leggere' })).toBeInTheDocument()
    unmount()
    localStorage.setItem(NEWS_READ_KEY, __APP_VERSION__)
    renderNews()
    expect(screen.getByRole('link', { name: 'Newsletter' })).toBeInTheDocument()
  })
})
