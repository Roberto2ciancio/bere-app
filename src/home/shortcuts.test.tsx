import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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
import { HomePage } from './HomePage'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
let location = ''

function Where() {
  const here = useLocation()
  location = `${here.pathname}${here.search}`
  return null
}

function open(url: string) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter initialEntries={[url]}>
          <Where />
          <Routes>
            <Route path="/home" element={<HomePage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 250, tz, sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 2000 }]
  fake.tables.drinks = []
  fake.tables.caffeine_intakes = []
  fake.tables.schedules = []
})

describe("scorciatoie dall'icona", () => {
  it('«Ho bevuto» segna una bevuta della quantità del profilo, una volta sola, e pulisce l’indirizzo', async () => {
    open('/home?azione=bevi')
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Segnati 250 ml ✓')
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    expect(fake.tables.drinks[0]).toMatchObject({ user_id: 'u1', amount_ml: 250 })
    expect(location).toBe('/home')
    await new Promise((r) => setTimeout(r, 50))
    expect(fake.tables.drinks).toHaveLength(1)
  })

  it('«Caffè» segna un caffè', async () => {
    open('/home?azione=caffe')
    expect(await screen.findByText('Caffè segnato ✓')).toBeInTheDocument()
    await waitFor(() => expect(fake.tables.caffeine_intakes).toHaveLength(1))
    expect(fake.tables.drinks).toHaveLength(0)
  })

  it('senza azione, o con una sconosciuta, non segna nulla', async () => {
    open('/home?azione=boh')
    expect(await screen.findByText(/su 2 L/)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 50))
    expect(fake.tables.drinks).toHaveLength(0)
    expect(fake.tables.caffeine_intakes).toHaveLength(0)
  })
})
