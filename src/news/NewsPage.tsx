import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CHANGELOG } from '../profile/changelog'
import { markNewsRead } from '../profile/whatsNew'

const longDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Newsletter: tutte le novità di Bere, versione per versione, dalla più recente. */
export function NewsPage() {
  useEffect(() => markNewsRead(), [])
  // Si arriva dall'icona di Oggi, dal popup delle novità o da Profilo › Aiuto: si torna da dove si è venuti.
  // Aperta direttamente (nessuna storia nell'app) si torna a Oggi.
  const navigate = useNavigate()
  const hasHistory = useLocation().key !== 'default'

  return (
    <main className="page news">
      <header className="news-head">
        {hasHistory ? (
          <Link
            className="back-link"
            to="/home"
            onClick={(event) => {
              event.preventDefault()
              navigate(-1)
            }}
          >
            ‹ Indietro
          </Link>
        ) : (
          <Link className="back-link" to="/home">‹ Oggi</Link>
        )}
        <h1>Newsletter</h1>
        <p className="hint">Tutte le novità di Bere, versione per versione. Stai usando la {__APP_VERSION__}.</p>
      </header>

      <ol className="news-list">
        {CHANGELOG.map((release) => (
          <li key={release.version}>
            <article className="card news-card" aria-labelledby={`v-${release.version}`}>
              <div className="news-meta">
                <span className="news-version num">v{release.version}</span>
                {release.version === __APP_VERSION__ && <span className="tag">Attuale</span>}
                <time className="hint" dateTime={release.date}>{longDate(release.date)}</time>
              </div>
              <h2 id={`v-${release.version}`}>{release.title}</h2>
              <ul className="changelog">
                {release.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </main>
  )
}
