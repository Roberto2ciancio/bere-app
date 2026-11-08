import { useProfile } from '../auth/ProfileProvider'
import { formatAmount } from '../domain/hydration'

export function NotificationPrefs() {
  const { profile, updateProfile } = useProfile()
  if (!profile) return null
  const [small, large] = [200, 500].map((ml) => `«Bevuto ${formatAmount(ml, profile.units)}»`)
  return (
    <>
      <label className="row">
        Nel promemoria {small} e {large}
        <input type="checkbox" checked={profile.push_amounts ?? false} onChange={(e) => void updateProfile({ push_amounts: e.target.checked })} />
      </label>
      {profile.push_amounts && (
        <p className="hint">Su Android i pulsanti sono al massimo due: le quantità prendono il posto di «Bevuto ✓» e «Tra 15 min».</p>
      )}
      <label className="row">
        Fermati quando raggiungo l'obiettivo
        <input type="checkbox" checked={profile.stop_at_goal ?? false} onChange={(e) => void updateProfile({ stop_at_goal: e.target.checked })} />
      </label>
      <label className="row">
        Gli amici possono spronarmi
        <input type="checkbox" checked={profile.allow_pokes ?? true} onChange={(e) => void updateProfile({ allow_pokes: e.target.checked })} />
      </label>
      <label className="row">
        Avvisa gli amici quando raggiungo l'obiettivo
        <input type="checkbox" checked={profile.share_goal ?? true} onChange={(e) => void updateProfile({ share_goal: e.target.checked })} />
      </label>
      <label className="row">
        Avvisami quando un amico raggiunge l'obiettivo
        <input type="checkbox" checked={profile.friend_goal_alerts ?? true} onChange={(e) => void updateProfile({ friend_goal_alerts: e.target.checked })} />
      </label>
      <label className="row">
        Ricordami di bere se non apro l'app da un giorno
        <input type="checkbox" checked={profile.nudge_inactive ?? true} onChange={(e) => void updateProfile({ nudge_inactive: e.target.checked })} />
      </label>
      <label className="row">
        Riepilogo serale se oggi mi è mancato parecchio
        <input type="checkbox" checked={profile.evening_summary ?? true} onChange={(e) => void updateProfile({ evening_summary: e.target.checked })} />
      </label>
      <label className="row">
        Resoconto della settimana il lunedì
        <input type="checkbox" checked={profile.weekly_report ?? true} onChange={(e) => void updateProfile({ weekly_report: e.target.checked })} />
      </label>
    </>
  )
}
