import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { formatTime } from '../domain/format'
import { pushSupportState } from '../push/subscribe'
import { EmptyState } from '../mascot/EmptyState'
import { IntervalCreator } from './IntervalCreator'
import { LearnedTimes } from './LearnedTimes'
import { ScheduleCard } from './ScheduleCard'
import { ScheduleEditor } from './ScheduleEditor'
import { deleteSchedule, hasDuplicateReminders, listSchedules, saveSchedule, type Schedule, type ScheduleDraft } from './schedulesApi'
import { useGoalMl } from './useGoalMl'

const toDraft = (s: Schedule): ScheduleDraft => ({
  id: s.id,
  name: s.name,
  weekdays: s.weekdays,
  enabled: s.enabled,
  minutes: s.times.map((t) => t.minutes).sort((a, b) => a - b),
})

type Adding = 'none' | 'interval' | 'manual'

export function SchedulesPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const [schedules, setSchedules] = useState<Schedule[] | null>(null)
  const [adding, setAdding] = useState<Adding>('none')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!userId) return
    try {
      setSchedules(await listSchedules(userId))
      setError(null)
    } catch {
      setError('Non riesco a caricare i programmi. Controlla la connessione.')
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const goalMl = useGoalMl(userId, tz)

  function finished() {
    setAdding('none')
    setEditingId(null)
    setMessage('Programma salvato.')
  }

  async function save(draft: ScheduleDraft) {
    if (!userId) return
    await saveSchedule(userId, draft)
    await reload()
    finished()
  }

  async function createFromInterval(draft: ScheduleDraft, disableOthers: boolean) {
    if (!userId) return
    await saveSchedule(userId, draft)
    let othersFailed = false
    if (disableOthers) {
      const others = (schedules ?? []).filter((s) => s.enabled && s.weekdays.some((d) => draft.weekdays.includes(d)))
      try {
        await Promise.all(others.map((s) => saveSchedule(userId, { ...toDraft(s), enabled: false })))
      } catch {
        // Il nuovo programma esiste già: ripetere la creazione lo duplicherebbe.
        othersFailed = true
      }
    }
    await reload()
    finished()
    if (othersFailed) setError('Programma creato, ma non è stato possibile disattivare gli altri: fallo qui sotto per evitare notifiche doppie.')
  }

  async function toggle(schedule: Schedule, enabled: boolean) {
    if (!userId) return
    setMessage(null)
    try {
      await saveSchedule(userId, { ...toDraft(schedule), enabled })
      await reload()
    } catch {
      setError('Non è stato possibile aggiornare il programma. Controlla la connessione e riprova.')
    }
  }

  async function addLearnedTime(schedule: Schedule, minutes: number) {
    if (!userId) return
    setMessage(null)
    const draft = toDraft(schedule)
    await saveSchedule(userId, { ...draft, minutes: [...draft.minutes, minutes].sort((a, b) => a - b) })
    await reload()
    setMessage(`Aggiunto il promemoria delle ${formatTime(minutes)} a «${schedule.name}».`)
  }

  async function remove(id: string) {
    try {
      await deleteSchedule(id)
      setEditingId(null)
      await reload()
    } catch {
      setError('Non è stato possibile eliminare il programma. Riprova.')
    }
  }

  const drinkMl = profile?.drink_ml ?? 200
  const empty = schedules?.length === 0
  const showCreator = schedules && (adding === 'interval' || (empty && adding === 'none'))
  const activeWeekdays = (schedules ?? []).filter((s) => s.enabled).map((s) => s.weekdays)

  return (
    <main className="page">
      <div className="row">
        <h1>Promemoria</h1>
        <Link to="/avvisi">Avvisi</Link>
      </div>

      {error && <p role="alert" className="error">{error}</p>}
      {message && <p role="status" className="hint">{message}</p>}
      {!schedules && !error && <p className="center-note">Caricamento…</p>}
      {empty && <EmptyState mood="sleep" size={56} compact title="Nessun promemoria, per ora." />}
      {pushSupportState() !== 'granted' && <Link to="/notifiche">Attiva le notifiche</Link>}

      {schedules && hasDuplicateReminders(schedules) && (
        <p className="error">Stai ricevendo notifiche doppie: due programmi attivi hanno gli stessi orari. Spegni o elimina quello che non ti serve.</p>
      )}

      {schedules && schedules.length > 0 && (
        <ul className="list" aria-label="I tuoi programmi">
          {schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onToggle={(enabled) => void toggle(s, enabled)}
              onEdit={() => {
                setMessage(null)
                setAdding('none')
                setEditingId(s.id)
              }}
            />
          ))}
        </ul>
      )}

      {userId && schedules && adding === 'none' && !editingId && (
        <LearnedTimes
          userId={userId}
          tz={tz}
          schedules={schedules}
          hours={profile?.active_split ? { start: profile.active_start_min ?? 480, end: profile.active_end_min ?? 1080 } : undefined}
          onAdd={addLearnedTime}
        />
      )}

      {schedules?.filter((s) => s.id === editingId).map((s) => (
        <ScheduleEditor
          key={s.id}
          initial={toDraft(s)}
          drinkMl={drinkMl}
          goalMl={goalMl}
          onSave={save}
          onDelete={() => remove(s.id)}
          onClose={() => setEditingId(null)}
        />
      ))}

      {showCreator && (
        <IntervalCreator
          activeWeekdays={activeWeekdays}
          drinkMl={drinkMl}
          goalMl={goalMl}
          onCreate={createFromInterval}
          onManual={() => setAdding('manual')}
          onCancel={empty ? undefined : () => setAdding('none')}
        />
      )}

      {adding === 'manual' && (
        <ScheduleEditor
          initial={{ name: '', weekdays: [1, 2, 3, 4, 5, 6, 7], enabled: true, minutes: [] }}
          drinkMl={drinkMl}
          goalMl={goalMl}
          onSave={save}
          onClose={() => setAdding('none')}
        />
      )}

      {schedules && !empty && adding === 'none' && !editingId && (
        <button
          className="secondary"
          onClick={() => {
            setMessage(null)
            setAdding('interval')
          }}
        >
          Nuovo programma
        </button>
      )}
    </main>
  )
}
