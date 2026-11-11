import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', async () => ({ supabase: (await import('./devBackend')).supabase }))

import App from '../App'
import { localParts } from '../domain/time'
import { weekStart } from '../leaderboard/weekStart'
import { storageKey, storagePrefix } from '../lib/storageKey'
import { DevBar } from './DevBar'
import { checkDueReminders, DEV_USER_ID, resetDevData, supabase } from './devBackend'

const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
const today = () => localParts(new Date(), tz).date

async function rows(table: string) {
  return (await supabase.from(table).select('*')).data as Record<string, unknown>[]
}

let network: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  resetDevData()
  network = vi.fn(() => Promise.reject(new Error('rete vietata')))
  vi.stubGlobal('fetch', network)
  window.location.hash = '#/home'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('memoria separata dall\'app vera', () => {
  it('nell\'app di prova ogni chiave ha un prefisso, nell\'app vera nessuno', () => {
    expect(storagePrefix('devapp')).toBe('dev.')
    expect(storagePrefix('production')).toBe('')
    expect(storagePrefix('test')).toBe('')
    expect(storageKey('bere.lastUser')).toBe('bere.lastUser')
  })
})

describe('database finto', () => {
  it('salva sul telefono e conserva dopo la riapertura', async () => {
    await supabase.from('feedback').insert({ user_id: DEV_USER_ID, message: 'ciao' })
    const { supabase: reopened } = await reimport()
    expect(((await reopened.from('feedback').select('*')).data as unknown[]).length).toBe(1)
  })

  it('filtra, ordina e limita', async () => {
    await supabase.from('push_log').insert([
      { user_id: 'a', scheduled_at: '1' },
      { user_id: DEV_USER_ID, scheduled_at: '2' },
      { user_id: DEV_USER_ID, scheduled_at: '3' },
    ])
    const { data } = await supabase.from('push_log').select('*').eq('user_id', DEV_USER_ID).order('scheduled_at', { ascending: false }).limit(1)
    expect(data).toMatchObject([{ scheduled_at: '3' }])
  })

  it('insert con select e single restituisce la riga con id', async () => {
    const { data } = await supabase.from('schedules').insert({ name: 'x' }).select().single()
    expect((data as { id: string }).id).toBeTruthy()
  })

  it('aggiorna e cancella solo le righe filtrate', async () => {
    await supabase.from('schedules').insert([{ id: '1', name: 'a' }, { id: '2', name: 'b' }])
    await supabase.from('schedules').update({ name: 'z' }).eq('id', '1')
    await supabase.from('schedules').delete().eq('id', '2')
    expect(await rows('schedules')).toMatchObject([{ id: '1', name: 'z' }])
  })

  it('upsert non duplica con ignoreDuplicates e sovrascrive senza', async () => {
    const row = { user_id: DEV_USER_ID, client_id: 'c', amount_ml: 200 }
    await supabase.from('drinks').upsert(row, { onConflict: 'user_id,client_id', ignoreDuplicates: true })
    await supabase.from('drinks').upsert({ ...row, amount_ml: 300 }, { onConflict: 'user_id,client_id', ignoreDuplicates: true })
    expect(await rows('drinks')).toMatchObject([{ amount_ml: 200 }])
    await supabase.from('drinks').upsert({ ...row, amount_ml: 300 }, { onConflict: 'user_id,client_id' })
    expect(await rows('drinks')).toMatchObject([{ amount_ml: 300 }])
  })

  it('il servizio di invio risulta sempre attivo', async () => {
    const { data } = await supabase.from('service_status').select('last_run_at').maybeSingle()
    expect(Date.now() - Date.parse((data as { last_run_at: string }).last_run_at)).toBeLessThan(5000)
  })

  it('un\'immagine caricata torna leggibile', async () => {
    await supabase.storage.from('avatars').upload('p.jpg', new Blob(['x'], { type: 'image/jpeg' }))
    expect(supabase.storage.from('avatars').getPublicUrl('p.jpg').data.publicUrl).toMatch(/^data:image\/jpeg/)
  })
})

describe('accesso finto', () => {
  it('parte già dentro, con l\'utente di prova', async () => {
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe(DEV_USER_ID)
  })

  it('dopo l\'uscita entra con qualsiasi password tranne "sbagliata"', async () => {
    await supabase.auth.signOut()
    expect((await supabase.auth.getSession()).data.session).toBeNull()
    expect((await supabase.auth.signInWithPassword({ email: 'a@b.it', password: 'sbagliata' })).error?.message).toMatch(/invalid login/i)
    expect((await supabase.auth.signInWithPassword({ email: 'a@b.it', password: 'qualsiasi' })).error).toBeNull()
    expect((await supabase.auth.getSession()).data.session).not.toBeNull()
  })

  it('la registrazione chiede il codice: 000000 è errato, gli altri vanno bene', async () => {
    await supabase.auth.signOut()
    const signed = await supabase.auth.signUp({ email: 'a@b.it', password: 'password1' })
    expect(signed.data.session).toBeNull()
    expect((await supabase.auth.verifyOtp({ email: 'a@b.it', token: '000000', type: 'signup' })).error?.message).toMatch(/invalid/i)
    expect((await supabase.auth.verifyOtp({ email: 'a@b.it', token: '123456', type: 'signup' })).error).toBeNull()
    expect((await supabase.auth.getSession()).data.session).not.toBeNull()
  })
})

