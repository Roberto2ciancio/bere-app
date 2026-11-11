import { useEffect, useRef, useState } from 'react'
import { useProfile } from '../../auth/ProfileProvider'
import { AvatarPicker } from '../../avatars/AvatarPicker'
import type { GluMood } from '../../mascot/mood'
import { useImageReplace } from '../../profile/useImageReplace'
import { OnboardingShell } from '../OnboardingShell'

export function AvatarStep({ onNext }: { onNext: () => void }) {
  const { profile, saveProfile } = useProfile()
  const { error: imageError, busy, replaceImage } = useImageReplace()
  const [failed, setFailed] = useState(false)
  const [mood, setMood] = useState<GluMood>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Prima il server: se non riesce resta l'avatar di prima.
  async function pick(path: string) {
    setFailed(false)
    if (!(await saveProfile({ avatar_path: path }))) return setFailed(true)
    setMood('goal')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMood('idle'), 1500)
  }

  return (
    <OnboardingShell step="avatar" mood={mood} say="Come ti fai vedere in classifica?" onNext={onNext} onSkip={onNext} nextLabel="Avanti">
      <div className="ob-avatars">
        <AvatarPicker value={profile?.avatar_path ?? null} onPick={(path) => void pick(path)} />
        <label className="file-button">
          {busy ? 'Caricamento…' : 'Carica una foto'}
          <input aria-label="Carica una foto" type="file" accept="image/*" disabled={busy} onChange={(e) => void replaceImage(e, 'avatars')} />
        </label>
        {failed && <p role="alert" className="error">Salvataggio non riuscito. Controlla la connessione e riprova.</p>}
        {imageError && <p role="alert" className="error">{imageError}</p>}
      </div>
    </OnboardingShell>
  )
}
