import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase'

let fake: FakeSupabase
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return fake.client
  },
}))

import App from '../App'
import { localParts } from '../domain/time'
import { markOnboarded } from '../onboarding/onboardingFlag'
import { exportData, restoreData, toCsv } from '../profile/backup'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date
const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  localStorage.clear()
  fake = createFakeSupabase()
  fake.signIn()
  markOnboarded('u1')
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz, sound: 'none', units: 'ml', stop_at_goal: false, allow_pokes: true, weight_kg: null, activity: null }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
  fake.tables.drinks = []
  fake.rpcResults.daily_totals = []
  fake.rpcResults.get_leaderboard = []
  window.location.hash = '#/home'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('altre bevande dalla home', () => {
  async function openSheet() {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Altra bevanda' }))
    return screen.findByRole('dialog', { name: 'Cosa hai bevuto?' })
  }

  it('propone tazze pronte se non ne hai create', async () => {
    const sheet = await openSheet()
    await userEvent.click(within(sheet).getByRole('button', { name: /bottiglia · 500 ml/i }))
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    expect(fake.tables.drinks[0]).toMatchObject({ amount_ml: 500, drink_type: 'water', hydration_pct: 100 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await screen.findAllByText('0,5 L')).length).toBeGreaterThan(0)
  })

  it('mostra le tue tazze al posto di quelle pronte', async () => {
    fake.tables.cups = [{ id: 'c', user_id: 'u1', name: 'Borraccia', amount_ml: 750, drink_type: 'water', hydration_pct: 100 }]
    const sheet = await openSheet()
    expect(await within(sheet).findByRole('button', { name: /borraccia · 750 ml/i })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /bottiglia/i })).not.toBeInTheDocument()
  })

  it('un caffè conta solo la parte che idrata', async () => {
    const sheet = await openSheet()
    await userEvent.selectOptions(within(sheet).getByLabelText('Bevanda'), 'coffee')
    await userEvent.clear(within(sheet).getByLabelText('Quantità (ml)'))
    await userEvent.type(within(sheet).getByLabelText('Quantità (ml)'), '100')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Segna' }))
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(1))
    expect(fake.tables.drinks[0]).toMatchObject({ amount_ml: 100, drink_type: 'coffee', hydration_pct: 80 })
    expect((await screen.findAllByText('0,08 L')).length).toBeGreaterThan(0)
  })

  it('usa le bevande personalizzate con la loro percentuale', async () => {
    fake.tables.drink_types = [{ id: 'd', user_id: 'u1', name: 'Kombucha', hydration_pct: 60 }]
    const sheet = await openSheet()
    await within(sheet).findByRole('option', { name: /kombucha/i })
    await userEvent.selectOptions(within(sheet).getByLabelText('Bevanda'), 'Kombucha')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Segna' }))
    await waitFor(() => expect(fake.tables.drinks[0]).toMatchObject({ drink_type: 'Kombucha', hydration_pct: 60 }))
  })

  it('rifiuta una quantità non valida', async () => {
    const sheet = await openSheet()
    await userEvent.clear(within(sheet).getByLabelText('Quantità (ml)'))
    await userEvent.type(within(sheet).getByLabelText('Quantità (ml)'), '5000')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Segna' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('tra 1 e 2000')
    expect(fake.tables.drinks).toHaveLength(0)
  })

  it('si chiude senza segnare nulla', async () => {
    const sheet = await openSheet()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fake.tables.drinks).toHaveLength(0)
  })
})

describe('indicazioni in home', () => {
  it('avvisa se oggi hai bevuto moltissimo', async () => {
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'x', amount_ml: 2000, hydration_pct: 100, drink_type: 'water', local_date: today(), drunk_at: new Date().toISOString() }, { user_id: 'u1', client_id: 'y', amount_ml: 2000, hydration_pct: 100, drink_type: 'water', local_date: today(), drunk_at: new Date().toISOString() }, { user_id: 'u1', client_id: 'z', amount_ml: 1000, hydration_pct: 100, drink_type: 'water', local_date: today(), drunk_at: new Date().toISOString() }]
    render(<App />)
    expect(await screen.findByText(/bere troppo in poco tempo/i)).toBeInTheDocument()
  })

  it('sotto la soglia non avvisa', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /ho bevuto/i })
    expect(screen.queryByText(/bere troppo in poco tempo/i)).not.toBeInTheDocument()
  })

  it('con le once mostra le once', async () => {
    fake.tables.profiles[0].units = 'oz'
    render(<App />)
    expect(await screen.findByRole('button', { name: /ho bevuto · 6,8 oz/i })).toBeInTheDocument()
  })
})

