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

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { goalChangeDate } from '../domain/goals'
import { GoalForm } from './GoalForm'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone

function renderForm() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <GoalForm />
      </ProfileProvider>
    </AuthProvider>,
  )
}

async function enter(value: string) {
  const input = await screen.findByLabelText(/obiettivo giornaliero/i)
  await waitFor(() => expect(input).not.toHaveValue(''))
  await userEvent.clear(input)
  await userEvent.type(input, value)
  await userEvent.click(screen.getByRole('button', { name: 'Salva obiettivo' }))
}

beforeEach(() => {
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
})

describe('GoalForm', () => {
  it('mostra l\'obiettivo attuale', async () => {
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/obiettivo giornaliero/i)).toHaveValue('3'))
  })

  it('salva con validità da domani e accetta la virgola', async () => {
    renderForm()
    await enter('2,5')
    expect(await screen.findByText(/valido da domani/i)).toBeInTheDocument()
    const change = fake.tables.goal_changes.find((g) => g.goal_ml === 2500)
    expect(change).toMatchObject({ user_id: 'u1', effective_from: goalChangeDate(new Date(), tz) })
    expect(fake.tables.goal_changes.find((g) => g.effective_from === '2026-01-01')?.goal_ml).toBe(3000)
  })

  it('due modifiche nello stesso giorno sovrascrivono la precedente', async () => {
    renderForm()
    await enter('2,5')
    await screen.findByText(/valido da domani/i)
    await enter('2')
    await waitFor(() => expect(fake.tables.goal_changes.find((g) => g.effective_from !== '2026-01-01')?.goal_ml).toBe(2000))
    expect(fake.tables.goal_changes).toHaveLength(2)
  })

  it('sotto 1,5 L avvisa che esclude dalla classifica', async () => {
    renderForm()
    await enter('1,4')
    expect(await screen.findByText(/sotto 1,5 L non entri in classifica/i)).toBeInTheDocument()
  })

  it.each(['abc', '0', '11'])('rifiuta il valore %s', async (value) => {
    renderForm()
    await enter(value)
    expect(await screen.findByText(/inserisci un obiettivo tra 0,1 e 10 litri/i)).toBeInTheDocument()
    expect(fake.tables.goal_changes).toHaveLength(1)
  })
})
