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
import { DeleteAccount } from '../profile/DeleteAccount'
import { PrivacyPage } from '../profile/PrivacyPage'
import { FeedbackForm } from './FeedbackForm'
import { ReportPage } from './ReportPage'

function wrap(node: React.ReactNode) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
})

describe('FeedbackForm', () => {
  const box = () => screen.findByLabelText(/cosa miglioreresti/i)
  const send = () => userEvent.click(screen.getByRole('button', { name: 'Invia' }))

  it('un messaggio vuoto viene rifiutato', async () => {
    wrap(<FeedbackForm />)
    await userEvent.type(await box(), '   ')
    await send()
    expect(await screen.findByRole('alert')).toHaveTextContent(/scrivi/i)
    expect(fake.tables.feedback ?? []).toHaveLength(0)
  })

  it('un messaggio oltre 2000 caratteri viene rifiutato', async () => {
    wrap(<FeedbackForm />)
    const input = await box()
    await userEvent.click(input)
    await userEvent.paste('a'.repeat(2001))
    await send()
    expect(await screen.findByRole('alert')).toHaveTextContent(/2000/)
    expect(fake.tables.feedback ?? []).toHaveLength(0)
  })

  it('un invio riuscito salva, svuota il modulo e ringrazia', async () => {
    wrap(<FeedbackForm />)
    const input = await box()
    await userEvent.type(input, '  Vorrei i widget ')
    await send()
    expect(await screen.findByRole('status')).toHaveTextContent(/grazie/i)
    expect(input).toHaveValue('')
    expect(fake.tables.feedback[0]).toMatchObject({ user_id: 'u1', message: 'Vorrei i widget' })
  })

  it('un errore conserva il testo', async () => {
    fake.failures.insert = 'offline'
    wrap(<FeedbackForm />)
    const input = await box()
    await userEvent.type(input, 'Idea')
    await send()
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è partito/i)
    expect(input).toHaveValue('Idea')
  })
})

describe('DeleteAccount', () => {
  const confirm = () => screen.findByLabelText(/scrivi elimina/i)
  const remove = () => screen.getByRole('button', { name: /elimina definitivamente/i })

  it('resta disattivato finché non si scrive ELIMINA', async () => {
    wrap(<DeleteAccount />)
    const input = await confirm()
    expect(remove()).toBeDisabled()
    await userEvent.type(input, 'elimin')
    expect(remove()).toBeDisabled()
  })

  it('con ELIMINA invoca la funzione ed esce', async () => {
    wrap(<DeleteAccount />)
    await userEvent.type(await confirm(), 'ELIMINA')
    await userEvent.click(remove())
    await waitFor(() => expect(fake.invocations.map((i) => i.name)).toEqual(['delete-account']))
    await waitFor(() => expect(fake.client.auth.signOut).toHaveBeenCalled())
  })

  it('se fallisce mostra un errore e non esce', async () => {
    fake.failures.invoke = 'boom'
    wrap(<DeleteAccount />)
    await userEvent.type(await confirm(), 'ELIMINA')
    await userEvent.click(remove())
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è stato possibile/i)
    expect(fake.client.auth.signOut).not.toHaveBeenCalled()
  })
})

describe('PrivacyPage', () => {
  it('dice cosa si raccoglie, chi lo vede e come cancellarlo', async () => {
    wrap(<PrivacyPage />)
    expect(await screen.findByText(/nome e foto li vedono solo i tuoi amici/i)).toBeInTheDocument()
    expect(screen.getByText(/supabase/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/scrivi elimina/i)).toBeInTheDocument()
  })
})

describe('ReportPage', () => {
  const send = () => userEvent.click(screen.getByRole('button', { name: 'Invia la segnalazione' }))

  it("per il diritto d'autore servono le due dichiarazioni", async () => {
    wrap(<ReportPage />)
    await userEvent.type(await screen.findByLabelText(/nome in classifica/i), 'Marco')
    await userEvent.type(screen.getByLabelText(/quale opera/i), 'La mia foto del tramonto')
    await send()
    expect(await screen.findByRole('alert')).toHaveTextContent(/dichiarazioni/i)
    expect(fake.tables.feedback ?? []).toHaveLength(0)
  })

  it('una segnalazione completa arriva tra i suggerimenti con chi è segnalato', async () => {
    wrap(<ReportPage />)
    await userEvent.type(await screen.findByLabelText(/nome in classifica/i), 'Marco')
    await userEvent.type(screen.getByLabelText(/quale opera/i), 'La mia foto del tramonto')
    await userEvent.click(screen.getByLabelText(/buona fede/i))
    await userEvent.click(screen.getByLabelText(/informazioni sono esatte/i))
    await send()
    expect(await screen.findByRole('status')).toHaveTextContent(/ricevuta/i)
    await waitFor(() => expect(fake.tables.feedback).toHaveLength(1))
    const row = fake.tables.feedback[0] as { message: string; user_id: string }
    expect(row.user_id).toBe('u1')
    expect(row.message).toContain("[Segnalazione: diritto d'autore]")
    expect(row.message).toContain('In classifica: Marco')
  })

  it('un contenuto offensivo non chiede le dichiarazioni', async () => {
    wrap(<ReportPage />)
    await userEvent.click(await screen.findByLabelText(/offensivo/i))
    expect(screen.queryByLabelText(/buona fede/i)).not.toBeInTheDocument()
  })
})
