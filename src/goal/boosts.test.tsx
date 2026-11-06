import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { localParts } from '../domain/time'
import { HomePage } from '../home/HomePage'
import { HeatForm } from '../profile/HeatForm'
import { findCity, goalWithBoosts, heatBoostMl, maxTemperature } from './boosts'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

function wrap(children: React.ReactNode) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 2000 }]
  fake.tables.drinks = []
  fake.tables.caffeine_intakes = []
  fake.tables.goal_boosts = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('aumenti', () => {
  it('il caldo aggiunge 250, 500 o 750 ml', () => {
    expect([20, 24.9, 25, 29, 30, 34, 35, 41].map(heatBoostMl)).toEqual([0, 0, 250, 250, 500, 500, 750, 750])
  })

  it("l'obiettivo di un giorno somma solo gli aumenti di quel giorno", () => {
    const goals = [{ effectiveFrom: '2026-01-01', goalMl: 2000 }]
    const byDay = new Map([['2026-11-02', 750]])
    expect(goalWithBoosts(goals, '2026-11-02', byDay)).toBe(2750)
    expect(goalWithBoosts(goals, '2026-11-03', byDay)).toBe(2000)
  })

  it('legge la massima di oggi con la posizione arrotondata a circa 10 km', async () => {
    const fetcher = vi.fn(async (_url: string) => jsonResponse({ daily: { temperature_2m_max: [31.4] } }))
    expect(await maxTemperature(45.4642, 9.19, fetcher as unknown as typeof fetch)).toBe(31.4)
    expect(String(fetcher.mock.calls[0][0])).toContain('latitude=45.5&longitude=9.2')
  })

  it('cerca la città e arrotonda le coordinate', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ results: [{ name: 'Milano', admin1: 'Lombardia', latitude: 45.46427, longitude: 9.18951 }] }))
    expect(await findCity(' Milano ', fetcher as unknown as typeof fetch)).toEqual({ name: 'Milano (Lombardia)', lat: 45.5, lon: 9.2 })
    const none = vi.fn(async () => jsonResponse({}))
    expect(await findCity('Xyz', none as unknown as typeof fetch)).toBeNull()
  })
})

describe('home: obiettivo che si adatta', () => {
  it("l'allenamento aggiunge 500 ml all'obiettivo di oggi e si può togliere", async () => {
    wrap(<HomePage />)
    expect(await screen.findByText('su 2 L')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: "Ho fatto allenamento: +500 ml all'obiettivo" }))
    expect(await screen.findByText('su 2,5 L')).toBeInTheDocument()
    expect(screen.getByText("+500 ml per l'allenamento")).toBeInTheDocument()
    expect(fake.tables.goal_boosts).toMatchObject([{ user_id: 'u1', local_date: today(), kind: 'workout', extra_ml: 500 }])
    await userEvent.click(screen.getByRole('button', { name: /Allenamento segnato/ }))
    expect(await screen.findByText('su 2 L')).toBeInTheDocument()
    expect(fake.tables.goal_boosts).toEqual([])
  })

  it('con il caldo acceso legge il meteo una volta al giorno e alza l\'obiettivo', async () => {
    fake.tables.profiles[0] = { ...fake.tables.profiles[0], heat_boost: true, city_name: 'Milano', city_lat: 45.5, city_lon: 9.2 }
    const fetcher = vi.fn(async () => jsonResponse({ daily: { temperature_2m_max: [31.2] } }))
    vi.stubGlobal('fetch', fetcher)
    const { unmount } = wrap(<HomePage />)
    expect(await screen.findByText('su 2,5 L')).toBeInTheDocument()
    expect(screen.getByText('+500 ml per il caldo (31 °C)')).toBeInTheDocument()
    expect(fake.tables.goal_boosts).toMatchObject([{ kind: 'heat', extra_ml: 500, note: '31 °C' }])
    unmount()
    wrap(<HomePage />)
    expect(await screen.findByText('su 2,5 L')).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('con il caldo spento non legge il meteo', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    wrap(<HomePage />)
    expect(await screen.findByText('su 2 L')).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('profilo: giorni caldi', () => {
  it('acceso, chiede la città e la salva arrotondata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: [{ name: 'Roma', admin1: 'Lazio', latitude: 41.89, longitude: 12.51 }] })))
    wrap(<HeatForm />)
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Più acqua nei giorni caldi' }))
    await userEvent.type(await screen.findByLabelText('Città'), 'Roma')
    await userEvent.click(screen.getByRole('button', { name: 'Cerca' }))
    await waitFor(() => expect(fake.tables.profiles[0]).toMatchObject({ heat_boost: true, city_name: 'Roma (Lazio)', city_lat: 41.9, city_lon: 12.5 }))
    expect(await screen.findByText('Roma (Lazio)')).toBeInTheDocument()
  })

  it('una città che non esiste lo dice', async () => {
    fake.tables.profiles[0] = { ...fake.tables.profiles[0], heat_boost: true }
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})))
    wrap(<HeatForm />)
    await userEvent.type(await screen.findByLabelText('Città'), 'Atlantide')
    await userEvent.click(screen.getByRole('button', { name: 'Cerca' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Non trovo «Atlantide»')
  })
})
