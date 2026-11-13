import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CHANGELOG } from '../profile/changelog'
import { markNewsRead } from '../profile/whatsNew'

const longDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Newsletter: tutte le novità di Bere, versione per versione, dalla più recente. */
export function NewsPage() {
  useEffect(() => markNewsRead(), [])

  return (
    <main className="page news">
      <header className="news-head">
        <Link className="back-link" to="/profilo/aiuto">‹ Aiuto e suggerimenti</Link>
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
