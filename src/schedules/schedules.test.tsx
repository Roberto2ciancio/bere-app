import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { SchedulesPage } from './SchedulesPage'

function renderPage() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter>
          <SchedulesPage />
        </MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  )
}

function seedSchedule(minutes = [480, 570]) {
  fake.tables.schedules = [{ id: 's1', user_id: 'u1', name: 'Lavoro', weekdays: [1, 2], enabled: true }]
  fake.tables.schedule_times = minutes.map((m, i) => ({ id: `t${i}`, schedule_id: 's1', minutes: m }))
}

const openEditor = async (name = 'Lavoro') => userEvent.click(await screen.findByRole('button', { name: `Modifica ${name}` }))

async function addTime(value: string) {
  await openEditor()
  fireEvent.change(await screen.findByLabelText('Nuovo orario'), { target: { value } })
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi orario' }))
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Salva programma' }))

beforeEach(() => {
  fake = createFakeSupabase()
  fake.signIn()
  fake.tables.profiles = [{ id: 'u1', display_name: 'Anna', home_style: 'bottle', drink_ml: 200, tz: 'Europe/Rome', sound: 'none' }]
  fake.tables.goal_changes = [{ user_id: 'u1', effective_from: '2026-01-01', goal_ml: 3000 }]
})

describe('SchedulesPage', () => {
  it('non propone programmi predefiniti', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    expect(screen.queryByText(/modello/i)).not.toBeInTheDocument()
  })

  it('due tocchi veloci su Crea creano un solo programma', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    const button = screen.getByRole('button', { name: 'Crea promemoria' })
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByRole('button', { name: 'Modifica Ogni 1 ora' })
    expect(fake.tables.schedules).toHaveLength(1)
  })

  it('avvisa se due programmi attivi hanno gli stessi orari negli stessi giorni', async () => {
    fake.tables.schedules = [
      { id: 's1', user_id: 'u1', name: 'A', weekdays: [1, 2], enabled: true },
      { id: 's2', user_id: 'u1', name: 'B', weekdays: [2, 3], enabled: true },
    ]
    fake.tables.schedule_times = [
      { id: 't1', schedule_id: 's1', minutes: 480 },
      { id: 't2', schedule_id: 's2', minutes: 480 },
    ]
    renderPage()
    expect(await screen.findByText(/notifiche doppie/i)).toBeInTheDocument()
  })

  it('non avvisa se gli orari coincidono ma i giorni no, o se un programma è spento', async () => {
    fake.tables.schedules = [
      { id: 's1', user_id: 'u1', name: 'A', weekdays: [1], enabled: true },
      { id: 's2', user_id: 'u1', name: 'B', weekdays: [2], enabled: true },
      { id: 's3', user_id: 'u1', name: 'C', weekdays: [1], enabled: false },
    ]
    fake.tables.schedule_times = [
      { id: 't1', schedule_id: 's1', minutes: 480 },
      { id: 't2', schedule_id: 's2', minutes: 480 },
      { id: 't3', schedule_id: 's3', minutes: 480 },
    ]
    renderPage()
    await screen.findByRole('button', { name: 'Modifica A' })
    expect(screen.queryByText(/notifiche doppie/i)).not.toBeInTheDocument()
  })

  it('aggiungere un orario lo salva', async () => {
    seedSchedule()
    renderPage()
    await addTime('10:15')
    await save()
    await waitFor(() => expect(fake.tables.schedule_times.map((t) => t.minutes).sort()).toEqual([480, 570, 615]))
  })

  it('modificare i dati del programma non ricrea gli orari esistenti', async () => {
    seedSchedule()
    renderPage()
    await openEditor()
    const name = await screen.findByLabelText('Nome del programma')
    await userEvent.clear(name)
    await userEvent.type(name, 'Ufficio')
    await save()
    await waitFor(() => expect(fake.tables.schedules[0].name).toBe('Ufficio'))
    expect(fake.tables.schedule_times.map((t) => t.id).sort()).toEqual(['t0', 't1'])
  })

  it('togliere un orario lo cancella', async () => {
    seedSchedule()
    renderPage()
    await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: 'Togli 8:00' }))
    await save()
    await waitFor(() => expect(fake.tables.schedule_times.map((t) => t.minutes)).toEqual([570]))
  })

  it('un orario doppio viene rifiutato', async () => {
    seedSchedule()
    renderPage()
    await addTime('08:00')
    expect(await screen.findByText('Questo orario è già presente')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Togli 8:00' })).toHaveLength(1)
  })

  it('il riepilogo confronta la quantità con l\'obiettivo', async () => {
    seedSchedule([480, 570, 600])
    renderPage()
    await openEditor()
    const section = (await screen.findByLabelText('Nome del programma')).closest('form')!
    expect(within(section).getByText(/3 promemoria × 200 ml = 0,6 L su 3 L/)).toBeInTheDocument()
  })

  it('i giorni si scelgono con i pulsanti', async () => {
    seedSchedule()
    renderPage()
    await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: 'Sab' }))
    await save()
    await waitFor(() => expect([...(fake.tables.schedules[0].weekdays as number[])].sort()).toEqual([1, 2, 6]))
  })

  it('un programma senza giorni non si salva', async () => {
    seedSchedule()
    renderPage()
    await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: 'Lun' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mar' }))
    await save()
    expect(await screen.findByText('Scegli almeno un giorno')).toBeInTheDocument()
    expect(fake.tables.schedules[0].weekdays).toEqual([1, 2])
  })

  it('un programma si disattiva dal riepilogo, senza aprirlo', async () => {
    seedSchedule()
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Lavoro attivo' }))
    await waitFor(() => expect(fake.tables.schedules[0].enabled).toBe(false))
    expect(fake.tables.schedule_times.map((t) => t.id).sort()).toEqual(['t0', 't1'])
  })

  it('se la disattivazione fallisce lo dice', async () => {
    seedSchedule()
    fake.failures.update = 'Failed to fetch'
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Lavoro attivo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/non è stato possibile/i)
  })

  it('un programma si può eliminare', async () => {
    seedSchedule()
    renderPage()
    await openEditor()
    await userEvent.click(await screen.findByRole('button', { name: 'Elimina programma' }))
    await waitFor(() => expect(fake.tables.schedules).toHaveLength(0))
  })

  it('il riepilogo dice giorni, quantità e fascia oraria, senza mostrare ogni orario', async () => {
    seedSchedule()
    renderPage()
    expect(await screen.findByText('Lun, Mar · 2 promemoria · 8:00-9:30')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Togli 8:00' })).not.toBeInTheDocument()
  })

  it('l\'editor si può chiudere senza salvare', async () => {
    seedSchedule()
    renderPage()
    await openEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByLabelText('Nome del programma')).not.toBeInTheDocument()
  })
})

