import { useState } from 'react'
import { Link } from 'react-router-dom'
import { hasUnreadNews } from '../profile/whatsNew'

/** In alto a sinistra nella schermata Oggi: apre la Newsletter, con un pallino se ci sono novità da leggere. */
export function NewsIcon() {
  const [unread] = useState(() => hasUnreadNews())
  return (
    <Link className="news-icon" to="/novita" aria-label={unread ? 'Newsletter, novità da leggere' : 'Newsletter'}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h12v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" />
        <path d="M16 9h4v9a2 2 0 0 1-4 0" />
        <path d="M7.5 9h5M7.5 12.5h5M7.5 16h3" />
      </svg>
      {unread && <span className="news-dot" aria-hidden="true" />}
    </Link>
  )
}
