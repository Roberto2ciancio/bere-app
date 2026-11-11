import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { DrinkTypeSelect, hydrationOf, parseAmount, useDrinkOptions } from '../drinks/drinkOptions'
import { type GoalChange } from '../domain/goals'
import { drinkLabel, formatAmount, formatVolume } from '../domain/hydration'
import { formatTime } from '../domain/format'
import { addDays, localParts, weekdayOf } from '../domain/time'
import { useGoalBoosts } from '../goal/useGoalBoosts'
import { LevelCard } from '../levels/LevelCard'
import { useLevels } from '../levels/useLevels'
import { weekStart } from '../leaderboard/weekStart'
import { pausedDays } from '../pause/pauses'
import { usePauses } from '../pause/usePauses'
import { supabase } from '../lib/supabase'
import { GluCorner } from '../mascot/GluCorner'
import { CORNER_PHRASES, historyStreakPhrase } from '../mascot/phrases'
import { streakAccessory } from '../mascot/reactions'
import { achievements, challenges, computeStats, dayResults, jollyThisWeek, type CaffeineByDay, type DayTotal } from './stats'
import { CountUp } from '../ui/motion/CountUp'
import { Stagger } from '../ui/motion/Stagger'

interface Entry {
  client_id: string
  amount_ml: number
  drink_type?: string
  drunk_at: string
}

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const weekdayLetter = (day: string) => LETTERS[weekdayOf(day) - 1]
const longDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const timeOf = (iso: string, tz: string) => formatTime(localParts(new Date(iso), tz).minutes)

