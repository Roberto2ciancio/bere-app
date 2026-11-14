import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import App from '../App'
import { addDays, localParts } from '../domain/time'
import { markOnboarded } from '../onboarding/onboardingFlag'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date
const total = (day: string, ml: number) => ({ day, total_ml: ml, drinks: 3 })
const row = (user_id: string, display_name: string, days_met: number) => ({ user_id, display_name, avatar_path: null, days_met, streak: days_met })

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  markOnboarded('u1')
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna Rossi', home_style: 'bottle', drink_ml: 200, tz, sound: 'none', units: 'ml' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.rpcResults.daily_totals = []
  fake.rpcResults.get_leaderboard = []
})

describe('Glu in cima alle pagine', () => {
  it('Storico: una serie in corso la festeggia', async () => {
    fake.rpcResults.daily_totals = [total(addDays(today(), -1), 3000), total(today(), 3000)]
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'c1', amount_ml: 3000, drink_type: 'water', drunk_at: new Date().toISOString(), local_date: today() }]
    window.location.hash = '#/storico'
    render(<App />)
    expect(await screen.findByText('Serie di 2 giorni! Continuiamo così.')).toBeInTheDocument()
    expect(screen.getAllByTestId('glu')).toHaveLength(1)
    expect(screen.getByTestId('glu')).toHaveAttribute('data-mood', 'almost')
  })

  it('Storico: senza serie incoraggia', async () => {
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'c1', amount_ml: 200, drink_type: 'water', drunk_at: new Date().toISOString(), local_date: today() }]
    window.location.hash = '#/storico'
    render(<App />)
    expect(await screen.findByText('Ogni giorno a obiettivo conta, piano piano.')).toBeInTheDocument()
    expect(screen.getByTestId('glu')).toHaveAttribute('data-mood', 'idle')
  })

  it('Storico: con un giorno vuoto Glu resta uno solo', async () => {
    window.location.hash = '#/storico'
    render(<App />)
    expect(await screen.findByText('Nessuna bevuta segnata in questo giorno.')).toBeInTheDocument()
    expect(screen.getAllByTestId('glu')).toHaveLength(1)
    expect(screen.getByText('Ogni giorno a obiettivo conta, piano piano.')).toBeInTheDocument()
  })

  it('Classifica: in testa lo dice', async () => {
    fake.rpcResults.get_leaderboard = [row('u1', 'Anna', 3), row('u2', 'Bruno', 1)]
    window.location.hash = '#/classifica'
    render(<App />)
    expect(await screen.findByText('Sei in testa!')).toBeInTheDocument()
    expect(screen.getAllByTestId('glu')).toHaveLength(1)
    expect(screen.getByTestId('glu')).toHaveAttribute('data-mood', 'goal')
  })

  it('Classifica: non in testa incoraggia', async () => {
    fake.rpcResults.get_leaderboard = [row('u2', 'Bruno', 3), row('u1', 'Anna', 1)]
    window.location.hash = '#/classifica'
    render(<App />)
    expect(await screen.findByText('Ogni sorso conta per la classifica.')).toBeInTheDocument()
    expect(screen.getByTestId('glu')).toHaveAttribute('data-mood', 'idle')
  })

  it('Classifica: con lo stato vuoto non c’è un secondo Glu', async () => {
    fake.rpcResults.get_leaderboard = [row('u1', 'Anna', 1)]
    window.location.hash = '#/classifica'
    render(<App />)
    expect(await screen.findByText(/Per ora ci sei solo tu/)).toBeInTheDocument()
    expect(screen.getAllByTestId('glu')).toHaveLength(1)
    expect(screen.queryByText('Ogni sorso conta per la classifica.')).not.toBeInTheDocument()
  })

  it('Profilo: saluta per nome', async () => {
    window.location.hash = '#/profilo'
    render(<App />)
    expect(await screen.findByText('Ciao Anna! Qui sistemi tutto a modo tuo.')).toBeInTheDocument()
    expect(screen.getAllByTestId('glu')).toHaveLength(1)
    expect(screen.getByTestId('glu')).toHaveAttribute('data-mood', 'hello')
  })
})
