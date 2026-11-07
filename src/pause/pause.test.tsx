import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
import { addDays, localParts } from '../domain/time'
import { currentPause, pauseEndLabel, pauseRange, pausedDays } from './pauses'
import { PauseForm } from './PauseForm'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

function wrap() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter><PauseForm /></MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none' }]
  fake.tables.pause_periods = []
})

describe('calcoli della pausa', () => {
  it('una pausa comprende oggi e dura al massimo 30 giorni', () => {
    expect(pauseRange('2026-11-07', 1)).toEqual({ start_date: '2026-11-07', end_date: '2026-11-07' })
    expect(pauseRange('2026-11-07', 7)).toEqual({ start_date: '2026-11-07', end_date: '2026-11-13' })
    expect(pauseRange('2026-11-07', 90).end_date).toBe('2026-12-06')
  })

  it('trova la pausa di oggi', () => {
    const p = { id: 'p', start_date: '2026-11-05', end_date: '2026-11-08' }
    expect(currentPause([p], '2026-11-07')).toBe(p)
    expect(currentPause([p], '2026-11-09')).toBeNull()
  })

  it('i giorni in pausa arrivano fino a oggi, non oltre', () => {
    expect([...pausedDays([{ id: 'p', start_date: '2026-11-06', end_date: '2026-11-20' }], '2026-11-07')]).toEqual(['2026-11-06', '2026-11-07'])
  })

  it('dice fino a quando', () => {
    expect(pauseEndLabel('2026-11-07', '2026-11-07')).toBe('fino a stasera')
    expect(pauseEndLabel('2026-11-08', '2026-11-07')).toBe('fino a domani sera')
    expect(pauseEndLabel('2026-11-13', '2026-11-07')).toBe('fino a venerdì 13 novembre compreso')
  })
})

describe('PauseForm', () => {
  it('mette in pausa per i giorni scelti', async () => {
    wrap()
    await userEvent.click(await screen.findByRole('button', { name: '3 giorni' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/Notifiche in pausa/)
    expect(fake.tables.pause_periods).toMatchObject([{ user_id: 'u1', start_date: today(), end_date: addDays(today(), 2) }])
  })

  it('riprendere una pausa iniziata oggi la cancella', async () => {
    fake.tables.pause_periods = [{ id: 'p1', user_id: 'u1', start_date: today(), end_date: addDays(today(), 6) }]
    wrap()
    await userEvent.click(await screen.findByRole('button', { name: 'Riprendi adesso' }))
    await waitFor(() => expect(fake.tables.pause_periods).toEqual([]))
    expect(screen.getByRole('button', { name: 'Oggi' })).toBeInTheDocument()
  })

  it('riprendere una pausa iniziata prima la chiude ieri, così i giorni passati restano in pausa', async () => {
    fake.tables.pause_periods = [{ id: 'p1', user_id: 'u1', start_date: addDays(today(), -3), end_date: addDays(today(), 3) }]
    wrap()
    await userEvent.click(await screen.findByRole('button', { name: 'Riprendi adesso' }))
    await waitFor(() => expect(fake.tables.pause_periods).toMatchObject([{ id: 'p1', end_date: addDays(today(), -1) }]))
  })

  it('se il salvataggio non riesce lo dice', async () => {
    fake.failures.insert = 'giù'
    wrap()
    await userEvent.click(await screen.findByRole('button', { name: 'Oggi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio non riuscito')
  })
})