describe('storico', () => {
  beforeEach(() => {
    window.location.hash = '#/storico'
    fake.rpcResults.daily_totals = [{ day: today(), total_ml: 3000, drinks: 3 }]
    fake.tables.drinks = [{ user_id: 'u1', client_id: 'x', amount_ml: 3000, hydration_pct: 100, drink_type: 'water', local_date: today(), drunk_at: new Date().toISOString() }]
  })

  it('si raggiunge dalla barra in basso', async () => {
    window.location.hash = '#/home'
    render(<App />)
    await userEvent.click(await screen.findByRole('link', { name: 'Storico' }))
    expect(await screen.findByRole('heading', { name: 'Storico' })).toBeInTheDocument()
  })

  it('mostra statistiche, traguardi e sfide', async () => {
    render(<App />)
    expect(await screen.findByText('Obiettivo raggiunto')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Traguardi' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sfide della settimana' })).toBeInTheDocument()
    expect(screen.getByText('Prima bevuta')).toBeInTheDocument()
  })

  it('ha una barra per giorno, che passa da 7 a 30 giorni', async () => {
    render(<App />)
    const chart = await screen.findByRole('group', { name: 'Litri per giorno' })
    expect(within(chart).getAllByRole('button')).toHaveLength(7)
    await click('30 giorni')
    expect(within(screen.getByRole('group', { name: 'Litri per giorno' })).getAllByRole('button')).toHaveLength(30)
  })

  it('tutti i valori si leggono anche in tabella', async () => {
    render(<App />)
    const table = await screen.findByRole('table', { hidden: true })
    expect(within(table).getAllByRole('row', { hidden: true }).length).toBe(8)
  })

  it('toccando un giorno mostra e cancella le sue bevute', async () => {
    render(<App />)
    await screen.findByRole('group', { name: 'Litri per giorno' })
    expect(await screen.findByRole('button', { name: /togli acqua, 3000 ml/i })).toBeInTheDocument()
    await click(/togli acqua, 3000 ml/i)
    await waitFor(() => expect(fake.tables.drinks).toHaveLength(0))
  })

  it('aggiunge una bevuta a un giorno passato', async () => {
    fake.rpcResults.daily_totals = []
    render(<App />)
    const chart = await screen.findByRole('group', { name: 'Litri per giorno' })
    fireEvent.click(within(chart).getAllByRole('button')[0])
    const picked = within(chart).getAllByRole('button')[0].getAttribute('data-day')!
    await userEvent.clear(screen.getByLabelText('Quantità (ml)'))
    await userEvent.type(screen.getByLabelText('Quantità (ml)'), '300')
    await userEvent.selectOptions(screen.getByLabelText('Bevanda'), 'tea')
    await click('Aggiungi a questo giorno')
    await waitFor(() => expect(fake.tables.drinks.some((d) => d.local_date === picked)).toBe(true))
    expect(fake.tables.drinks.find((d) => d.local_date === picked)).toMatchObject({ amount_ml: 300, drink_type: 'tea', hydration_pct: 90, user_id: 'u1' })
  })

  it('senza rete lo dice', async () => {
    fake.client.rpc.mockImplementation((async () => ({ data: null, error: { message: 'Failed to fetch' } })) as never)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/controlla la connessione/i)
  })
})

