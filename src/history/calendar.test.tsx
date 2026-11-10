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

import App from '../App'
import { addDays, localParts, weekdayOf } from '../domain/time'
import { markOnboarded } from '../onboarding/onboardingFlag'
import { addMonths, monthDays, monthGrid, monthSummary, yearSummary, type Inputs } from './calendar'

const goals = [{ effectiveFrom: '2026-01-01', goalMl: 2000 }]
const total = (day: string, total_ml: number) => ({ day, total_ml, drinks: 1 })

describe('calendario: conti', () => {
  // Novembre 2026 comincia di domenica: la prima settimana ha 6 caselle vuote.
  const inputs: Inputs = {
    totals: [total('2026-11-02', 2000), total('2026-11-03', 1200), total('2026-11-04', 300), total('2026-11-06', 2500), total('2026-11-07', 2000)],
    goals,
    today: '2026-11-08',
    paused: new Set(['2026-11-05']),
    saved: new Set(),
  }

  it('giorni del mese e mesi vicini, anche a cavallo d’anno', () => {
    expect(monthDays('2026-02')).toHaveLength(28)
    expect(monthDays('2028-02')).toHaveLength(29)
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2027-01', -1)).toBe('2026-12')
  })

  it('griglia da lunedì a domenica, con un colore per com’è andato ogni giorno', () => {
    const grid = monthGrid('2026-11', inputs)
    expect(grid[0].slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(grid[0][6]).toMatchObject({ day: '2026-11-01', level: 'before' })
    const level = (day: string) => grid.flat().find((c) => c?.day === day)?.level
    expect(['02', '03', '04', '05', '06', '08', '09'].map((d) => level(`2026-11-${d}`))).toEqual(['met', 'half', 'low', 'paused', 'met', 'none', 'future'])
    expect(grid.every((week) => week.length === 7)).toBe(true)
  })

  it('il mese in numeri conta solo i giorni da quando usi l’app fino a oggi', () => {
    const s = monthSummary('2026-11', inputs)
    expect(s).toMatchObject({ daysMet: 3, daysCounted: 7, totalMl: 8000, bestRun: 2, bestDay: { day: '2026-11-06', totalMl: 2500 } })
    expect(s.averageMl).toBe(Math.round(8000 / 7))
  })

  it('pausa e salva-serie non spezzano la serie più lunga del mese', () => {
    const s = monthSummary('2026-11', { ...inputs, totals: [total('2026-11-02', 2000), total('2026-11-04', 2000), total('2026-11-06', 2000)], saved: new Set(['2026-11-03']) })
    expect(s.bestRun).toBe(3)
  })

  it('l’anno somma i mesi e li elenca tutti', () => {
    const y = yearSummary('2026', { ...inputs, totals: [total('2026-10-30', 2000), ...inputs.totals] })
    expect(y.months).toHaveLength(12)
    expect(y.months[9].summary).toMatchObject({ daysMet: 1, daysCounted: 2 })
    expect(y.total.daysMet).toBe(4)
    expect(y.months[0].summary.daysCounted).toBe(0)
  })
})

describe('calendario: pagina', () => {
  const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = localParts(new Date(), tz).date

  beforeEach(() => {
    localStorage.clear()
    fake = createFakeSupabase()
    fake.signIn()
    markOnboarded('u1')
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none', units: 'ml', stop_at_goal: false, allow_pokes: true }]
    fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 2000 }]
    fake.tables.drinks = []
    fake.rpcResults.get_leaderboard = []
    // Due giorni fa raggiunto, ieri mancato: il salva-serie copre ieri.
    fake.rpcResults.daily_totals = [total(addDays(today, -2), 2000), total(addDays(today, -1), 100)]
    window.location.hash = '#/storico'
  })

  it('dallo Storico: salva-serie usato ieri, la serie resta viva', async () => {
    render(<App />)
    // Di lunedì ieri era la settimana scorsa: quello di questa settimana è ancora disponibile.
    expect(await screen.findByText(weekdayOf(today) === 1 ? /Salva-serie disponibile/ : /Salva-serie usato ieri: la serie è salva/)).toBeInTheDocument()
    expect(screen.getByText('Serie in corso').nextSibling).toHaveTextContent('1 gg')
  })

  it('apre il calendario del mese con i colori e passa alla vista per anno', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('link', { name: 'Calendario e statistiche del mese' }))
    expect(await screen.findByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
    const grid = screen.getByRole('group', { name: /Giorni di/ })
    expect(within(grid).getAllByRole('img', { name: /obiettivo raggiunto$/ }).length).toBeGreaterThanOrEqual(today.slice(8) >= '03' ? 1 : 0)
    expect(screen.getByRole('heading', { name: 'Il mese in numeri' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mese successivo' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Anno' }))
    expect(screen.getByRole('heading', { name: 'Mese per mese' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: today.slice(0, 4) })).toBeInTheDocument()
  })

  it('il giorno coperto dal salva-serie si riconosce nel calendario', async () => {
    window.location.hash = '#/storico/calendario'
    render(<App />)
    await screen.findByRole('heading', { name: 'Calendario' })
    const yesterday = addDays(today, -1)
    if (yesterday.slice(0, 7) !== today.slice(0, 7)) await userEvent.click(screen.getByRole('button', { name: 'Mese precedente' }))
    expect(screen.getAllByRole('img', { name: /salvato dal salva-serie/ })).toHaveLength(1)
  })
})
