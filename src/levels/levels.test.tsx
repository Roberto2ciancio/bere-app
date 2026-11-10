import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import App from '../App'
import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { addDays, localParts } from '../domain/time'
import { LeaderboardPage } from '../leaderboard/LeaderboardPage'
import { markOnboarded } from '../onboarding/onboardingFlag'
import { levelOf, pointsForLevel, pointsFromDays, type DayInput } from './levels'

const d = (day: string, totalMl: number, goalMl = 2000): DayInput => ({ day, totalMl, goalMl })

describe('punti', () => {
  it('1 punto ogni 100 ml, ma solo fino all’obiettivo', () => {
    expect(pointsFromDays([d('2026-11-03', 1250)])).toBe(12)
    // 5 L con obiettivo 2 L: 20 punti di acqua + 20 di obiettivo, non 50.
    expect(pointsFromDays([d('2026-11-03', 5000)])).toBe(40)
  })

  it('+20 per giorno a obiettivo, ma non con obiettivi sotto 1,5 L', () => {
    expect(pointsFromDays([d('2026-11-03', 2000)])).toBe(40)
    expect(pointsFromDays([d('2026-11-03', 1000, 1000)])).toBe(10)
  })

  it('+50 per 5 giorni a obiettivo nella stessa settimana, +150 per 7', () => {
    // 2026-11-02 è lunedì.
    const week = (n: number, start = '2026-11-02') => Array.from({ length: n }, (_, i) => d(addDays(start, i), 2000))
    expect(pointsFromDays(week(4))).toBe(4 * 40)
    expect(pointsFromDays(week(5))).toBe(5 * 40 + 50)
    expect(pointsFromDays(week(7))).toBe(7 * 40 + 150)
    // Da giovedì a lunedì successivo: 4 giorni in una settimana e 1 nell'altra, niente bonus.
    expect(pointsFromDays(week(5, '2026-11-05'))).toBe(5 * 40)
  })
})

describe('livelli', () => {
  it('ogni livello chiede 100 punti in più del precedente', () => {
    expect([1, 2, 3, 4, 5, 10].map(pointsForLevel)).toEqual([0, 100, 300, 600, 1000, 4500])
  })

  it('livello, nome, punti mancanti e avanzamento', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, name: 'Goccia', missing: 100, progress: 0 })
    expect(levelOf(99)).toMatchObject({ level: 1, missing: 1, progress: 99 })
    expect(levelOf(100)).toMatchObject({ level: 2, name: 'Goccia', from: 100, to: 300, progress: 0 })
    expect(levelOf(1000)).toMatchObject({ level: 5, name: 'Ruscello' })
    expect(levelOf(pointsForLevel(20))).toMatchObject({ level: 20, name: 'Oceano', emoji: '🐋' })
    expect(levelOf(-5).level).toBe(1)
  })
})

describe('livelli nell’app', () => {
  const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = localParts(new Date(), tz).date

  beforeEach(() => {
    localStorage.clear()
    fake = createFakeSupabase()
    fake.signIn()
    markOnboarded('u1')
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none', units: 'ml' }]
    fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 2000 }]
    fake.tables.drinks = []
    fake.rpcResults.daily_totals = [{ day: addDays(today, -1), total_ml: 2000, drinks: 4 }]
    fake.rpcResults.get_leaderboard = [
      { user_id: 'u2', display_name: 'Bruno', avatar_path: null, days_met: 3, streak: 2 },
      { user_id: 'u1', display_name: 'Anna', avatar_path: null, days_met: 1, streak: 1 },
    ]
    fake.rpcResults.get_levels = [{ user_id: 'u1', points: 350 }, { user_id: 'u2', points: 1200 }]
  })

  it('in classifica il livello è accanto al nome', async () => {
    render(<AuthProvider><ProfileProvider><LeaderboardPage /></ProfileProvider></AuthProvider>)
    const bruno = (await screen.findByText('Bruno')).closest('li')!
    expect(await within(bruno).findByLabelText('livello 5, Ruscello')).toBeInTheDocument()
    expect(within(screen.getByText('Anna').closest('li')!).getByLabelText('livello 3, Sorso')).toBeInTheDocument()
  })

  it('nello Storico: livello, punti, quanto manca e come si guadagnano', async () => {
    window.location.hash = '#/storico'
    render(<App />)
    const card = await screen.findByRole('region', { name: 'Livello e punti' })
    expect(within(card).getByRole('heading', { name: 'Livello 3 · Sorso' })).toBeInTheDocument()
    expect(within(card).getByText('350 punti')).toBeInTheDocument()
    expect(within(card).getByText('Ancora 250 punti per il livello 4.')).toBeInTheDocument()
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '16')
    expect(within(card).getByText(/\+20 per ogni giorno/)).toBeInTheDocument()
  })

  it('se il server non dà i punti, livelli nascosti e il resto funziona', async () => {
    delete fake.rpcResults.get_levels
    window.location.hash = '#/storico'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Statistiche' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Livello e punti' })).not.toBeInTheDocument()
  })
})
