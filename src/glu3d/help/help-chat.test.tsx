import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  props: [] as Array<Record<string, unknown>>,
}))
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => h.navigate,
}))
vi.mock('../Glu3D', () => ({
  Glu3D: (p: Record<string, unknown>) => {
    h.props.push(p)
    return <div data-testid="glu-3d" />
  },
}))
vi.mock('../../ui/motion/effects', () => ({ prefersReducedMotion: () => false }))
vi.mock('../../lib/errorReporting', () => ({ reportError: vi.fn() }))

import { HelpChat } from './HelpChat'
import { GUIDE, PAGE_TIPS } from './guide'
import { GluStage } from '../stage/GluStage'
import { GluStageProvider, useGluSpot } from '../stage/stageContext'
import type { GluSpotSpec } from '../stage/stageContext'

const title = (id: string) => GUIDE.find((e) => e.id === id)!.title

function renderChat(page: 'home' | 'storico' | 'classifica' | 'profilo' = 'home') {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <HelpChat page={page} onClose={onClose} />
    </MemoryRouter>,
  )
  return { onClose }
}

function ask(text: string) {
  const input = screen.getByRole('textbox', { name: 'La tua domanda' })
  fireEvent.change(input, { target: { value: text } })
  fireEvent.submit(input.closest('form')!)
}

