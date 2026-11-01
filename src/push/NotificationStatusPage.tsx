import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { formatTime } from '../domain/format'
import { localParts } from '../domain/time'
import { supabase } from '../lib/supabase'
import { InstallGuide } from './InstallGuide'
import { hasDeviceSubscription, pushSupportState, sendTestPush, subscribePush, type PushState } from './subscribe'

interface LogRow {
  id?: string
  scheduled_at: string
  sent_at: string | null
  received_at: string | null
  status: string
}

const ms = (a: string, b: string) => Date.parse(a) - Date.parse(b)
const SERVICE_STALE_MS = 5 * 60_000

function describe(row: LogRow): string {
  switch (row.status) {
    case 'sent': {
      const late = Math.round(ms(row.sent_at ?? row.scheduled_at, row.scheduled_at) / 60_000)
      return late > 0 ? `Inviata con ${late} min di ritardo` : 'Inviata in orario'
    }
    case 'missed':
      return 'Non inviata: il servizio era fermo'
    case 'no-device':
      return 'Non inviata: nessun telefono registrato'
    case 'failed':
      return 'Invio non riuscito'
    default:
      return 'In corso'
  }
}

function describeArrival(row: LogRow): string | null {
  if (!row.received_at || !row.sent_at) return null
  const seconds = Math.max(0, Math.round(ms(row.received_at, row.sent_at) / 1000))
  return seconds < 60 ? `Arrivata dopo ${seconds} s` : `Arrivata dopo ${Math.round(seconds / 60)} min`
}

export function NotificationStatusPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id ?? null
  const tz = profile?.tz ?? new Intl.DateTimeFormat().resolvedOptions().timeZone
  const [state, setState] = useState<PushState>(() => pushSupportState())
  const [registered, setRegistered] = useState<boolean | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [serviceStopped, setServiceStopped] = useState(false)
  const [reactivated, setReactivated] = useState(false)

  const loadLog = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('push_log').select('*').eq('user_id', userId).order('scheduled_at', { ascending: false }).limit(30)
    if (data) setLog(data as LogRow[])
  }, [userId])

  useEffect(() => {
    void loadLog()
    Promise.resolve(supabase.from('service_status').select('last_run_at').maybeSingle()).then(({ data, error }) => {
      if (error || !data) return
      const last = (data as { last_run_at: string | null }).last_run_at
      setServiceStopped(!last || Date.now() - Date.parse(last) > SERVICE_STALE_MS)
    })
    void hasDeviceSubscription()
      .catch(() => false)
      .then(setRegistered)
  }, [loadLog])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      await subscribePush()
      setRegistered(true)
      setReactivated(true)
      setMessage('Notifiche attive su questo telefono.')
    } catch {
      setError('Non è stato possibile attivare le notifiche. Controlla la connessione e riprova.')
    }
    setState(pushSupportState())
    setBusy(false)
  }

  async function test() {
    setBusy(true)
    setError(null)
    setMessage(null)
    const result = await sendTestPush()
    if (result === 'no-device') {
      setRegistered(false)
      setReactivated(false)
    } else if (result === 'failed') {
      setError('La notifica di prova non è partita. Riprova tra poco.')
    } else {
      setMessage('Notifica inviata: chiudi l\'app e controlla che arrivi.')
    }
    await loadLog()
    setBusy(false)
  }

  // Il telefono può credersi iscritto dopo che il servizio push ha scartato l'iscrizione.
  const discarded = log[0]?.status === 'no-device' && !reactivated
  const unregistered = registered === false || (registered === true && discarded)
  const ready = state === 'granted' && registered === true && !discarded
  const canEnable = state === 'prompt' || (state === 'granted' && unregistered)

  return (
    <main className="page">
      <div className="row">
        <h1>Stato notifiche</h1>
        <Link to="/profilo">Profilo</Link>
      </div>

      {state === 'needs-install' && <InstallGuide />}
      {state === 'unsupported' && (
        <p>Questo browser non può ricevere notifiche. Su iPhone serve iOS 16.4 o successivo e l'app installata da Safari.</p>
      )}
      {state === 'denied' && (
        <section className="section">
          <p className="error">Le notifiche sono bloccate.</p>
          <p>Riattivale da Impostazioni, Notifiche, Bere. Poi riapri l'app.</p>
        </section>
      )}
      {serviceStopped && <p className="error">Il servizio di invio è fermo: per ora i promemoria non partono.</p>}
      {state === 'granted' && unregistered && <p className="error">Questo telefono non è registrato: non riceverà i promemoria.</p>}
      {ready && <p>Le notifiche sono attive su questo telefono.</p>}

      {canEnable && <button className="primary" disabled={busy} onClick={() => void enable()}>Attiva le notifiche</button>}
      {ready && <button className="secondary" disabled={busy} onClick={() => void test()}>Invia notifica di prova</button>}

      {error && <p role="alert" className="error">{error}</p>}
      {message && <p role="status" className="hint">{message}</p>}

      <p className="hint">Full Immersion e Risparmio energetico possono ritardare o nascondere gli avvisi anche quando l'invio è riuscito.</p>

      <section className="section">
        <h2>Ultimi invii</h2>
        {log.length === 0 && <p className="hint">Nessun invio ancora. Compariranno qui con il loro eventuale ritardo.</p>}
        <ul className="list">
          {log.map((row, index) => {
            const parts = localParts(new Date(row.scheduled_at), tz)
            const arrival = describeArrival(row)
            return (
              <li key={row.id ?? index}>
                <span className="num">{parts.date.slice(8, 10)}/{parts.date.slice(5, 7)} {formatTime(parts.minutes)}</span>
                <span className="grow">
                  {describe(row)}
                  {arrival && <span className="hint"> · {arrival}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