export function HistoryPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const units = profile?.units
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = localParts(new Date(), tz).date
  const { custom } = useDrinkOptions(userId)
  // Senza meteo: lo legge la schermata Oggi. Qui servono solo gli aumenti già salvati.
  const { byDay: boosts } = useGoalBoosts(userId, today)
  const { periods: pauses } = usePauses(userId, today)
  const levels = useLevels()

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

  // Caffeina di questa settimana, per la sfida «sotto i 200 mg».
  const thisWeek = weekStart(new Date(), tz)
  const [caffeine, setCaffeine] = useState<CaffeineByDay | undefined>(undefined)
  useEffect(() => {
    if (!userId) return
    Promise.resolve(supabase.from('caffeine_intakes').select('local_date, mg').eq('user_id', userId).gte('local_date', thisWeek)).then(({ data, error }) => {
      if (error || !data) return
      const byDay: CaffeineByDay = new Map()
      for (const row of data as { local_date: string; mg: number }[]) byDay.set(row.local_date, (byDay.get(row.local_date) ?? 0) + row.mg)
      setCaffeine(byDay)
    })
  }, [userId, thisWeek])

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

  const days = dayResults(totals, goals, today, range, boosts)
  const stats = computeStats(totals, goals, today, boosts, pausedDays(pauses, today))
  const scale = Math.max(...days.map((d) => Math.max(d.totalMl, d.goalMl)), 1)
  const goalNow = days.at(-1)?.goalMl ?? 0
  const pick = days.find((d) => d.day === selected)
  const jollyDay = jollyThisWeek(stats.savedDays, today)

  const badges = achievements(stats)
  const earned = badges.filter((a) => a.earned)
  const locked = badges.filter((a) => !a.earned)
  const metDays = days.filter((d) => d.met).length
  const avgMl = Math.round(days.reduce((sum, d) => sum + d.totalMl, 0) / days.length)
  const todayDay = days.at(-1)
  const todayFill = todayDay && todayDay.goalMl > 0 ? todayDay.totalMl / todayDay.goalMl : undefined
  const pickPct = pick && pick.goalMl > 0 ? Math.min(100, Math.round((pick.totalMl / pick.goalMl) * 100)) : 0

  return (
    <Stagger as="main" className="page history">
      <header className="page-head">
        <h1>Storico</h1>
        <div className="segmented" role="group" aria-label="Periodo">
          {[7, 30].map((n) => (
            <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>{n} giorni</button>
          ))}
        </div>
      </header>

      {/* Sempre presente: il giorno vuoto qui sotto è solo una riga, così Glu resta uno solo. */}
      <GluCorner
        mood={stats.currentStreak > 0 ? (stats.currentStreak >= 7 ? 'goal' : 'almost') : 'idle'}
        text={stats.currentStreak > 0 ? historyStreakPhrase(stats.currentStreak) : CORNER_PHRASES.historyIdle}
        fill={todayFill}
        crown={streakAccessory(stats.currentStreak)}
      />

      <section className="card">
        <div className="history-summary">
          <div><span className="hint">Media</span><strong>{formatVolume(avgMl, units)}</strong></div>
          <div><span className="hint">A obiettivo</span><strong>{metDays}/{days.length} giorni</strong></div>
        </div>
        <div className="chart" style={{ gap: range > 7 ? 2 : 8 }} role="group" aria-label="Litri per giorno">
          <span className="chart-goal" style={{ bottom: `${(goalNow / scale) * 100}%` }}>
            <span>Obiettivo {formatVolume(goalNow, units)}</span>
          </span>
          {days.map((d) => (
            <button
              key={d.day}
              data-day={d.day}
              className={d.met ? 'chart-col met' : stats.savedDays.has(d.day) ? 'chart-col saved' : 'chart-col'}
              aria-pressed={d.day === selected}
              aria-label={`${shortDay(d.day)}: ${formatVolume(d.totalMl, units)} su ${formatVolume(d.goalMl, units)}${stats.savedDays.has(d.day) ? ', salvato dal salva-serie' : ''}`}
              title={`${shortDay(d.day)}: ${formatVolume(d.totalMl, units)}`}
              onClick={() => setSelected(d.day)}
            >
              <span className="chart-bar" style={{ height: `${(d.totalMl / scale) * 100}%` }} />
            </button>
          ))}
        </div>
        {range === 7 ? (
          <div className="chart-days" aria-hidden="true">
            {days.map((d) => <span key={d.day} className={d.day === selected ? 'on' : undefined}>{d.day === today ? 'Oggi' : weekdayLetter(d.day)}</span>)}
          </div>
        ) : (
          <div className="chart-axis">
            <span>{shortDay(days[0].day)}</span>
            <span>Oggi</span>
          </div>
        )}
        <p className="hint">Tocca una barra per vedere quel giorno.</p>
        <details className="fold">
          <summary>Vedi come tabella</summary>
          <div className="fold-body">
            <table className="data-table">
              <thead>
                <tr><th>Giorno</th><th>Bevuto</th><th>Obiettivo</th></tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day}>
                    <td>{shortDay(d.day)}</td>
                    <td>{formatVolume(d.totalMl, units)}</td>
                    <td>{d.met ? 'Raggiunto' : stats.savedDays.has(d.day) ? 'Salva-serie' : formatVolume(d.goalMl, units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="card">
        <div className="day-head">
          <h2>{selected === today ? 'Oggi' : longDay(selected)}</h2>
          {pick && <strong className="num">{formatVolume(pick.totalMl, units)} <span className="hint">su {formatVolume(pick.goalMl, units)}</span></strong>}
        </div>
        {pick && (
          <div className="progress" role="progressbar" aria-label="Obiettivo del giorno" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pickPct}>
            <span style={{ width: `${pickPct}%` }} />
          </div>
        )}
        {entries.length === 0 && <p className="hint">Nessuna bevuta segnata in questo giorno.</p>}
        {entries.length > 0 && (
          <ul className="entry-list">
            {entries.map((entry) => (
              <li key={entry.client_id}>
                <span className="entry-time num">{timeOf(entry.drunk_at, tz)}</span>
                <span className="grow">{drinkLabel(entry.drink_type ?? 'water')}</span>
                <span className="num">{formatAmount(entry.amount_ml, units)}</span>
                <button
                  className="entry-remove"
                  aria-label={`Togli ${drinkLabel(entry.drink_type ?? 'water')}, ${entry.amount_ml} ml`}
                  onClick={() => void remove(entry.client_id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <details className="fold">
          <summary>Aggiungi una bevuta a questo giorno</summary>
          <form className="stack fold-body" onSubmit={add} noValidate>
            <DrinkTypeSelect value={type} onChange={setType} custom={custom} />
            <label>
              Quantità (ml)
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            {formError && <p role="alert" className="error">{formError}</p>}
            <button className="secondary">Aggiungi a questo giorno</button>
          </form>
        </details>
      </section>

      <section className="card">
        <h2>Statistiche</h2>
        <dl className="stat-grid">
          <div><dt>Obiettivo raggiunto</dt><dd>{stats.completionRate}%</dd></div>
          <div><dt>Serie in corso</dt><dd><CountUp value={stats.currentStreak} format={(n) => `${n} gg`} /></dd></div>
          <div><dt>Serie migliore</dt><dd><CountUp value={stats.bestStreak} format={(n) => `${n} gg`} /></dd></div>
          <div><dt>Media al giorno</dt><dd>{formatVolume(stats.averageMl, units)}</dd></div>
          <div><dt>Totale bevuto</dt><dd>{formatVolume(stats.totalMl, units)}</dd></div>
          <div><dt>Giorni sotto metà</dt><dd>{stats.lowDays}</dd></div>
        </dl>
        <p className="hint jolly-note">
          {jollyDay
            ? `🛟 Salva-serie usato ${jollyDay === addDays(today, -1) ? 'ieri' : longDay(jollyDay)}: la serie è salva. Il prossimo arriva lunedì.`
            : '🛟 Salva-serie disponibile: se questa settimana manchi un giorno, la serie non si rompe.'}
        </p>
        <Link className="link-row" to="/storico/calendario">Calendario e statistiche del mese</Link>
      </section>

      {userId && levels?.has(userId) && <LevelCard points={levels.get(userId) ?? 0} />}

      <section className="card">
        <h2>Sfide della settimana</h2>
        <ul className="challenge-list">
          {challenges(totals, goals, thisWeek, today, caffeine, boosts).map((c) => (
            <li key={c.id} className={c.done ? 'done' : undefined}>
              <div className="board-line">
                <span>{c.label}</span>
                <span className="num">{c.done ? 'Fatta ✓' : `${c.progress}/${c.target}`}</span>
              </div>
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.round((c.progress / c.target) * 100))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="day-head">
          <h2>Traguardi</h2>
          <span className="hint num">{earned.length} di {badges.length}</span>
        </div>
        {earned.length === 0 && <p className="hint">Nessun traguardo ancora: il primo arriva con la prima bevuta.</p>}
        {earned.length > 0 && (
          <ul className="badge-list">
            {earned.map((a) => (
              <li key={a.id} className="earned">
                <span className="badge-icon" aria-hidden="true">✓</span>
                <span className="grow">
                  <strong>{a.label}</strong>
                  <span className="hint schedule-summary">{a.description}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {locked.length > 0 && (
          <details className="fold">
            <summary>Da raggiungere ({locked.length})</summary>
            <ul className="badge-list fold-body">
              {locked.map((a) => (
                <li key={a.id} className="locked">
                  <span className="badge-icon" aria-hidden="true">🔒</span>
                  <span className="grow">
                    <strong>{a.label}</strong>
                    <span className="hint schedule-summary">{a.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </Stagger>
  )
}