describe('tazze e bevande', () => {
  beforeEach(() => {
    window.location.hash = '#/tazze'
    fake.tables.cups = []
    fake.tables.drink_types = []
  })

  it('crea e cancella una tazza', async () => {
    render(<App />)
    await userEvent.type(await screen.findByLabelText('Nome della tazza'), 'Borraccia')
    await userEvent.clear(screen.getByLabelText('Millilitri'))
    await userEvent.type(screen.getByLabelText('Millilitri'), '750')
    await click('Aggiungi tazza')
    await waitFor(() => expect(fake.tables.cups).toHaveLength(1))
    expect(fake.tables.cups[0]).toMatchObject({ user_id: 'u1', name: 'Borraccia', amount_ml: 750, drink_type: 'water', hydration_pct: 100 })
    await userEvent.click(await screen.findByRole('button', { name: 'Elimina Borraccia' }))
    await waitFor(() => expect(fake.tables.cups).toHaveLength(0))
  })

  it('rifiuta una tazza senza nome', async () => {
    render(<App />)
    await screen.findByLabelText('Nome della tazza')
    await click('Aggiungi tazza')
    expect(await screen.findByRole('alert')).toHaveTextContent('Dai un nome')
    expect(fake.tables.cups).toHaveLength(0)
  })

  it('crea una bevanda con la sua percentuale', async () => {
    render(<App />)
    await userEvent.type(await screen.findByLabelText('Nome della bevanda'), 'Kombucha')
    await userEvent.clear(screen.getByLabelText('Quanto idrata (%)'))
    await userEvent.type(screen.getByLabelText('Quanto idrata (%)'), '60')
    await click('Aggiungi bevanda')
    await waitFor(() => expect(fake.tables.drink_types).toHaveLength(1))
    expect(fake.tables.drink_types[0]).toMatchObject({ user_id: 'u1', name: 'Kombucha', hydration_pct: 60 })
  })

  it('rifiuta una percentuale impossibile', async () => {
    render(<App />)
    await userEvent.type(await screen.findByLabelText('Nome della bevanda'), 'X')
    await userEvent.clear(screen.getByLabelText('Quanto idrata (%)'))
    await userEvent.type(screen.getByLabelText('Quanto idrata (%)'), '200')
    await click('Aggiungi bevanda')
    expect(await screen.findByRole('alert')).toHaveTextContent('tra 0 e 150')
  })
})

describe('calcolo dell\'obiettivo', () => {
  beforeEach(() => {
    window.location.hash = '#/profilo'
  })

  async function open() {
    render(<App />)
    await userEvent.click(await screen.findByText('Calcolalo per me'))
    await userEvent.type(screen.getByLabelText('Peso (kg)'), '70')
  }

  it('propone un valore, avverte che è una stima e lo riempie nell\'obiettivo', async () => {
    await open()
    await userEvent.selectOptions(screen.getByLabelText('Attività'), 'moderate')
    expect(await screen.findByText(/suggerito: 2,9 L/i)).toBeInTheDocument()
    expect(screen.getByText(/non è un consiglio medico/i)).toBeInTheDocument()
    await click('Usa questo obiettivo')
    expect(screen.getByLabelText(/obiettivo giornaliero/i)).toHaveValue('2,9')
    await waitFor(() => expect(fake.tables.profiles[0]).toMatchObject({ weight_kg: 70, activity: 'moderate' }))
  })

  it('senza un peso valido non propone nulla', async () => {
    render(<App />)
    await userEvent.click(await screen.findByText('Calcolalo per me'))
    expect(screen.queryByRole('button', { name: 'Usa questo obiettivo' })).not.toBeInTheDocument()
  })

  it('il caldo aggiunge mezzo litro', async () => {
    await open()
    await userEvent.click(screen.getByRole('checkbox', { name: /fa caldo/i }))
    expect(await screen.findByText(/suggerito: 2,8 L/i)).toBeInTheDocument()
  })

  it('il meteo si chiede solo a richiesta, con una posizione approssimata', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ daily: { temperature_2m_max: [31] } })))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 45.46423, longitude: 9.18951 } }) } })
    await open()
    expect(fetchMock).not.toHaveBeenCalled()
    await click('Controlla il meteo di oggi')
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /fa caldo/i })).toBeChecked())
    const url = String((fetchMock.mock.calls[0] as unknown[])[0])
    expect(url).toContain('latitude=45.5')
    expect(url).toContain('longitude=9.2')
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('se il meteo non risponde lo dice', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_: unknown, no: (e: unknown) => void) => no(new Error('negato')) } })
    await open()
    await click('Controlla il meteo di oggi')
    expect(await screen.findByRole('alert')).toHaveTextContent(/meteo/i)
    Reflect.deleteProperty(navigator, 'geolocation')
  })
})

