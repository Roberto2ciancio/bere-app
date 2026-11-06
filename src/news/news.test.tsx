import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'
import { CHANGELOG } from '../profile/changelog'
import { compareVersions, hasUnreadNews, NEWS_READ_KEY } from '../profile/whatsNew'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import App from '../App'

beforeEach(() => {
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  window.location.hash = '#/home'
})

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
  it("dall'icona in Oggi si apre la Newsletter con tutte le versioni, e il pallino si spegne", async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('link', { name: 'Newsletter, novità da leggere' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Newsletter' })).toBeInTheDocument()
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(CHANGELOG.length)
    expect(within(cards[0]).getByText('Attuale')).toBeInTheDocument()
    expect(within(cards[0]).getByRole('heading', { name: CHANGELOG[0].title })).toBeInTheDocument()
    for (const note of CHANGELOG.at(-1)!.notes) expect(within(cards.at(-1)!).getByText(note)).toBeInTheDocument()
    expect(localStorage.getItem(NEWS_READ_KEY)).toBe(__APP_VERSION__)
    expect(hasUnreadNews()).toBe(false)
    expect(screen.getByRole('link', { name: '‹ Oggi' })).toHaveAttribute('href', '#/home')
  })

  it('una versione nuova riaccende il pallino', async () => {
    localStorage.setItem(NEWS_READ_KEY, '0.1.0')
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Newsletter, novità da leggere' })).toBeInTheDocument()
  })
})
