import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

// Scelta 3D/2D decisa dal test; Glu3D finto (jsdom non ha WebGL) con un pulsante che simula il guasto.
const g = vi.hoisted(() => ({ choice: '2d' as '3d' | '2d' | 'pending' }))
vi.mock('../glu3d/capability', async (original) => ({
  ...(await original<typeof import('../glu3d/capability')>()),
  useGlu3dChoice: () => g.choice,
}))
vi.mock('../glu3d/Glu3D', () => ({
  Glu3D: ({ onFail }: { onFail: (e: unknown) => void }) => (
    <div data-testid="glu-3d">
      <button onClick={() => onFail(new Error('guasto'))}>guasta</button>
    </div>
  ),
}))
vi.mock('../lib/errorReporting', () => ({ reportError: vi.fn() }))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { addDays, localParts } from '../domain/time'
import { GluView } from '../home/GluView'
import { HomePage } from '../home/HomePage'
import { GluStageProvider, useStageInternals } from '../glu3d/stage/stageContext'
import { readCache, writeCache } from '../lib/cache'
import { reportError } from '../lib/errorReporting'

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

beforeEach(() => {
  g.choice = '2d'
  vi.mocked(reportError).mockClear()
  seed()
})

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

  it('un profilo in cache con uno stile vecchio mostra Glu', async () => {
    seed('bottle')
    renderIn(<HomePage />)
    expect(await screen.findByTestId('glu')).toBeInTheDocument()
  })

  it('la chiave bere.homeStyle rimasta si toglie al caricamento del profilo', async () => {
    seed('glu')
    writeCache('bere.homeStyle.u1', 'glu')
    renderIn(<HomePage />)
    await screen.findByTestId('glu')
    await waitFor(() => expect(readCache<string>('bere.homeStyle.u1')).toBeNull())
  })
})

describe('Glu: tristezza e saluto', () => {
  const sadSetup = () => {
    fake.rpcResults.daily_totals = [{ day: addDays(today(), -1), total_ml: 500, drinks: 2 }]
  }
  const mood = () => screen.getByTestId('glu').getAttribute('data-mood')

  it('dopo il saluto Glu è triste per 4 s, poi basta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      sadSetup()
      renderIn(<HomePage />)
      await screen.findByTestId('glu')
      await waitFor(() => expect(mood()).toBe('hello'))
      await act(() => vi.advanceTimersByTimeAsync(3100))
      expect(mood()).toBe('sad')
      await act(() => vi.advanceTimersByTimeAsync(3500))
      expect(mood()).toBe('sad')
      await act(() => vi.advanceTimersByTimeAsync(700))
      expect(mood()).not.toBe('sad')
    } finally {
      vi.useRealTimers()
    }
  })

  it('tornando alla Home lo stesso giorno non è più triste', async () => {
    sadSetup()
    writeCache('bere.gluHello.u1', today())
    const first = renderIn(<HomePage />)
    await waitFor(() => expect(mood()).toBe('sad'), { timeout: 4000 })
    // Il giorno si segna in un effetto, subito dopo il render che mostra la tristezza.
    await waitFor(() => expect(readCache<string>('bere.gluSad.u1')).toBe(today()))
    first.unmount()
    renderIn(<HomePage />)
    await screen.findByTestId('glu')
    await waitFor(() => expect(fake.rpcCalls.filter((c) => c.name === 'daily_totals')).toHaveLength(2), { timeout: 4000 })
    expect(mood()).not.toBe('sad')
  })
})

describe('Glu della Home col palcoscenico', () => {
  function Probe() {
    const ctx = useStageInternals()
    return <output data-testid="probe">{JSON.stringify({ spot: ctx?.spec?.spot ?? null, fill: ctx?.spec?.fill ?? null, ring: !!ctx?.ringEl })}</output>
  }
  const view = (active: boolean) =>
    render(
      <GluStageProvider active={active}>
        <GluView fill={0.4} mood="idle" name="Anna" now={0} />
        <Probe />
      </GluStageProvider>,
    )

  it('con il palcoscenico attivo la Home non disegna Glu ma prenota l’anello', () => {
    view(true)
    expect(screen.queryByTestId('glu')).not.toBeInTheDocument()
    expect(screen.queryByTestId('glu-3d')).not.toBeInTheDocument()
    const slot = screen.getByTestId('glu-ring-slot')
    expect(slot.closest('.progress-ring-art')).not.toBeNull()
    expect(JSON.parse(screen.getByTestId('probe').textContent!)).toEqual({ spot: 'ring', fill: 0.4, ring: true })
    // Il fumetto della Home resta della Home.
    expect(screen.getByTestId('glu-view').querySelector('.glu-bubble')).not.toBeNull()
  })

  it('senza palcoscenico c’è il disegno 2D e nessun 3D', () => {
    view(false)
    expect(screen.getByTestId('glu')).toBeInTheDocument()
    expect(screen.queryByTestId('glu-3d')).not.toBeInTheDocument()
    expect(screen.queryByTestId('glu-ring-slot')).not.toBeInTheDocument()
  })

  it('la Home non aspetta più la scelta 3D: «Ho bevuto» arriva anche se TabsLayout è in sospeso', async () => {
    g.choice = 'pending'
    renderIn(<HomePage />)
    expect(await screen.findByRole('button', { name: /ho bevuto/i })).toBeInTheDocument()
  })
})
