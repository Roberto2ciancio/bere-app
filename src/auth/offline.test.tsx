import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import App from '../App'
import { localParts } from '../domain/time'
import { pendingDrinks } from '../drinks/drinkQueue'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date
const profile = { id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none' }
const retryable = { name: 'AuthRetryableFetchError', message: 'Failed to fetch' }

/** Prima apertura con la rete: riempie la memoria locale del telefono. */
async function openOnline() {
  fake.signIn()
  fake.tables.profiles = [{ ...profile }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 2000 }]
  fake.tables.drinks = [{ user_id: 'u1', client_id: 'x', amount_ml: 800, local_date: today(), drunk_at: new Date().toISOString() }]
  fake.tables.schedules = [{ id: 's1', user_id: 'u1', name: 'x', weekdays: [1, 2, 3, 4, 5, 6, 7], enabled: true }]
  fake.tables.schedule_times = [{ id: 't1', schedule_id: 's1', minutes: 1439 }]
  const view = render(<App />)
  await screen.findByText('0,8 L', {}, { timeout: 2500 })
  await screen.findByText(/prossimo promemoria/i)
  view.unmount()
}

/** Riapertura senza rete e con il token scaduto: la libreria non restituisce alcuna sessione. */
function goOffline() {
  fake.signOutSilently()
  fake.setSessionError(retryable)
  fake.failures.select = 'Failed to fetch'
  fake.failures.upsert = 'Failed to fetch'
}

beforeEach(() => {
  fake = createFakeSupabase()
  window.location.hash = '#/home'
})

describe('riapertura senza rete con token scaduto', () => {
  it('mostra la home e non il login', async () => {
    await openOnline()
    goOffline()
    render(<App />)
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Accedi' })).not.toBeInTheDocument()
  })

  it('non aspetta il rinnovo della sessione', async () => {
    await openOnline()
    goOffline()
    fake.client.auth.getSession = () => new Promise(() => {})
    render(<App />)
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })

  it('una notifica di sessione vuota non fa uscire', async () => {
    await openOnline()
    goOffline()
    render(<App />)
    await screen.findByRole('button', { name: /ho bevuto/i })
    await act(async () => fake.emit('INITIAL_SESSION'))
    expect(screen.getByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })

  it('la bevuta si segna e il totale parte da quanto già bevuto oggi', async () => {
    await openOnline()
    goOffline()
    render(<App />)
    expect(await screen.findByText('0,8 L', {}, { timeout: 2500 })).toBeInTheDocument()
    ;(await screen.findByRole('button', { name: /ho bevuto/i })).click()
    expect(await screen.findByText('1 L', {}, { timeout: 2500 })).toBeInTheDocument()
    expect(pendingDrinks('u1')).toHaveLength(1)
  })

  it('il prossimo promemoria resta quello salvato, senza invito a impostarli', async () => {
    await openOnline()
    goOffline()
    render(<App />)
    expect(await screen.findByText(/prossimo promemoria/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /imposta i promemoria/i })).not.toBeInTheDocument()
  })
})

describe('sessione davvero terminata', () => {
  it('senza errore di rete una sessione vuota porta al login', async () => {
    await openOnline()
    fake.signOutSilently()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })

  it('un token rifiutato dal server porta al login', async () => {
    await openOnline()
    fake.signOutSilently()
    fake.setSessionError({ name: 'AuthApiError', message: 'Invalid Refresh Token' })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })

  it('dopo l\'uscita un nuovo avvio senza rete porta al login', async () => {
    await openOnline()
    const view = render(<App />)
    await screen.findByRole('button', { name: /ho bevuto/i })
    await act(async () => {
      await fake.client.auth.signOut()
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Accedi' })).toBeInTheDocument())
    view.unmount()
    fake.setSessionError(retryable)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })
})