describe('preferenze nel profilo', () => {
  beforeEach(() => {
    window.location.hash = '#/profilo'
  })

  it('i promemoria si possono fermare a obiettivo raggiunto', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('checkbox', { name: /fermati quando raggiungo/i }))
    await waitFor(() => expect(fake.tables.profiles[0].stop_at_goal).toBe(true))
  })

  it('si può rifiutare di essere spronati', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('checkbox', { name: /gli amici possono spronarmi/i }))
    await waitFor(() => expect(fake.tables.profiles[0].allow_pokes).toBe(false))
  })

  it('si scelgono unità e suono', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Once' }))
    await userEvent.click(screen.getByRole('button', { name: 'Bolla' }))
    await waitFor(() => expect(fake.tables.profiles[0]).toMatchObject({ units: 'oz', sound: 'bolla' }))
  })
})

describe('spronare dalla classifica', () => {
  const row = (user_id: string, display_name: string) => ({ user_id, display_name, avatar_path: null, days_met: 1, streak: 1, redbulls: 0, monster_until: null })

  beforeEach(() => {
    window.location.hash = '#/classifica'
    fake.rpcResults.get_leaderboard = [row('u2', 'Bruno'), row('u1', 'Anna')]
  })

  it('si può spronare un altro ma non se stessi', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sprona Bruno' }))
    expect(screen.queryByRole('button', { name: 'Sprona Anna' })).not.toBeInTheDocument()
    await waitFor(() => expect(fake.invocations).toContainEqual({ name: 'poke', body: { to: 'u2' } }))
  })

  it.each([
    ['sent', /notifica inviata a bruno/i],
    ['limit', /già spronato bruno 3 volte/i],
    ['cooldown', /aspetta un'ora prima di spronare di nuovo bruno/i],
    ['blocked', /bruno preferisce non/i],
    ['no-device', /bruno non ha le notifiche attive/i],
    ['failed', /non è stato possibile/i],
  ])('con esito %s lo spiega', async (status, text) => {
    fake.setInvokeResult({ status })
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sprona Bruno' }))
    expect(await screen.findByRole('status')).toHaveTextContent(text)
  })
})

describe('copia dei dati', () => {
  const drink = { user_id: 'u1', client_id: 'x', amount_ml: 200, hydration_pct: 100, drink_type: 'water', local_date: '2026-11-01', drunk_at: '2026-11-01T10:00:00Z' }

  it('esporta tutto ciò che è dell\'utente', async () => {
    fake.tables.drinks = [drink, { ...drink, user_id: 'altro', client_id: 'y' }]
    const data = await exportData('u1')
    expect(data.version).toBe(1)
    expect(data.drinks).toHaveLength(1)
  })

  it('le bevute diventano un CSV, con i testi tra virgolette', () => {
    expect(toCsv([{ ...drink, drink_type: 'Tè "verde", caldo' }])).toBe(
      'data,ora,bevanda,ml,percentuale\n2026-11-01,2026-11-01T10:00:00Z,"Tè ""verde"", caldo",200,100',
    )
  })

  it('il ripristino non duplica e assegna i dati a chi li carica', async () => {
    fake.tables.drinks = [drink]
    const backup = { version: 1, drinks: [drink, { ...drink, user_id: 'altro', client_id: 'y' }], caffeine_intakes: [], cups: [], drink_types: [] }
    expect(await restoreData('u1', backup)).toEqual({ drinks: 1, caffeine: 0, cups: 0, drinkTypes: 0 })
    expect(fake.tables.drinks).toHaveLength(2)
    expect(fake.tables.drinks.every((d) => d.user_id === 'u1')).toBe(true)
  })

  it('il ripristino rifiuta un file non valido', async () => {
    await expect(restoreData('u1', { foo: 1 })).rejects.toThrow(/non è una copia/i)
    await expect(restoreData('u1', { version: 1, drinks: [{ amount_ml: 'x' }] })).rejects.toThrow(/non è una copia/i)
  })

  it('il pulsante di ripristino è nel profilo', async () => {
    window.location.hash = '#/profilo'
    render(<App />)
    expect(await screen.findByLabelText('Ripristina da una copia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scarica copia (JSON)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scarica bevute (CSV)' })).toBeInTheDocument()
  })
})
