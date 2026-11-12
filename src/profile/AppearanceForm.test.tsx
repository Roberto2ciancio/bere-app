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

const flag = vi.hoisted(() => ({ on: true }))
vi.mock('../glu3d/enabled', () => ({
  get GLU_3D_ENABLED() {
    return flag.on
  },
}))

import { AuthProvider } from '../auth/AuthProvider'
import { ProfileProvider } from '../auth/ProfileProvider'
import { AppearanceForm } from './AppearanceForm'

function renderForm() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <AppearanceForm />
      </ProfileProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  flag.on = true
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, sound: 'none' }]
})

describe('AppearanceForm: Glu in 3D', () => {
  it('con il flag acceso la casella c\'è, è spuntata e toglierla spegne il 3D', async () => {
    renderForm()
    const box = await screen.findByLabelText('Glu in 3D')
    expect(box).toBeChecked()
    await userEvent.click(box)
    expect(box).not.toBeChecked()
    await waitFor(() => expect(localStorage.getItem('bere.glu3d.u1')).not.toBeNull())
  })

  it('con il flag spento la casella non c\'è', async () => {
    flag.on = false
    renderForm()
    await screen.findByLabelText('Glu tranquillo')
    expect(screen.queryByLabelText('Glu in 3D')).toBeNull()
  })
})
