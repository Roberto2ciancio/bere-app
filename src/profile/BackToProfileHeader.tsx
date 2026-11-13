import { Link } from 'react-router-dom'
import { NEW_PROFILE } from './newProfile'
import { profileLink, type ProfileSection } from './profileLinks'

/** Titolo della pagina col link per tornare: sopra il titolo nel Profilo nuovo, accanto come sempre altrimenti. */
export function BackToProfileHeader({ section, title }: { section: ProfileSection; title: string }) {
  const { to, label } = profileLink(section)
  if (!NEW_PROFILE) {
    return (
      <div className="row">
        <h1>{title}</h1>
        <Link to={to}>{label}</Link>
      </div>
    )
  }
  return (
    <header className="profile-section-head">
      <Link className="back-link" to={to}>{label}</Link>
      <h1>{title}</h1>
    </header>
  )
}
