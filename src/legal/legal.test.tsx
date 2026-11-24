import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

// Il flag è spento nei test (come in produzione): qui si accende per provare le regole di Google Play.
const playFlag = vi.hoisted(() => ({ on: true }))
vi.mock('./playFlag', () => ({
  get PLAY_RULES() {
    return playFlag.on
  },
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { RegisterPage } from '../auth/RegisterPage'
import { LoginPage } from '../auth/LoginPage'
import { ReportPage } from '../feedback/ReportPage'
import { LeaderboardPage } from '../leaderboard/LeaderboardPage'
import { PrivacyPage } from '../profile/PrivacyPage'
import { legalUrl } from './links'

const entry = (user_id: string, display_name: string, days_met = 1) => ({ user_id, display_name, avatar_path: null, days_met, streak: 1 })

function renderAt(path: string, element: React.ReactNode, routePath = '*') {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            <Route path="/segnala" element={<ReportPage />} />
          </Routes>
        </MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  playFlag.on = true
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'glu', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
})

describe('pagine pubbliche', () => {
  it('i link puntano ai file in public/, accanto all’app', () => {
    expect(legalUrl('privacy')).toBe(`${import.meta.env.BASE_URL}privacy.html`)
    expect(legalUrl('termini')).toMatch(/termini\.html$/)
    expect(legalUrl('cancella-account')).toMatch(/cancella-account\.html$/)
  })

  it('la pagina di accesso porta a privacy e condizioni', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', legalUrl('privacy'))
    expect(screen.getByRole('link', { name: "Condizioni d'uso" })).toHaveAttribute('href', legalUrl('termini'))
  })

  it('senza il flag (produzione) l’accesso resta com’era', () => {
    playFlag.on = false
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Privacy' })).toBeNull()
  })
})

describe('iscrizione con le condizioni d’uso', () => {
  async function fillForm() {
    await userEvent.type(screen.getByLabelText(/^nome/i), 'Anna')
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.it')
    await userEvent.type(screen.getByLabelText(/^password/i), 'password1')
    fireEvent.change(screen.getByLabelText(/data di nascita/i), { target: { value: '1990-05-01' } })
  }

  it('senza accettare le condizioni non si registra', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Registrati' }))
    expect(await screen.findByText("Per continuare accetta le condizioni d'uso")).toBeInTheDocument()
    expect(fake.client.auth.signUp).not.toHaveBeenCalled()
  })

  it('accettandole si registra; la casella porta ai testi', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    await fillForm()
    const box = screen.getByRole('checkbox', { name: /accetto le condizioni d'uso/i })
    const label = box.closest('label')!
    expect(within(label).getByRole('link', { name: "condizioni d'uso" })).toHaveAttribute('href', legalUrl('termini'))
    expect(within(label).getByRole('link', { name: 'privacy' })).toHaveAttribute('href', legalUrl('privacy'))
    await userEvent.click(box)
    await userEvent.click(screen.getByRole('button', { name: 'Registrati' }))
    await waitFor(() => expect(fake.client.auth.signUp).toHaveBeenCalled())
  })

  it('senza il flag (produzione) non c’è la casella', () => {
    playFlag.on = false
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('bloccare dalla classifica', () => {
  beforeEach(() => {
    fake.rpcResults.get_leaderboard = [entry('u2', 'Bruno', 3), entry('u1', 'Anna', 2), entry('u3', 'Carla', 1)]
    fake.rpcResults.block_person = 'ok'
  })

  it('⋯ apre Blocca e Segnala; Blocca toglie la persona e la salva', async () => {
    renderAt('/classifica', <LeaderboardPage />)
    const more = await screen.findByRole('button', { name: 'Altre azioni per Bruno' })
    expect(screen.queryByRole('button', { name: 'Altre azioni per Anna' })).toBeNull()
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/se blocchi bruno non sarete più amici/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Blocca' }))
    expect(fake.rpcCalls).toContainEqual({ name: 'block_person', args: { p_user: 'u2' } })
    await waitFor(() => expect(screen.queryByText('Bruno', { selector: '.board-name' })).toBeNull())
    expect(screen.getByRole('status')).toHaveTextContent('Hai bloccato Bruno')
    expect(screen.getByText('Carla')).toBeInTheDocument()
  })

  it('se il salvataggio fallisce la persona resta e compare un messaggio', async () => {
    fake.rpcResults.block_person = null
    renderAt('/classifica', <LeaderboardPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Altre azioni per Bruno' }))
    await userEvent.click(screen.getByRole('button', { name: 'Blocca' }))
    expect(await screen.findByText('Non è stato possibile bloccare Bruno. Riprova.')).toBeInTheDocument()
    expect(screen.getByText('Bruno', { selector: '.board-name' })).toBeInTheDocument()
  })

  it('Segnala apre la segnalazione con il nome già scritto', async () => {
    renderAt('/classifica', <LeaderboardPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Altre azioni per Bruno' }))
    await userEvent.click(screen.getByRole('link', { name: 'Segnala' }))
    expect(await screen.findByRole('heading', { name: 'Segnala' })).toBeInTheDocument()
    expect(screen.getByLabelText(/nome in classifica/i)).toHaveValue('Bruno')
    expect(screen.getByRole('radio', { name: /offensivo/i })).toBeChecked()
  })

  it('Annulla chiude il pannello', async () => {
    renderAt('/classifica', <LeaderboardPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Altre azioni per Bruno' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('button', { name: 'Blocca' })).toBeNull()
  })

  it('senza il flag (produzione) non c’è ⋯', async () => {
    playFlag.on = false
    renderAt('/classifica', <LeaderboardPage />)
    await screen.findByText('Bruno', { selector: '.board-name' })
    expect(screen.queryByRole('button', { name: /altre azioni/i })).toBeNull()
  })
})

describe('persone bloccate nella Privacy', () => {
  it('elenca le persone bloccate e le sblocca', async () => {
    fake.rpcResults.blocked_people = [{ user_id: 'u2', display_name: 'Bruno', avatar_path: null }]
    fake.tables.blocks = [{ blocker: 'u1', blocked: 'u2' }]
    renderAt('/privacy', <PrivacyPage />)
    expect(await screen.findByRole('heading', { name: 'Persone bloccate' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Sblocca Bruno' }))
    await waitFor(() => expect(fake.tables.blocks).toEqual([]))
    expect(screen.getByText(/non hai bloccato nessuno/i)).toBeInTheDocument()
  })

  it('porta ai testi completi pubblici', async () => {
    fake.rpcResults.blocked_people = []
    renderAt('/privacy', <PrivacyPage />)
    expect(await screen.findByRole('link', { name: 'privacy completa' })).toHaveAttribute('href', legalUrl('privacy'))
    expect(screen.getByRole('link', { name: "condizioni d'uso" })).toHaveAttribute('href', legalUrl('termini'))
  })

  it('senza il flag (produzione) la pagina resta com’era', () => {
    playFlag.on = false
    renderAt('/privacy', <PrivacyPage />)
    expect(screen.queryByRole('heading', { name: 'Persone bloccate' })).toBeNull()
  })
})