describe('programma a intervalli', () => {
  const create = () => userEvent.click(screen.getByRole('button', { name: 'Crea promemoria' }))
  const every = (label: string) => userEvent.click(screen.getByRole('button', { name: label }))

  it('al primo accesso propone già ogni ora dalle 8 alle 22, ogni giorno', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    expect(screen.getByRole('button', { name: '1 ora' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Dalle')).toHaveValue('08:00')
    expect(screen.getByLabelText('Alle')).toHaveValue('22:00')
    expect(screen.getByText(/15 promemoria × 200 ml = 3 L su 3 L/)).toBeInTheDocument()
  })

  it('con un tocco crea il programma completo', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    await every('30 min')
    expect(screen.getByText(/29 promemoria/)).toBeInTheDocument()
    await create()
    await waitFor(() => expect(fake.tables.schedule_times).toHaveLength(29))
    expect(fake.tables.schedules[0]).toMatchObject({ user_id: 'u1', name: 'Ogni 30 min', weekdays: [1, 2, 3, 4, 5, 6, 7], enabled: true })
    const minutes = fake.tables.schedule_times.map((t) => t.minutes as number).sort((a, b) => a - b)
    expect([minutes[0], minutes[1], minutes.at(-1)]).toEqual([480, 510, 1320])
    expect(await screen.findByText('Ogni giorno · 29 promemoria · 8:00-22:00')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Programma salvato')
  })

  it('cambiare fascia oraria aggiorna il conteggio', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Dalle'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('Alle'), { target: { value: '12:00' } })
    expect(screen.getByText(/4 promemoria/)).toBeInTheDocument()
  })

  it('accetta un intervallo a scelta', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    await every('Altro')
    await userEvent.clear(screen.getByLabelText('Minuti'))
    await userEvent.type(screen.getByLabelText('Minuti'), '45')
    await create()
    await waitFor(() => expect(fake.tables.schedules).toHaveLength(1))
    expect(fake.tables.schedules[0].name).toBe('Ogni 45 min')
  })

  it('rifiuta un intervallo troppo fitto senza salvare', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    await every('Altro')
    await userEvent.clear(screen.getByLabelText('Minuti'))
    await userEvent.type(screen.getByLabelText('Minuti'), '5')
    await create()
    expect(await screen.findByRole('alert')).toHaveTextContent('tra 15 e 720')
    expect(fake.tables.schedules ?? []).toHaveLength(0)
  })

  it('rifiuta una fine prima dell\'inizio', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Alle'), { target: { value: '07:00' } })
    await create()
    expect(await screen.findByRole('alert')).toHaveTextContent('dopo quella di inizio')
    expect(fake.tables.schedules ?? []).toHaveLength(0)
  })

  it('rifiuta un programma senza giorni', async () => {
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    for (const day of ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']) await every(day)
    await create()
    expect(await screen.findByRole('alert')).toHaveTextContent('Scegli almeno un giorno')
  })

  it('se il salvataggio fallisce lo dice', async () => {
    fake.failures.insert = 'Failed to fetch'
    renderPage()
    await screen.findByRole('group', { name: 'Ogni quanto' })
    await create()
    expect(await screen.findByRole('alert')).toHaveTextContent(/controlla la connessione/i)
  })

  it('con un altro programma attivo propone di spegnerlo, per evitare notifiche doppie', async () => {
    seedSchedule()
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuovo programma' }))
    expect(screen.getByRole('checkbox', { name: /disattiva gli altri/i })).toBeChecked()
    await create()
    await waitFor(() => expect(fake.tables.schedules).toHaveLength(2))
    await waitFor(() => expect(fake.tables.schedules.find((s) => s.id === 's1')?.enabled).toBe(false))
  })

  it('si può scegliere di tenere anche l\'altro programma', async () => {
    seedSchedule()
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuovo programma' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /disattiva gli altri/i }))
    await create()
    await waitFor(() => expect(fake.tables.schedules).toHaveLength(2))
    expect(fake.tables.schedules.find((s) => s.id === 's1')?.enabled).toBe(true)
  })

  it('non propone di spegnere programmi di altri giorni', async () => {
    seedSchedule()
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuovo programma' }))
    await every('Lun')
    await every('Mar')
    expect(screen.queryByRole('checkbox', { name: /disattiva gli altri/i })).not.toBeInTheDocument()
  })

  it('si possono scegliere gli orari a mano', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Preferisco scegliere gli orari a mano' }))
    expect(screen.getByLabelText('Nome del programma')).toHaveValue('')
    await userEvent.type(screen.getByLabelText('Nome del programma'), 'Mio')
    fireEvent.change(screen.getByLabelText('Nuovo orario'), { target: { value: '10:15' } })
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi orario' }))
    await save()
    await waitFor(() => expect(fake.tables.schedule_times.map((t) => t.minutes)).toEqual([615]))
  })

  it('un programma a mano senza orari non si salva', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Preferisco scegliere gli orari a mano' }))
    await userEvent.type(screen.getByLabelText('Nome del programma'), 'Mio')
    await save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Aggiungi almeno un orario')
  })

  it('nell\'editor si riempiono gli orari a intervalli e poi si ritoccano', async () => {
    seedSchedule()
    renderPage()
    await openEditor()
    await userEvent.click(screen.getByText('Riempi a intervalli'))
    fireEvent.change(screen.getByLabelText('Dalle'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText('Alle'), { target: { value: '10:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Usa questi orari' }))
    expect(screen.getByRole('button', { name: 'Togli 9:00' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Togli 9:00' }))
    await save()
    await waitFor(() => expect(fake.tables.schedule_times.map((t) => t.minutes as number).sort((a, b) => a - b)).toEqual([480, 600]))
    expect(fake.tables.schedule_times.find((t) => t.minutes === 480)?.id).toBe('t0')
  })

  it('ricorda di attivare le notifiche se non sono attive', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Attiva le notifiche' })).toHaveAttribute('href', '/notifiche')
  })
})
