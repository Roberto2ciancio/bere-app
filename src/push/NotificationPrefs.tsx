import { useProfile } from '../auth/ProfileProvider'

export function NotificationPrefs() {
  const { profile, updateProfile } = useProfile()
  if (!profile) return null
  return (
    <>
      <label className="row">
        Fermati quando raggiungo l'obiettivo
        <input type="checkbox" checked={profile.stop_at_goal ?? false} onChange={(e) => void updateProfile({ stop_at_goal: e.target.checked })} />
      </label>
      <label className="row">
        Gli amici possono spronarmi
        <input type="checkbox" checked={profile.allow_pokes ?? true} onChange={(e) => void updateProfile({ allow_pokes: e.target.checked })} />
      </label>
    </>
  )
}
