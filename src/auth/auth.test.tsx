import { act, render, screen, waitFor } from '@testing-library/react'
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
import { markOnboarded } from '../onboarding/onboardingFlag'

beforeEach(() => {
  fake = createFakeSupabase()
  markOnboarded('u1')
  window.location.hash = '#/home'
})

function fill(label: RegExp, value: string) {
  return userEvent.type(screen.getByLabelText(label), value)
}

describe('accesso', () => {
  it('senza sessione #/home porta al login', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })

  it('password errata mostra il messaggio in italiano', async () => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } })
    render(<App />)
    await screen.findByRole('heading', { name: 'Accedi' })
    await fill(/email/i, 'a@b.it')
    await fill(/password/i, 'sbagliata')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))
    expect(await screen.findByText('Email o password non corrette')).toBeInTheDocument()
  })

  it('con sessione mostra le tre schede', async () => {
    fake.signIn()
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'goccia' }]
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Oggi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Classifica' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profilo' })).toBeInTheDocument()
  })

  it('aggiorna il fuso del profilo quando il dispositivo è altrove', async () => {
    fake.signIn()
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Pacific/Apia', sound: 'goccia' }]
    render(<App />)
    await waitFor(() => expect(fake.tables.profiles[0].tz).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone))
  })
})

describe('registrazione', () => {
  beforeEach(() => {
    window.location.hash = '#/registrati'
  })

  it('richiede il nome', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Crea il tuo profilo' })
    await fill(/email/i, 'a@b.it')
    await fill(/password/i, 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Registrati' }))
    expect(await screen.findByText('Inserisci il tuo nome')).toBeInTheDocument()
    expect(fake.client.auth.signUp).not.toHaveBeenCalled()
  })

  it('richiede una password di almeno 8 caratteri', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Crea il tuo profilo' })
    await fill(/nome/i, 'Anna')
    await fill(/email/i, 'a@b.it')
    await fill(/password/i, 'corta')
    await userEvent.click(screen.getByRole('button', { name: 'Registrati' }))
    expect(await screen.findByText('La password deve avere almeno 8 caratteri')).toBeInTheDocument()
    expect(fake.client.auth.signUp).not.toHaveBeenCalled()
  })

  it('invia nome e fuso come dati del profilo e chiede di confermare email', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Crea il tuo profilo' })
    await fill(/nome/i, 'Anna')
    await fill(/email/i, 'a@b.it')
    await fill(/password/i, 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Registrati' }))
    expect(await screen.findByText(/controlla la tua email/i)).toBeInTheDocument()
    const arg = fake.client.auth.signUp.mock.calls[0][0] as { options: { data: { display_name: string; tz: string } } }
    expect(arg.options.data.display_name).toBe('Anna')
    expect(arg.options.data.tz).toBeTruthy()
  })
})

describe('errori di registrazione', () => {
  async function submit(email = 'a@b.it') {
    window.location.hash = '#/registrati'
    render(<App />)
    await screen.findByRole('heading', { name: 'Crea il tuo profilo' })
    await fill(/nome/i, 'Anna')
    await fill(/email/i, email)
    await fill(/password/i, 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Registrati' }))
  }

  it.each([
    ['email rate limit exceeded', /troppe email/i],
    ['Failed to fetch', /controlla la connessione/i],
    ['Unable to validate email address: invalid format', /controlla l'indirizzo email/i],
    ['Password is known to be weak and easy to guess', /password più sicura/i],
    ['Errore mai visto', /registrazione non riuscita/i],
  ])('per "%s" spiega il problema', async (message, expected) => {
    fake.client.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { id: 'u1' } }, error: { message } })
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
  })

  it('una email già registrata porta all\'accesso invece di aspettare una mail che non arriva', async () => {
    const existing = { session: null, user: { id: 'u1', identities: [] } }
    fake.client.auth.signUp.mockResolvedValueOnce({ data: existing, error: null })
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(/ha già un profilo/i)
    expect(screen.queryByText(/controlla la tua email/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /accedi/i })).toBeInTheDocument()
  })

  it('invia la email senza spazi aggiunti dalla tastiera', async () => {
    await submit('a@b.it ')
    await screen.findByText(/controlla la tua email/i)
    const arg = fake.client.auth.signUp.mock.calls[0][0] as { email: string }
    expect(arg.email).toBe('a@b.it')
  })

  it('la tastiera non mette la maiuscola all\'inizio della email', async () => {
    window.location.hash = '#/registrati'
    render(<App />)
    const input = await screen.findByLabelText(/email/i)
    expect(input).toHaveAttribute('autocapitalize', 'none')
  })
})

