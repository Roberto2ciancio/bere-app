import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glu } from '../mascot/Glu'
import { useGluVariant } from '../mascot/useGluVariant'
import { readSeen, releasesToShow, startedWithData, writeSeen } from './whatsNew'

/** Al primo avvio dopo un aggiornamento: la versione e cosa è cambiato. */
export function WhatsNew() {
  const variant = useGluVariant()
  const [releases] = useState(() => releasesToShow(readSeen(), __APP_VERSION__, startedWithData()))
  const [open, setOpen] = useState(releases.length > 0)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (releases.length === 0) writeSeen(__APP_VERSION__)
    else button.current?.focus()
  }, [releases])

  if (!open) return null

  function close() {
    writeSeen(__APP_VERSION__)
    setOpen(false)
  }

  return (
    <div className="sheet-overlay whats-new-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet whats-new" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
        <div className="whats-new-glu"><Glu mood="hello" fill={0.6} size={96} variant={variant} /></div>
        <h2 id="whats-new-title">Novità della versione {__APP_VERSION__}</h2>
        {releases.map((release, index) => (
          <section key={release.version}>
            {releases.length > 1 && <h3>{index === 0 ? `Versione ${release.version}` : `E nella ${release.version}`}</h3>}
            <ul className="changelog">
              {release.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </section>
        ))}
        <button ref={button} className="primary" onClick={close}>Ho capito</button>
        <Link className="whats-new-all" to="/novita" onClick={close}>Tutte le novità nella Newsletter</Link>
      </div>
    </div>
  )
}
