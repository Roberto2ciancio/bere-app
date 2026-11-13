import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

const flag = vi.hoisted(() => ({ on: true }))
vi.mock('../mascot/variantsFlag', () => ({
  get GLU_VARIANTS() {
    return flag.on
  },
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { resetSharedLevels } from '../levels/useLevels'
import { GluVariantPicker } from './GluVariantPicker'

function renderPicker() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <GluVariantPicker />
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  resetSharedLevels()
  flag.on = true
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'glu', drink_ml: 200, sound: 'none' }]
  // 350 punti: livello 3 (da 300 a 600).
  fake.rpcResults.get_levels = [{ user_id: 'u1', points: 350 }]
})

const option = (name: RegExp) => screen.getByRole('radio', { name })

describe('GluVariantPicker', () => {
  it('griglia con 6 opzioni: le bloccate dicono «Livello N» e hanno il lucchetto', async () => {
    renderPicker()
    const group = await screen.findByRole('radiogroup', { name: 'Il tuo Glu' })
    await waitFor(() => expect(option(/^Glu Limone/)).not.toHaveAttribute('data-locked'))
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(6)
    expect(option(/^Glu$/)).toHaveAttribute('aria-checked', 'true')
    for (const [name, level] of [[/^Glu Fragola/, 4], [/^Glu Cocco/, 5], [/^Glu Notte/, 6]] as const) {
      const radio = option(name)
      expect(radio).toHaveAttribute('data-locked', 'true')
      expect(radio).toHaveTextContent(`Livello ${level}`)
      expect(radio.querySelector('.variant-lock')).not.toBeNull()
    }
    expect(option(/^Glu Menta/)).not.toHaveTextContent('Livello')
    expect(option(/^Glu Menta/).querySelector('[data-variant="menta"]')).not.toBeNull()
  })

  it('tocco su una bloccata: «Ti mancano X punti al livello N», nessun salvataggio', async () => {
    renderPicker()
    await waitFor(() => expect(option(/^Glu Limone/)).not.toHaveAttribute('data-locked'))
    await userEvent.click(option(/^Glu Fragola/))
    expect(screen.getByRole('status')).toHaveTextContent('Ti mancano 250 punti al livello 4')
    await userEvent.click(option(/^Glu Notte/))
    expect(screen.getByRole('status')).toHaveTextContent('Ti mancano 1150 punti al livello 6')
    expect(fake.tables.profiles[0].home_style).toBe('glu')
    expect(option(/^Glu$/)).toHaveAttribute('aria-checked', 'true')
  })

  it('tocco su una sbloccata: saveProfile({ home_style }) e la scelta passa lì', async () => {
    renderPicker()
    await waitFor(() => expect(option(/^Glu Menta/)).not.toHaveAttribute('data-locked'))
    await userEvent.click(option(/^Glu Menta/))
    await waitFor(() => expect(option(/^Glu Menta/)).toHaveAttribute('aria-checked', 'true'))
    expect(fake.tables.profiles[0].home_style).toBe('menta')
    expect(option(/^Glu$/)).toHaveAttribute('aria-checked', 'false')
  })

  it('errore di salvataggio: messaggio e scelta invariata', async () => {
    fake.failures.update = 'rete'
    renderPicker()
    await waitFor(() => expect(option(/^Glu Menta/)).not.toHaveAttribute('data-locked'))
    await userEvent.click(option(/^Glu Menta/))
    expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio non riuscito')
    expect(option(/^Glu$/)).toHaveAttribute('aria-checked', 'true')
    expect(option(/^Glu Menta/)).toHaveAttribute('aria-checked', 'false')
  })

  it('senza livello noto solo il classico è libero e il messaggio dice il livello', async () => {
    delete fake.rpcResults.get_levels
    renderPicker()
    await screen.findByRole('radiogroup', { name: 'Il tuo Glu' })
    await userEvent.click(option(/^Glu Menta/))
    expect(screen.getByRole('status')).toHaveTextContent('Si sblocca al livello 2')
  })

  it('con il flag spento non c’è', async () => {
    flag.on = false
    const { container } = renderPicker()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
