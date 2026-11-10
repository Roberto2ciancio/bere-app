import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { ActiveHoursForm } from '../profile/ActiveHoursForm'
import { HomePage } from './HomePage'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone

function wrap(children: React.ReactNode) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

/** Lunedì 2 novembre 2026, all'ora locale indicata. */
function at(h: number, m = 0) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 2, h, m))
}

function drunk(ml: number) {
  fake.tables.drinks = [{ user_id: 'u1', client_id: 'x', amount_ml: ml, hydration_pct: 100, local_date: localParts(new Date(), tz).date, drunk_at: new Date().toISOString() }]
}

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none', active_split: true, active_start_min: 480, active_end_min: 1080 }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.caffeine_intakes = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('home con la fascia attiva', () => {
  it('alle 12 con 1,2 L sono in linea e servono 300 ml all\'ora', async () => {
    at(12)
    drunk(1200)
    wrap(<HomePage />)
    expect(await screen.findByText("Sei in linea: a quest'ora dovresti essere a 1,2 L")).toBeInTheDocument()
    expect(screen.getByText("Da ora circa 300 ml all'ora fino alle 18:00")).toBeInTheDocument()
  })

  it('alle 14 con 1 L sono indietro e il ritmo sale a 500 ml all\'ora', async () => {
    at(14)
    drunk(1000)
    wrap(<HomePage />)
    expect(await screen.findByText("Sei indietro di 800 ml: a quest'ora dovresti essere a 1,8 L")).toBeInTheDocument()
    expect(screen.getByText("Da ora circa 500 ml all'ora fino alle 18:00")).toBeInTheDocument()
  })

  it('se sono avanti il ritmo scende', async () => {
    at(14)
    drunk(2200)
    wrap(<HomePage />)
    expect(await screen.findByText("Sei avanti di 400 ml: a quest'ora dovresti essere a 1,8 L")).toBeInTheDocument()
    expect(screen.getByText("Da ora circa 200 ml all'ora fino alle 18:00")).toBeInTheDocument()
  })

  it('prima della fascia dice quando riprende', async () => {
    at(6, 30)
    wrap(<HomePage />)
    expect(await screen.findByText('Riprendo alle 8:00')).toBeInTheDocument()
    expect(screen.queryByText(/all'ora/)).not.toBeInTheDocument()
  })

  it('dopo la fascia non chiede più niente', async () => {
    at(20)
    drunk(1000)
    wrap(<HomePage />)
    expect(await screen.findByText('Fascia attiva finita: riprendo domani alle 8:00')).toBeInTheDocument()
    expect(screen.queryByText(/all'ora/)).not.toBeInTheDocument()
  })

  it('a obiettivo raggiunto non chiede più niente', async () => {
    at(14)
    drunk(3000)
    wrap(<HomePage />)
    expect(await screen.findByText(/Obiettivo raggiunto/)).toBeInTheDocument()
    expect(screen.queryByText(/Sei |all'ora/)).not.toBeInTheDocument()
  })

  it('avvisa quando il ritmo andrebbe oltre 1 L all\'ora', async () => {
    at(16)
    wrap(<HomePage />)
    expect(await screen.findByText("Da ora circa 1000 ml all'ora fino alle 18:00")).toBeInTheDocument()
    expect(screen.getByText(/più di 1000 ml all'ora non conviene/)).toBeInTheDocument()
  })

  it('il prossimo promemoria annunciato è dentro la fascia', async () => {
    at(17, 30)
    fake.tables.schedules = [{ id: 's1', user_id: 'u1', name: 'a', weekdays: [1, 2, 3, 4, 5, 6, 7], enabled: true }]
    fake.tables.schedule_times = [
      { id: 't1', schedule_id: 's1', minutes: 1200 },
      { id: 't2', schedule_id: 's1', minutes: 600 },
    ]
    wrap(<HomePage />)
    expect(await screen.findByText('Prossimo promemoria domani alle 10:00')).toBeInTheDocument()
  })

  it('con la divisione spenta la home resta come prima', async () => {
    at(14)
    drunk(1000)
    fake.tables.profiles[0].active_split = false
    wrap(<HomePage />)
    expect((await screen.findAllByText('1 L'))[0]).toBeInTheDocument()
    expect(screen.queryByText(/Sei |Riprendo|all'ora/)).not.toBeInTheDocument()
  })
})

describe('impostazioni della fascia attiva', () => {
  const profile = () => fake.tables.profiles[0]

  it('parte dalle 8 alle 18 e spenta per chi non l\'ha mai impostata', async () => {
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none' }]
    wrap(<ActiveHoursForm />)
    expect(await screen.findByRole('checkbox', { name: /dividi l'obiettivo/i })).not.toBeChecked()
    expect(screen.getByLabelText('Dalle')).toHaveValue('480')
    expect(screen.getByLabelText('Alle')).toHaveValue('1080')
  })

  it('si accende e si spegne', async () => {
    profile().active_split = false
    wrap(<ActiveHoursForm />)
    const box = await screen.findByRole('checkbox', { name: /dividi l'obiettivo/i })
    fireEvent.click(box)
    await waitFor(() => expect(profile().active_split).toBe(true))
    expect(box).toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(profile().active_split).toBe(false))
  })

  it('salva nuovi orari', async () => {
    wrap(<ActiveHoursForm />)
    fireEvent.change(await screen.findByLabelText('Dalle'), { target: { value: '540' } })
    fireEvent.change(screen.getByLabelText('Alle'), { target: { value: '1320' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva fascia' }))
    expect(await screen.findByText('Fascia salvata: dalle 9:00 alle 22:00, 13 ore.')).toBeInTheDocument()
    expect(profile()).toMatchObject({ active_start_min: 540, active_end_min: 1320 })
  })

  it('una fine prima dell\'inizio non si salva e lo dice', async () => {
    wrap(<ActiveHoursForm />)
    fireEvent.change(await screen.findByLabelText('Dalle'), { target: { value: '1080' } })
    fireEvent.change(screen.getByLabelText('Alle'), { target: { value: '480' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva fascia' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("L'ora di fine deve venire dopo l'ora di inizio")
    expect(profile()).toMatchObject({ active_start_min: 480, active_end_min: 1080 })
  })

  it('se il salvataggio non riesce lo dice e non cambia niente', async () => {
    fake.failures.update = 'Failed to fetch'
    wrap(<ActiveHoursForm />)
    fireEvent.change(await screen.findByLabelText('Dalle'), { target: { value: '540' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva fascia' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Salvataggio non riuscito/)
    expect(profile()).toMatchObject({ active_start_min: 480 })
  })
})
