import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHANGELOG } from './changelog'
import { WhatsNew } from './WhatsNewDialog'
import { compareVersions, rememberStartupData, releasesToShow, SEEN_VERSION_KEY } from './whatsNew'

const release = (version: string) => ({ version, date: '2026-11-06', title: version, notes: [version] })
const LOG = [release('1.10.0'), release('1.9.0'), release('1.8.0')]

describe('compareVersions', () => {
  it('confronta i numeri, non il testo', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
    expect(compareVersions('1.2', '1.2.1')).toBeLessThan(0)
  })
})

describe('releasesToShow', () => {
  it('dopo un aggiornamento mostra tutte le versioni nuove, dalla più recente', () => {
    expect(releasesToShow('1.8.0', '1.10.0', true, LOG).map((r) => r.version)).toEqual(['1.10.0', '1.9.0'])
  })
  it('alla stessa versione non mostra niente', () => {
    expect(releasesToShow('1.10.0', '1.10.0', true, LOG)).toEqual([])
  })
  it('una nuova installazione non vede il popup', () => {
    expect(releasesToShow(null, '1.10.0', false, LOG)).toEqual([])
  })
  it("chi usava l'app prima del popup vede solo la versione attuale", () => {
    expect(releasesToShow(null, '1.10.0', true, LOG).map((r) => r.version)).toEqual(['1.10.0'])
  })
})

describe('WhatsNew', () => {
  beforeEach(() => rememberStartupData())

  it("dopo un aggiornamento mostra versione e novità, e non ricompare dopo «Ho capito»", async () => {
    localStorage.setItem(SEEN_VERSION_KEY, '1.0.0')
    const { unmount } = render(<MemoryRouter><WhatsNew /></MemoryRouter>)
    expect(screen.getByRole('dialog', { name: `Novità della versione ${__APP_VERSION__}` })).toBeInTheDocument()
    for (const note of CHANGELOG[0].notes) expect(screen.getByText(note)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ho capito' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(SEEN_VERSION_KEY)).toBe(__APP_VERSION__)
    unmount()
    render(<MemoryRouter><WhatsNew /></MemoryRouter>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('alla prima installazione non compare, ma ricorda la versione', () => {
    render(<MemoryRouter><WhatsNew /></MemoryRouter>)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(SEEN_VERSION_KEY)).toBe(__APP_VERSION__)
  })

  it("chi aveva già dati sul telefono la vede una volta", () => {
    localStorage.setItem('bere.profile', '{}')
    rememberStartupData()
    render(<MemoryRouter><WhatsNew /></MemoryRouter>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
