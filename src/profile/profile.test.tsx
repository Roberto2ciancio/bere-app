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
import { CHANGELOG } from './changelog'
import { MAX_UPLOAD_BYTES, prepareImage, type ImageTools } from './imageUpload'

const image = (size: number, type = 'image/jpeg') => new File([new Uint8Array(size)], 'foto.jpg', { type })

function tools(width: number, height: number) {
  const drawn: { width: number; height: number }[] = []
  const value: ImageTools = {
    decode: async () => ({ width, height, source: {} as CanvasImageSource }),
    encode: async (_source, w, h) => {
      drawn.push({ width: w, height: h })
      return new Blob([new Uint8Array(100)], { type: 'image/jpeg' })
    },
  }
  return { value, drawn }
}

beforeEach(() => {
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none', avatar_path: null, background_path: null }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  window.location.hash = '#/profilo'
  delete document.documentElement.dataset.style
})

describe('prepareImage', () => {
  it('rifiuta un file che non è un\'immagine', async () => {
    await expect(prepareImage(image(10, 'application/pdf'), 512, tools(10, 10).value)).rejects.toThrow('non è un\'immagine')
  })

  it('riduce il lato maggiore mantenendo le proporzioni', async () => {
    const { value, drawn } = tools(4000, 2000)
    await prepareImage(image(10), 1600, value)
    expect(drawn).toEqual([{ width: 1600, height: 800 }])
  })

  it('non ingrandisce un\'immagine piccola', async () => {
    const { value, drawn } = tools(300, 200)
    await prepareImage(image(10), 512, value)
    expect(drawn).toEqual([{ width: 300, height: 200 }])
  })

  it('un\'immagine oltre 5 MB esce sotto il limite', async () => {
    const blob = await prepareImage(image(MAX_UPLOAD_BYTES + 1), 1600, tools(5000, 5000).value)
    expect(blob.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES)
  })

  it('rifiuta il risultato se resta oltre il limite', async () => {
    const big: ImageTools = {
      decode: tools(10, 10).value.decode,
      encode: async () => new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)]),
    }
    await expect(prepareImage(image(10), 512, big)).rejects.toThrow('troppo grande')
  })
})

describe('ProfilePage', () => {
  it('cambiare stile aggiorna subito app e profilo', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Anello' }))
    expect(document.documentElement.dataset.style).toBe('ring')
    await waitFor(() => expect(fake.tables.profiles[0].home_style).toBe('ring'))
  })

  it('cambia nome, suono e quantità', async () => {
    render(<App />)
    const name = await screen.findByDisplayValue('Anna')
    await userEvent.clear(name)
    await userEvent.type(name, 'Annina')
    await userEvent.click(screen.getByRole('button', { name: 'Salva nome' }))
    await waitFor(() => expect(fake.tables.profiles[0].display_name).toBe('Annina'))
    await userEvent.click(screen.getByRole('button', { name: 'Campanella' }))
    await waitFor(() => expect(fake.tables.profiles[0].sound).toBe('campanella'))
    await userEvent.click(screen.getByRole('button', { name: '300 ml' }))
    await waitFor(() => expect(fake.tables.profiles[0].drink_ml).toBe(300))
  })

  it('un nome vuoto non si salva', async () => {
    render(<App />)
    await userEvent.clear(await screen.findByDisplayValue('Anna'))
    await userEvent.click(screen.getByRole('button', { name: 'Salva nome' }))
    expect(await screen.findByText('Inserisci il tuo nome')).toBeInTheDocument()
    expect(fake.tables.profiles[0].display_name).toBe('Anna')
  })

  it('un file non immagine mostra un messaggio', async () => {
    render(<App />)
    const input = await screen.findByLabelText('Foto del profilo')
    await userEvent.upload(input, image(10, 'application/pdf'), { applyAccept: false })
    expect(await screen.findByText(/non è un'immagine/i)).toBeInTheDocument()
    expect(fake.uploads).toHaveLength(0)
  })

  it('con uno sfondo mostra immagine e velo di leggibilità nell\'app', async () => {
    fake.tables.profiles[0].background_path = 'u1/sfondo.jpg'
    const { container } = render(<App />)
    await waitFor(() => {
      const bg = container.querySelector<HTMLElement>('.shell-bg')
      expect(bg?.style.backgroundImage).toContain('backgrounds/u1/sfondo.jpg')
    })
  })

  it('rimuovere lo sfondo torna a quello predefinito e cancella il file', async () => {
    fake.tables.profiles[0].background_path = 'u1/sfondo.jpg'
    const { container } = render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Rimuovi sfondo' }))
    await waitFor(() => expect(fake.tables.profiles[0].background_path).toBeNull())
    expect(container.querySelector('.shell-bg')).toBeNull()
    expect(fake.removed).toEqual([{ bucket: 'backgrounds', paths: ['u1/sfondo.jpg'] }])
  })

  it('il pulsante esci chiude la sessione', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Esci' }))
    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })
  it('mostra la versione e le novità', async () => {
    render(<App />)
    expect(await screen.findByText(`Bere ${__APP_VERSION__}`)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Novità'))
    expect(screen.getByRole('heading', { name: `Versione ${__APP_VERSION__}` })).toBeVisible()
  })
  it('le novità partono dalla versione in package.json', () => {
    expect(CHANGELOG[0].version).toBe(__APP_VERSION__)
  })
})
