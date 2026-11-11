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
import { Avatar } from './Avatar'
import { AvatarPicker } from './AvatarPicker'
import { AVATAR_PRESETS, presetId } from './presets'

beforeEach(() => {
  fake = createFakeSupabase()
})

describe('preset', () => {
  it('ci sono 12 avatar con id stabili e un nome per lo screen reader', () => {
    expect(AVATAR_PRESETS.map((p) => p.id)).toEqual([
      'glu-azzurro', 'glu-rosso', 'glu-verde', 'glu-giallo', 'glu-viola', 'glu-arancio',
      'glu-rosa', 'glu-blu', 'glu-cappellino', 'glu-occhiali', 'glu-cuffie', 'glu-fiocco',
    ])
    expect(new Set(AVATAR_PRESETS.map((p) => p.label)).size).toBe(12)
  })

  it('presetId riconosce solo i preset', () => {
    expect(presetId('preset:glu-rosso')).toBe('glu-rosso')
    expect(presetId('avatars/u1.webp')).toBeNull()
    expect(presetId(null)).toBeNull()
  })
})

describe('Avatar', () => {
  it('un preset noto mostra il disegno e nessuna foto', () => {
    const { container } = render(<Avatar path="preset:glu-rosso" name="Anna" />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('un preset sconosciuto mostra l\'iniziale', () => {
    const { container } = render(<Avatar path="preset:inesistente" name="anna" />)
    expect(container.textContent).toBe('A')
    expect(container.querySelector('img')).toBeNull()
  })

  it('senza avatar mostra l\'iniziale', () => {
    const { container } = render(<Avatar path={null} name="Bruno" large />)
    expect(container.textContent).toBe('B')
    expect(container.querySelector('.avatar-lg')).not.toBeNull()
  })

  it('una foto mostra l\'immagine dallo storage', () => {
    const { container } = render(<Avatar path="avatars/u1.webp" name="Anna" />)
    expect(container.querySelector('img')?.getAttribute('src')).toContain('avatars/u1.webp')
  })
})

describe('AvatarPicker', () => {
  it('ha 12 scelte e cliccarne una la sceglie', async () => {
    const onPick = vi.fn()
    render(<AvatarPicker value="preset:glu-verde" onPick={onPick} />)
    expect(screen.getByRole('radiogroup', { name: 'Avatar' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(12)
    expect(screen.getByRole('radio', { name: 'Goccia verde' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Goccia rossa' }))
    expect(onPick).toHaveBeenCalledWith('preset:glu-rosso')
  })

  it('le frecce spostano il focus tra le scelte', async () => {
    render(<AvatarPicker value={null} onPick={() => {}} />)
    const radios = screen.getAllByRole('radio')
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([radios[0]])
    radios[0].focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(radios[1]).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(radios[11]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(radios[0]).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(radios[11]).toHaveFocus()
  })
})

describe('Profilo', () => {
  beforeEach(() => {
    fake.signIn()
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none', avatar_path: 'u1/foto.jpg', background_path: null }]
    fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
    window.location.hash = '#/profilo'
  })

  it('scegliere un avatar pronto lo salva nel profilo e cancella la foto caricata prima', async () => {
    const { container } = render(<App />)
    await userEvent.click(await screen.findByRole('radio', { name: 'Goccia rossa' }))
    await waitFor(() => expect(fake.tables.profiles[0].avatar_path).toBe('preset:glu-rosso'))
    expect(screen.getByRole('radio', { name: 'Goccia rossa' })).toHaveAttribute('aria-checked', 'true')
    expect(container.querySelector('.profile-id img')).toBeNull()
    await waitFor(() => expect(fake.removed).toEqual([{ bucket: 'avatars', paths: ['u1/foto.jpg'] }]))
  })

  it('il gruppo prende il nome dal titolo visibile', async () => {
    render(<App />)
    expect(await screen.findByRole('radiogroup', { name: 'Oppure scegli un avatar' })).toBeInTheDocument()
  })

  it("se il salvataggio non riesce lo dice e resta scelto l'avatar di prima", async () => {
    fake.tables.profiles[0].avatar_path = 'preset:glu-blu'
    fake.failures.update = 'rete assente'
    render(<App />)
    await userEvent.click(await screen.findByRole('radio', { name: 'Goccia rossa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Salvataggio non riuscito. Controlla la connessione e riprova.')
    expect(screen.getByRole('radio', { name: 'Goccia rossa' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Goccia blu' })).toHaveAttribute('aria-checked', 'true')
    expect(fake.tables.profiles[0].avatar_path).toBe('preset:glu-blu')
  })

  it('caricare una foto al posto di un preset non chiede allo storage di cancellare il preset', async () => {
    fake.tables.profiles[0].avatar_path = 'preset:glu-blu'
    vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10 }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as unknown as RenderingContext)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob([new Uint8Array(10)])))
    try {
      render(<App />)
      await userEvent.upload(await screen.findByLabelText('Foto del profilo'), new File([new Uint8Array(10)], 'foto.jpg', { type: 'image/jpeg' }))
      await waitFor(() => expect(fake.tables.profiles[0].avatar_path).toMatch(/^u1\/.+\.jpg$/))
      expect(fake.removed).toEqual([])
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })
})
