import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import App from '../App'

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  window.location.hash = '#/profilo/account'
})

async function change(current: string, next: string) {
  render(<App />)
  await userEvent.type(await screen.findByLabelText('Password attuale'), current)
  await userEvent.type(screen.getByLabelText('Nuova password'), next)
  await userEvent.click(screen.getByRole('button', { name: 'Cambia password' }))
}

describe('cambio password dal profilo', () => {
  it('controlla la password attuale e poi salva quella nuova', async () => {
    await change('vecchia123', 'nuovapass1')
    await screen.findByText('Password cambiata.')
    expect(fake.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.it', password: 'vecchia123' })
    expect(fake.client.auth.updateUser).toHaveBeenCalledWith({ password: 'nuovapass1' })
    expect(screen.getByLabelText('Password attuale')).toHaveValue('')
    expect(screen.getByLabelText('Nuova password')).toHaveValue('')
  })

  it('con la password attuale errata non cambia nulla', async () => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } })
    await change('sbagliata1', 'nuovapass1')
    expect(await screen.findByText('La password attuale non è corretta')).toBeInTheDocument()
    expect(fake.client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('senza rete non dice che la password è errata', async () => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Failed to fetch' } })
    await change('vecchia123', 'nuovapass1')
    expect(await screen.findByText(/controlla la connessione/i)).toBeInTheDocument()
    expect(fake.client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('richiede almeno 8 caratteri senza contattare il server', async () => {
    await change('vecchia123', 'corta')
    expect(await screen.findByText('La nuova password deve avere almeno 8 caratteri')).toBeInTheDocument()
    expect(fake.client.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('se il salvataggio fallisce lo dice', async () => {
    fake.client.auth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'New password should be different' } })
    await change('vecchia123', 'nuovapass1')
    expect(await screen.findByText(/non è stato possibile cambiare/i)).toBeInTheDocument()
    expect(screen.queryByText('Password cambiata.')).not.toBeInTheDocument()
  })

  it('se non ricorda la password invia il link alla propria email', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Non la ricordo: inviami un link' }))
    await waitFor(() => expect(fake.client.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1))
    expect(fake.client.auth.resetPasswordForEmail.mock.calls[0][0]).toBe('a@b.it')
    expect(await screen.findByText(/link per scegliere una nuova password/i)).toBeInTheDocument()
  })

  it('se il link non parte lo dice', async () => {
    fake.client.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { message: 'Email rate limit exceeded' } })
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Non la ricordo: inviami un link' }))
    expect(await screen.findByText(/non è stato possibile inviare il link/i)).toBeInTheDocument()
  })
})