describe('HelpChat', () => {
  beforeEach(() => h.navigate.mockReset())

  it('dialogo «Chiedi a Glu» con saluto, 4 suggerimenti della pagina e focus sul campo', () => {
    renderChat('storico')
    const dialog = screen.getByRole('dialog', { name: 'Chiedi a Glu' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('Ciao! Chiedimi come si fa qualcosa nell\'app.')
    const chips = within(dialog).getAllByRole('button').filter((b) => b.classList.contains('help-chip'))
    expect(chips.map((b) => b.textContent)).toEqual(PAGE_TIPS.storico.map(title))
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'La tua domanda' }))
  })

  it('ogni pagina ha i suoi 4 suggerimenti', () => {
    for (const page of ['home', 'classifica', 'profilo'] as const) {
      const r = render(<MemoryRouter><HelpChat page={page} onClose={() => {}} /></MemoryRouter>)
      for (const id of PAGE_TIPS[page]) expect(screen.getByRole('button', { name: title(id) })).toBeTruthy()
      r.unmount()
    }
  })

  it('domanda → messaggio utente e risposta con passi e «Portami lì», annunciata', () => {
    const { onClose } = renderChat()
    ask("come cambio l'obiettivo")
    const log = screen.getByRole('log')
    expect(log.getAttribute('aria-live')).toBe('polite')
    expect(within(log).getByText("come cambio l'obiettivo")).toBeTruthy()
    const entry = GUIDE.find((e) => e.id === 'goal-change')!
    const steps = within(log).getAllByRole('listitem').map((li) => li.textContent)
    expect(steps).toEqual(entry.answer)
    expect(within(log).getByText('Forse cercavi')).toBeTruthy()
    fireEvent.click(within(log).getByRole('button', { name: 'Portami lì' }))
    expect(h.navigate).toHaveBeenCalledWith('/profilo')
    expect(onClose).toHaveBeenCalled()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })

  it('suggerimento toccato → risposta della voce', () => {
    renderChat('home')
    fireEvent.click(screen.getByRole('button', { name: title('coffee') }))
    const entry = GUIDE.find((e) => e.id === 'coffee')!
    expect(screen.getByRole('log').textContent).toContain(entry.answer[0])
  })

  it('domanda ambigua → «Non sono sicuro di aver capito» e 3 chip; il chip risponde', () => {
    renderChat()
    ask('notifiche')
    const log = screen.getByRole('log')
    expect(log.textContent).toContain('Non sono sicuro di aver capito. Intendevi:')
    const group = within(log).getByRole('group', { name: 'Intendevi' })
    const chips = within(group).getAllByRole('button')
    expect(chips).toHaveLength(3)
    fireEvent.click(chips[0])
    const entry = GUIDE.find((e) => e.title === chips[0].textContent)!
    expect(log.textContent).toContain(entry.answer[0])
  })

  it('nessun risultato → link ai Suggerimenti', () => {
    const { onClose } = renderChat()
    ask('pizza margherita')
    const log = screen.getByRole('log')
    expect(log.textContent).toContain('Non lo so ancora. Puoi scriverlo nei Suggerimenti')
    const link = within(log).getByRole('link', { name: 'Suggerimenti' })
    expect(link.getAttribute('href')).toBe('/feedback')
    fireEvent.click(link)
    expect(onClose).toHaveBeenCalled()
  })

  it('vuota o solo spazi: nulla', () => {
    renderChat()
    ask('')
    ask('    ')
    expect(screen.getByRole('log').querySelectorAll('.help-msg.from-user')).toHaveLength(0)
  })

  it('massimo 200 caratteri e tasto «invia»', () => {
    renderChat()
    const input = screen.getByRole('textbox', { name: 'La tua domanda' }) as HTMLInputElement
    expect(input.maxLength).toBe(200)
    expect(input.getAttribute('enterkeyhint')).toBe('send')
  })

  it('Esc, ✕ e tocco fuori chiudono', () => {
    const { onClose } = renderChat()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

// --- Tocco su Glu nel palcoscenico ---

const W = 390
const H = 800
const TABS_TOP = 740

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

function Page({ spec }: { spec: GluSpotSpec | null }) {
  useGluSpot(spec)
  return null
}

function App({ children }: { children?: React.ReactNode }) {
  return (
    <MemoryRouter>
      <GluStageProvider active>
        {children}
        <GluStage />
        <nav
          className="tabs"
          ref={(el) => {
            if (el) el.getBoundingClientRect = () => rect(0, TABS_TOP, W, H - TABS_TOP)
          }}
        />
      </GluStageProvider>
    </MemoryRouter>
  )
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const gluButton = () => screen.queryByRole('button', { name: 'Glu, chiedi aiuto' })
const storico: GluSpotSpec = { spot: 'corner', mood: 'idle', text: 'Ciao', help: 'storico' }

describe('GluStage: tocco su Glu', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.props = []
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: W })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: H })
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("nell'angolo, fermo e con help: Glu è un pulsante che apre la chat della pagina", () => {
    render(<App><Page spec={storico} /></App>)
    const btn = gluButton()!
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    const dialog = screen.getByRole('dialog', { name: 'Chiedi a Glu' })
    expect(within(dialog).getByRole('button', { name: title(PAGE_TIPS.storico[0]) })).toBeTruthy()
    expect(h.props[h.props.length - 1].mood).toBe('hello')
  })

  it('senza help nessun pulsante', () => {
    render(<App><Page spec={{ spot: 'corner', mood: 'idle' }} /></App>)
    expect(gluButton()).toBeNull()
  })

  it('fuori scena o durante un viaggio nessun pulsante', () => {
    const r = render(<App><Page key="a" spec={storico} /></App>)
    expect(gluButton()).toBeTruthy()
    // Angolo → fuori scena (camminata d'uscita): niente pulsante, né durante né dopo.
    r.rerender(<App><Page key="b" spec={{ spot: 'away', mood: 'idle', help: 'home' }} /></App>)
    advance(100)
    expect(gluButton()).toBeNull()
    advance(3000)
    expect(gluButton()).toBeNull()
    // Fuori scena → angolo (camminata d'entrata): niente pulsante finché non arriva.
    r.rerender(<App><Page key="c" spec={storico} /></App>)
    advance(100)
    expect(gluButton()).toBeNull()
    advance(3000)
    expect(gluButton()).toBeTruthy()
  })

  it('con la chat aperta niente fumetto né passeggiate', () => {
    const r = render(<App><Page spec={storico} /></App>)
    fireEvent.click(gluButton()!)
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('')
    r.rerender(<App><Page spec={{ ...storico, text: 'Altro' }} /></App>)
    expect(screen.getByTestId('glu-stage-bubble').textContent).toBe('')
    // A piccoli passi: act raccoglie gli aggiornamenti e renderizza solo alla fine di ogni passo.
    for (let i = 0; i < 120; i++) advance(500)
    expect(h.props.some((p) => p.walk)).toBe(false)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('cambio di pagina chiude la chat', () => {
    const r = render(<App><Page key="storico" spec={storico} /></App>)
    fireEvent.click(gluButton()!)
    expect(screen.getByRole('dialog')).toBeTruthy()
    r.rerender(<App><Page key="profilo" spec={{ ...storico, help: 'profilo' }} /></App>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('chiusura: il focus torna su Glu', () => {
    render(<App><Page spec={storico} /></App>)
    fireEvent.click(gluButton()!)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(gluButton())
  })
})