describe('classifica finta', () => {
  const board = async (week = weekStart(new Date(), tz)) =>
    (await supabase.rpc('get_leaderboard', { week_start: week })).data as Record<string, unknown>[]
  const me = async () => (await board()).find((r) => r.user_id === DEV_USER_ID)!

  it('mette l\'utente di prova insieme a concorrenti inventati, ordinati per giorni', async () => {
    const entries = await board()
    expect(entries.length).toBeGreaterThan(2)
    const days = entries.map((e) => e.days_met as number)
    expect(days).toEqual([...days].sort((a, b) => b - a))
  })

  it('conta i giorni con l\'obiettivo raggiunto', async () => {
    await supabase.from('drinks').insert({ user_id: DEV_USER_ID, client_id: 'a', amount_ml: 3000, drunk_at: new Date().toISOString(), local_date: today() })
    expect(await me()).toMatchObject({ days_met: 1, streak: 1 })
  })

})

describe('notifica di prova', () => {
  it('senza permesso risponde che il telefono non è registrato', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    expect((await supabase.functions.invoke('test-push')).data).toEqual({ status: 'no-device' })
  })

  it('con il permesso mostra una notifica locale e la registra', async () => {
    const show = vi.fn(async () => {})
    vi.stubGlobal('Notification', { permission: 'granted' })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ showNotification: show }) } })
    expect((await supabase.functions.invoke('test-push')).data).toEqual({ status: 'sent' })
    expect(show).toHaveBeenCalledTimes(1)
    expect(await rows('push_log')).toMatchObject([{ status: 'sent' }])
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })
})

describe('promemoria con l\'app aperta', () => {
  const monday8 = new Date(2026, 10, 2, 8, 0, 20)
  const show = vi.fn(async () => {})

  beforeEach(async () => {
    show.mockClear()
    vi.stubGlobal('Notification', { permission: 'granted' })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ showNotification: show }) } })
    await supabase.from('schedules').insert({ id: 's', user_id: DEV_USER_ID, name: 'x', weekdays: [1], enabled: true })
    await supabase.from('schedule_times').insert({ id: 't', schedule_id: 's', minutes: 480 })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('all\'orario giusto avvisa una sola volta, anche con due controlli nello stesso minuto', async () => {
    await Promise.all([checkDueReminders(monday8), checkDueReminders(monday8)])
    await checkDueReminders(monday8)
    expect(show).toHaveBeenCalledTimes(1)
    expect(await rows('push_log')).toMatchObject([{ status: 'sent', schedule_time_id: 't' }])
  })

  it('con le notifiche spente non avvisa', async () => {
    localStorage.setItem('bere.pushOff', 'true')
    await checkDueReminders(monday8)
    expect((await supabase.functions.invoke('test-push')).data).toEqual({ status: 'no-device' })
    expect(show).not.toHaveBeenCalled()
  })

  it('non avvisa in un altro minuto, in un altro giorno o con il programma spento', async () => {
    await checkDueReminders(new Date(2026, 10, 2, 8, 1))
    await checkDueReminders(new Date(2026, 10, 3, 8, 0))
    await supabase.from('schedules').update({ enabled: false }).eq('id', 's')
    await checkDueReminders(monday8)
    expect(show).not.toHaveBeenCalled()
  })
})

describe('pannello di prova', () => {
  it('spiega i limiti e riparte da zero', async () => {
    const onRestart = vi.fn()
    render(<DevBar onRestart={onRestart} />)
    await userEvent.click(screen.getByRole('button', { name: 'APP DI PROVA' }))
    expect(screen.getByText(/nulla arriva al server vero/i)).toBeInTheDocument()
    expect(screen.getByText(/serve l'app vera/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Riparti da zero' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('senza permesso dice di attivare le notifiche', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    render(<DevBar />)
    await userEvent.click(screen.getByRole('button', { name: 'APP DI PROVA' }))
    await userEvent.click(screen.getByRole('button', { name: 'Invia una notifica ora' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Prima attiva le notifiche')
  })
})

describe('l\'app intera sul database finto', () => {
  it('fa primo avvio e classifica senza account e senza mai usare la rete', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Iniziamo!' }))
    for (let i = 0; i < 3; i++) await userEvent.click(await screen.findByRole('button', { name: 'Salta' }))
    await screen.findByRole('heading', { name: 'Quando vuoi bere?' })
    // Obiettivo 2 L in bicchieri da 200 ml: dieci promemoria, uno ogni 90 minuti.
    await userEvent.click(screen.getByRole('button', { name: 'Crea i promemoria' }))
    await waitFor(async () => expect(await rows('schedules')).toHaveLength(1))
    expect(await rows('schedule_times')).toHaveLength(10)
    expect(network).not.toHaveBeenCalled()
  })

  it('cancellare il profilo riparte da zero', async () => {
    await supabase.from('feedback').insert({ user_id: DEV_USER_ID, message: 'x' })
    expect((await supabase.functions.invoke('delete-account')).error).toBeNull()
    expect(await rows('feedback')).toHaveLength(0)
  })
})

async function reimport() {
  vi.resetModules()
  return import('./devBackend')
}
