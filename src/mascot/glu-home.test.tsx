import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

vi.mock('../ui/motion/effects', async (original) => ({
  ...(await original<typeof import('../ui/motion/effects')>()),
  confetti: vi.fn(),
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { addDays, localParts } from '../domain/time'
import { HomePage } from '../home/HomePage'
import { AppearanceForm } from '../profile/AppearanceForm'
import { readCache, writeCache } from '../lib/cache'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

function drinkRow(ml: number, date = today()) {
  return { user_id: 'u1', client_id: `c${ml}${date}`, amount_ml: ml, local_date: date, drunk_at: new Date().toISOString() }
}

function seed(style = 'glu') {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: style, drink_ml: 200, tz, sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.tables.pause_periods = []
}

function renderIn(children: React.ReactNode) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

let clock = 1_800_000_000_000
function tapLater(button: HTMLElement) {
  clock += 1000
  vi.spyOn(Date, 'now').mockReturnValue(clock)
  fireEvent.click(button)
}

beforeEach(() => seed())

describe('Glu nella Home', () => {
  it('con lo stile Glu mostra la goccia e un fumetto', async () => {
    renderIn(<HomePage />)
    expect(await screen.findByTestId('glu')).toBeInTheDocument()
    expect(document.querySelector('.glu-bubble')).not.toBeNull()
  })

  it('con una pausa attiva Glu dorme', async () => {
    fake.tables.pause_periods = [{ id: 'p1', user_id: 'u1', start_date: today(), end_date: today() }]
    renderIn(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('glu')).toHaveAttribute('data-mood', 'sleep'))
  })

  it('la bevuta che completa l’obiettivo apre la festa, una volta sola', async () => {
    fake.tables.drinks = [drinkRow(2900)]
    const view = renderIn(<HomePage />)
    expect((await screen.findAllByText('2,9 L')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    tapLater(await screen.findByRole('button', { name: /ho bevuto/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Obiettivo raggiunto!' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const close = screen.getByRole('button', { name: 'Evviva!' })
    expect(close).toHaveFocus()
    fireEvent.click(close)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(readCache<string>('bere.goalParty.u1')).toBe(today())

    // Un'altra bevuta, oltre l'obiettivo: niente seconda festa.
    tapLater(screen.getByRole('button', { name: /ho bevuto/i }))
    await screen.findAllByText('3,3 L')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // E riaprendo la Home già sopra l'obiettivo, nemmeno.
    view.unmount()
    fake.tables.drinks = [drinkRow(3100)]
    renderIn(<HomePage />)
    await screen.findAllByText('3,1 L')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('all’apertura già sopra l’obiettivo non c’è festa', async () => {
    fake.tables.drinks = [drinkRow(3200)]
    renderIn(<HomePage />)
    expect((await screen.findAllByText('3,2 L')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Esc chiude la festa', async () => {
    fake.tables.drinks = [drinkRow(2900)]
    renderIn(<HomePage />)
    await screen.findAllByText('2,9 L')
    tapLater(await screen.findByRole('button', { name: /ho bevuto/i }))
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ieri sotto l’obiettivo: Glu è triste, a meno che non sia il saluto', async () => {
    fake.rpcResults.daily_totals = [{ day: addDays(today(), -1), total_ml: 500, drinks: 2 }]
    writeCache('bere.gluHello.u1', today())
    renderIn(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('glu')).toHaveAttribute('data-mood', 'sad'))
  })

  it('senza la migrazione la scelta di Glu resta sul telefono', async () => {
    seed('bottle')
    fake.failures.update = 'violates check constraint'
    renderIn(
      <>
        <AppearanceForm />
        <HomePage />
      </>,
    )
    expect(await screen.findByTestId('bottle-view')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Glu' }))
    expect(await screen.findByTestId('glu')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(readCache<string>('bere.homeStyle.u1')).toBe('glu'))
  })

  it('il profilo che dice bottiglia usa Glu se la scelta è locale', async () => {
    seed('bottle')
    writeCache('bere.homeStyle.u1', 'glu')
    renderIn(<HomePage />)
    expect(await screen.findByTestId('glu')).toBeInTheDocument()
  })
})
