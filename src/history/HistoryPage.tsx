import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { DrinkTypeSelect, hydrationOf, parseAmount, useDrinkOptions } from '../drinks/drinkOptions'
import { type GoalChange } from '../domain/goals'
import { drinkLabel, formatAmount, formatVolume } from '../domain/hydration'
import { localParts } from '../domain/time'
import { weekStart } from '../leaderboard/weekStart'
import { supabase } from '../lib/supabase'
import { achievements, challenges, computeStats, dayResults, type DayTotal } from './stats'

interface Entry {
  client_id: string
  amount_ml: number
  drink_type?: string
  drunk_at: string
}

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

export function HistoryPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const units = profile?.units
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = localParts(new Date(), tz).date
  const { custom } = useDrinkOptions(userId)

  const [totals, setTotals] = useState<DayTotal[] | null>(null)
  const [goals, setGoals] = useState<GoalChange[]>([])
  const [range, setRange] = useState(7)
  const [selected, setSelected] = useState(today)
  const [entries, setEntries] = useState<Entry[]>([])
  const [failed, setFailed] = useState(false)
  const [type, setType] = useState('water')
  const [amount, setAmount] = useState(String(profile?.drink_ml ?? 200))
  const [formError, setFormError] = useState<string | null>(null)

  const loadTotals = useCallback(async () => {
    const { data, error } = await supabase.rpc('daily_totals')
    if (error) return setFailed(true)
    setFailed(false)
    setTotals((data ?? []) as DayTotal[])
  }, [])

  const loadEntries = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('drinks').select('client_id, amount_ml, drink_type, drunk_at').eq('user_id', userId).eq('local_date', selected)
    setEntries(((data ?? []) as Entry[]).sort((a, b) => a.drunk_at.localeCompare(b.drunk_at)))
  }, [userId, selected])

  useEffect(() => {
    void loadTotals()
  }, [loadTotals])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  useEffect(() => {
    if (!userId) return
    Promise.resolve(supabase.from('goal_changes').select('effective_from, goal_ml').eq('user_id', userId)).then(({ data }) => {
      if (data) setGoals((data as { effective_from: string; goal_ml: number }[]).map((r) => ({ effectiveFrom: r.effective_from, goalMl: r.goal_ml })))
    })
  }, [userId])

  async function remove(clientId: string) {
    if (!userId) return
    await supabase.from('drinks').delete().eq('user_id', userId).eq('client_id', clientId)
    await Promise.all([loadEntries(), loadTotals()])
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!userId) return
    const ml = parseAmount(amount)
    if (ml === null) return setFormError('La quantità deve essere tra 1 e 2000 ml')
    setFormError(null)
    const { error } = await supabase.from('drinks').insert({
      user_id: userId,
      client_id: crypto.randomUUID(),
      amount_ml: ml,
      drink_type: type,
      hydration_pct: hydrationOf(type, custom),
      drunk_at: selected === today ? new Date().toISOString() : `${selected}T12:00:00Z`,
      local_date: selected,
    })
    if (error) return setFormError('Salvataggio non riuscito. Controlla la connessione e riprova')
    await Promise.all([loadEntries(), loadTotals()])
  }

  if (failed) {
    return (
      <main className="page">
        <h1>Storico</h1>
        <p role="alert" className="error">Storico non disponibile. Controlla la connessione.</p>
      </main>
    )
  }
  if (!totals) return <p className="center-note">Caricamento…</p>

  const days = dayResults(totals, goals, today, range)
  const stats = computeStats(totals, goals, today)
  const scale = Math.max(...days.map((d) => Math.max(d.totalMl, d.goalMl)), 1)
  const goalNow = days.at(-1)?.goalMl ?? 0
  const pick = days.find((d) => d.day === selected)

  return (
    <main className="page">
      <h1>Storico</h1>

      <div className="choices" role="group" aria-label="Periodo">
        {[7, 30].map((n) => (
          <button key={n} className="choice" aria-pressed={range === n} onClick={() => setRange(n)}>{n} giorni</button>
        ))}
      </div>

      <section className="section">
        <div className="chart" style={{ gap: range > 7 ? 2 : 6 }} role="group" aria-label="Litri per giorno">
          <span className="chart-goal" style={{ bottom: `${(goalNow / scale) * 100}%` }}>
            <span>Obiettivo {formatVolume(goalNow, units)}</span>
          </span>
          {days.map((d) => (
            <button
              key={d.day}
              data-day={d.day}
              className="chart-col"
              aria-pressed={d.day === selected}
              aria-label={`${shortDay(d.day)}: ${formatVolume(d.totalMl, units)} su ${formatVolume(d.goalMl, units)}`}
              title={`${shortDay(d.day)}: ${formatVolume(d.totalMl, units)}`}
              onClick={() => setSelected(d.day)}
            >
              <span className="chart-bar" style={{ height: `${(d.totalMl / scale) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="chart-axis">
          <span>{shortDay(days[0].day)}</span>
          <span>Oggi</span>
        </div>
        <details>
          <summary>Vedi come tabella</summary>
          <table className="data-table">
            <thead>
              <tr><th>Giorno</th><th>Bevuto</th><th>Obiettivo</th></tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day}>
                  <td>{shortDay(d.day)}</td>
                  <td>{formatVolume(d.totalMl, units)}</td>
                  <td>{d.met ? 'Raggiunto' : formatVolume(d.goalMl, units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="section">
        <h2>{selected === today ? 'Oggi' : shortDay(selected)}{pick && `: ${formatVolume(pick.totalMl, units)}`}</h2>
        {entries.length === 0 && <p className="hint">Nessuna bevuta segnata in questo giorno.</p>}
        <ul className="list">
          {entries.map((entry) => (
            <li key={entry.client_id}>
              <span className="grow">{drinkLabel(entry.drink_type ?? 'water')} · {formatAmount(entry.amount_ml, units)}</span>
              <button
                className="ghost"
                aria-label={`Togli ${drinkLabel(entry.drink_type ?? 'water')}, ${entry.amount_ml} ml`}
                onClick={() => void remove(entry.client_id)}
              >
                Togli
              </button>
            </li>
          ))}
        </ul>
        <form className="stack" onSubmit={add} noValidate>
          <DrinkTypeSelect value={type} onChange={setType} custom={custom} />
          <label>
            Quantità (ml)
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          {formError && <p role="alert" className="error">{formError}</p>}
          <button className="secondary">Aggiungi a questo giorno</button>
        </form>
      </section>

      <section className="section">
        <h2>Statistiche</h2>
        <dl className="stat-grid">
          <div><dt>Obiettivo raggiunto</dt><dd>{stats.completionRate}%</dd></div>
          <div><dt>Serie in corso</dt><dd>{stats.currentStreak} gg</dd></div>
          <div><dt>Serie migliore</dt><dd>{stats.bestStreak} gg</dd></div>
          <div><dt>Media al giorno</dt><dd>{formatVolume(stats.averageMl, units)}</dd></div>
          <div><dt>Totale bevuto</dt><dd>{formatVolume(stats.totalMl, units)}</dd></div>
          <div><dt>Giorni sotto metà</dt><dd>{stats.lowDays}</dd></div>
        </dl>
      </section>

      <section className="section">
        <h2>Sfide della settimana</h2>
        <ul className="list">
          {challenges(totals, goals, weekStart(new Date(), tz), today).map((c) => (
            <li key={c.id}>
              <span className="grow">{c.label}</span>
              <span className="num">{c.done ? 'Fatta ✓' : `${c.progress}/${c.target}`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Traguardi</h2>
        <ul className="list">
          {achievements(stats).map((a) => (
            <li key={a.id} className={a.earned ? undefined : 'locked'}>
              <span aria-hidden="true">{a.earned ? '✓' : '○'}</span>
              <span className="grow">
                <strong>{a.label}</strong>
                <span className="hint schedule-summary">{a.earned ? a.description : `Da raggiungere: ${a.description.toLowerCase()}`}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
