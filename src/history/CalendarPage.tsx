import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { type GoalChange } from '../domain/goals'
import { formatVolume, type Units } from '../domain/hydration'
import { localParts } from '../domain/time'
import { useGoalBoosts } from '../goal/useGoalBoosts'
import { supabase } from '../lib/supabase'
import { pausedDays } from '../pause/pauses'
import { usePauses } from '../pause/usePauses'
import { addMonths, monthGrid, monthSummary, yearSummary, type CalendarDay, type DayLevel, type Inputs, type PeriodSummary } from './calendar'
import { computeStats, type DayTotal } from './stats'
import { Stagger } from '../ui/motion/Stagger'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const LEVEL_LABEL: Record<DayLevel, string> = {
  met: 'obiettivo raggiunto',
  saved: 'salvato dal salva-serie',
  paused: 'in pausa',
  half: 'almeno metà obiettivo',
  low: 'meno di metà obiettivo',
  none: 'niente segnato',
  before: 'prima di iniziare',
  future: '',
}
const LEGEND: DayLevel[] = ['met', 'half', 'low', 'saved', 'paused']

const monthName = (month: string, withYear = true) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
const longDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const days = (n: number) => (n === 1 ? '1 giorno' : `${n} giorni`)

function Summary({ summary, units }: { summary: PeriodSummary; units?: Units }) {
  return (
    <dl className="stat-grid">
      <div><dt>Obiettivo raggiunto</dt><dd>{summary.daysMet}/{summary.daysCounted} gg</dd></div>
      <div><dt>Totale bevuto</dt><dd>{formatVolume(summary.totalMl, units)}</dd></div>
      <div><dt>Media al giorno</dt><dd>{formatVolume(summary.averageMl, units)}</dd></div>
      <div><dt>Serie più lunga</dt><dd>{summary.bestRun} gg</dd></div>
      {summary.bestDay && (
        <div className="stat-wide"><dt>Giorno migliore</dt><dd>{formatVolume(summary.bestDay.totalMl, units)} <span className="hint">{longDay(summary.bestDay.day)}</span></dd></div>
      )}
    </dl>
  )
}

function Cell({ cell, today, units }: { cell: CalendarDay | null; today: string; units?: Units }) {
  if (!cell) return <span className="cal-cell empty" aria-hidden="true" />
  const label = cell.level === 'future'
    ? longDay(cell.day)
    : `${longDay(cell.day)}: ${formatVolume(cell.totalMl, units)} su ${formatVolume(cell.goalMl, units)}, ${LEVEL_LABEL[cell.level]}`
  return (
    <span role="img" className={`cal-cell ${cell.level}${cell.day === today ? ' today' : ''}`} aria-label={label} title={label}>
      {Number(cell.day.slice(8, 10))}
    </span>
  )
}