describe('link ricevuti via email', () => {
  it('il router non cancella il link di recupero prima che Supabase lo legga', async () => {
    window.location.hash = '#access_token=abc&type=recovery'
    render(<App />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(window.location.hash).toContain('access_token=abc')
    expect(screen.queryByRole('heading', { name: 'Accedi' })).not.toBeInTheDocument()
  })

  it('letto il link chiede la nuova password', async () => {
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'goccia' }]
    window.location.hash = '#access_token=abc&type=recovery'
    render(<App />)
    await act(async () => {
      fake.signIn()
      fake.emit('PASSWORD_RECOVERY')
      window.location.hash = ''
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(await screen.findByRole('heading', { name: 'Nuova password' })).toBeInTheDocument()
  })

  it('un link non valido non resta bloccato in attesa', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      window.location.hash = '#access_token=abc&type=recovery'
      render(<App />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_999)
      })
      expect(screen.queryByRole('heading', { name: 'Accedi' })).not.toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(screen.getByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('un link scaduto spiega cosa fare e propone di chiederne uno nuovo', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Recupera la password' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/scaduto/i)
  })

  it('senza link un indirizzo sconosciuto porta alla home', async () => {
    window.location.hash = '#/non-esiste'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })

  it('dopo il salvataggio spiega come tornare all\'app installata', async () => {
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'goccia' }]
    fake.signIn()
    render(<App />)
    await waitFor(() => fake.emit('PASSWORD_RECOVERY'))
    await screen.findByRole('heading', { name: 'Nuova password' })
    expect(screen.getByText(/app installata/i)).toBeInTheDocument()
    await fill(/password/i, 'nuovapass1')
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(fake.client.auth.updateUser).toHaveBeenCalledWith({ password: 'nuovapass1' })
    expect(await screen.findByRole('link', { name: 'Oggi' })).toBeInTheDocument()
  })
})

describe('verifica email con codice', () => {
  async function register() {
    window.location.hash = '#/registrati'
    render(<App />)
    await screen.findByRole('heading', { name: 'Crea il tuo profilo' })
    await fill(/nome/i, 'Anna')
    await fill(/email/i, 'a@b.it')
    await fill(/password/i, 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Registrati' }))
    await screen.findByRole('heading', { name: 'Inserisci il codice' })
  }

  it('il codice giusto conferma la email e apre app', async () => {
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'goccia' }]
    fake.client.auth.verifyOtp.mockImplementationOnce(async () => {
      fake.signIn()
      fake.emit('SIGNED_IN')
      return { data: { session: null }, error: null }
    })
    await register()
    await fill(/codice/i, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    expect(fake.client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.it', token: '123456', type: 'signup' })
    expect(await screen.findByRole('link', { name: 'Oggi' })).toBeInTheDocument()
  })

  it('accetta un codice incollato con spazi', async () => {
    await register()
    await userEvent.click(screen.getByLabelText(/codice/i))
    await userEvent.paste(' 123 456 ')
    await userEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    expect(fake.client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.it', token: '123456', type: 'signup' })
  })

  it('non invia un codice incompleto', async () => {
    await register()
    await fill(/codice/i, '123')
    await userEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    expect(await screen.findByText('Il codice ha 6 cifre')).toBeInTheDocument()
    expect(fake.client.auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('un codice sbagliato o scaduto si può riprovare', async () => {
    fake.client.auth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Token has expired or is invalid' } })
    await register()
    await fill(/codice/i, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Codice errato o scaduto')
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeEnabled()
  })

  it('senza rete non dice che il codice è sbagliato', async () => {
    fake.client.auth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Failed to fetch' } })
    await register()
    await fill(/codice/i, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Controlla la connessione')
  })

  it('invia un nuovo codice alla stessa email', async () => {
    await register()
    await userEvent.click(screen.getByRole('button', { name: 'Invia un nuovo codice' }))
    expect(fake.client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.it' })
    expect(await screen.findByRole('status')).toHaveTextContent('Nuovo codice inviato')
  })

  it('se il nuovo codice non parte lo dice', async () => {
    fake.client.auth.resend.mockResolvedValueOnce({ data: {}, error: { message: 'Email rate limit exceeded' } })
    await register()
    await userEvent.click(screen.getByRole('button', { name: 'Invia un nuovo codice' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Non è stato possibile inviare')
  })

  it('accedendo senza aver confermato chiede il codice e ne invia uno nuovo', async () => {
    fake.client.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Email not confirmed' } })
    window.location.hash = '#/login'
    render(<App />)
    await screen.findByRole('heading', { name: 'Accedi' })
    await fill(/email/i, 'a@b.it')
    await fill(/password/i, 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))
    expect(await screen.findByRole('heading', { name: 'Inserisci il codice' })).toBeInTheDocument()
    expect(fake.client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.it' })
  })
})

describe('recupero password', () => {
  beforeEach(() => {
    window.location.hash = '#/recupera'
  })

  async function request(email: string) {
    render(<App />)
    await screen.findByRole('heading', { name: 'Recupera la password' })
    await fill(/email/i, email)
    await userEvent.click(screen.getByRole('button', { name: 'Invia il link' }))
  }

  it('mostra lo stesso messaggio se la email esiste', async () => {
    await request('a@b.it')
    expect(await screen.findByText(/se l'email è registrata/i)).toBeInTheDocument()
  })

  it('mostra lo stesso messaggio se la richiesta fallisce', async () => {
    fake.client.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { message: 'User not found' } })
    await request('nessuno@b.it')
    expect(await screen.findByText(/se l'email è registrata/i)).toBeInTheDocument()
  })

  it('dal link via email chiede la nuova password', async () => {
    fake.signIn()
    fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'goccia' }]
    render(<App />)
    await waitFor(() => fake.emit('PASSWORD_RECOVERY'))
    expect(await screen.findByRole('heading', { name: 'Nuova password' })).toBeInTheDocument()
  })
})