export function CalendarPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const units = profile?.units
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const today = localParts(new Date(), tz).date
  const { byDay: boosts } = useGoalBoosts(userId, today)
  const { periods: pauses } = usePauses(userId, today)

  const [view, setView] = useState<'month' | 'year'>('month')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [year, setYear] = useState(today.slice(0, 4))
  const [totals, setTotals] = useState<DayTotal[] | null>(null)
  const [goals, setGoals] = useState<GoalChange[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    Promise.resolve(supabase.rpc('daily_totals')).then(({ data, error }) => {
      if (error) return setFailed(true)
      setTotals((data ?? []) as DayTotal[])
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    Promise.resolve(supabase.from('goal_changes').select('effective_from, goal_ml').eq('user_id', userId)).then(({ data }) => {
      if (data) setGoals((data as { effective_from: string; goal_ml: number }[]).map((r) => ({ effectiveFrom: r.effective_from, goalMl: r.goal_ml })))
    })
  }, [userId])

  const head = (
    <header className="page-head">
      <h1>Calendario</h1>
      <div className="segmented" role="group" aria-label="Periodo">
        <button aria-pressed={view === 'month'} onClick={() => setView('month')}>Mese</button>
        <button aria-pressed={view === 'year'} onClick={() => setView('year')}>Anno</button>
      </div>
    </header>
  )
  if (failed) {
    return (
      <main className="page">
        {head}
        <p role="alert" className="error">Calendario non disponibile. Controlla la connessione.</p>
      </main>
    )
  }
  if (!totals) return <p className="center-note">Caricamento…</p>

  const paused = pausedDays(pauses, today)
  const inputs: Inputs = { totals, goals, today, boosts, paused, saved: computeStats(totals, goals, today, boosts, paused).savedDays }
  const firstMonth = totals[0]?.day.slice(0, 7) ?? today.slice(0, 7)
  const thisMonth = today.slice(0, 7)
  const thisYear = today.slice(0, 4)

  return (
    <Stagger as="main" className="page history calendar">
      {head}
      <Link className="back-link" to="/storico">‹ Storico</Link>

      {view === 'month' ? (
        <>
          <section className="card">
            <div className="cal-nav">
              <button className="cal-arrow" aria-label="Mese precedente" disabled={month <= firstMonth} onClick={() => setMonth(addMonths(month, -1))}>‹</button>
              <h2>{monthName(month)}</h2>
              <button className="cal-arrow" aria-label="Mese successivo" disabled={month >= thisMonth} onClick={() => setMonth(addMonths(month, 1))}>›</button>
            </div>
            <div className="cal-grid" role="group" aria-label={`Giorni di ${monthName(month)}`}>
              {WEEKDAYS.map((w, i) => <span key={i} className="cal-weekday" aria-hidden="true">{w}</span>)}
              {monthGrid(month, inputs).flat().map((cell, i) => <Cell key={cell?.day ?? `x${i}`} cell={cell} today={today} units={units} />)}
            </div>
            <ul className="cal-legend">
              {LEGEND.map((level) => <li key={level}><span className={`cal-dot ${level}`} aria-hidden="true" />{LEVEL_LABEL[level]}</li>)}
            </ul>
          </section>
          <section className="card">
            <h2>Il mese in numeri</h2>
            <Summary summary={monthSummary(month, inputs)} units={units} />
          </section>
        </>
      ) : (
        <YearView year={year} setYear={setYear} firstYear={firstMonth.slice(0, 4)} thisYear={thisYear} inputs={inputs} units={units} onMonth={(m) => {
          setMonth(m)
          setView('month')
        }} />
      )}

      <section className="card">
        <h2>Salva-serie</h2>
        <p className="hint">
          Ogni settimana, da lunedì a domenica, hai un salva-serie: il primo giorno in cui non raggiungi l'obiettivo la serie non si rompe.
          Il giorno salvato non allunga la serie. Dal secondo giorno mancato della settimana, la serie riparte da zero.
        </p>
      </section>
    </Stagger>
  )
}

function YearView({ year, setYear, firstYear, thisYear, inputs, units, onMonth }: {
  year: string
  setYear: (y: string) => void
  firstYear: string
  thisYear: string
  inputs: Inputs
  units?: Units
  onMonth: (month: string) => void
}) {
  const { total, months } = yearSummary(year, inputs)
  const shown = months.filter((m) => m.summary.daysCounted > 0)
  return (
    <>
      <section className="card">
        <div className="cal-nav">
          <button className="cal-arrow" aria-label="Anno precedente" disabled={year <= firstYear} onClick={() => setYear(String(Number(year) - 1))}>‹</button>
          <h2>{year}</h2>
          <button className="cal-arrow" aria-label="Anno successivo" disabled={year >= thisYear} onClick={() => setYear(String(Number(year) + 1))}>›</button>
        </div>
        <Summary summary={total} units={units} />
      </section>
      <section className="card">
        <h2>Mese per mese</h2>
        {shown.length === 0 && <p className="hint">Nessuna bevuta segnata in questo anno.</p>}
        <ul className="challenge-list">
          {shown.map(({ month, summary }) => (
            <li key={month}>
              <button className="year-month" onClick={() => onMonth(month)} aria-label={`${monthName(month)}: obiettivo raggiunto ${days(summary.daysMet)} su ${summary.daysCounted}, ${formatVolume(summary.totalMl, units)}`}>
                <span className="board-line">
                  <span className="year-month-name">{monthName(month, false)}</span>
                  <span className="num">{summary.daysMet}/{summary.daysCounted} gg · {formatVolume(summary.totalMl, units)}</span>
                </span>
                <span className="progress" aria-hidden="true">
                  <span style={{ width: `${Math.round((summary.daysMet / summary.daysCounted) * 100)}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
