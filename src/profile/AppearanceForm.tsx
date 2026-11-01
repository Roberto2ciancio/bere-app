import { useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile, type HomeStyle } from '../auth/ProfileProvider'
import { playSound, SOUNDS } from '../home/sounds'
import {
  AVATAR_SIDE,
  BACKGROUND_SIDE,
  avatarUrl,
  prepareImage,
  removeImage,
  uploadImage,
  type ImageBucket,
} from './imageUpload'

const STYLES: { id: HomeStyle; label: string }[] = [
  { id: 'bottle', label: 'Bottiglia' },
  { id: 'ring', label: 'Anello' },
  { id: 'drops', label: 'Gocce' },
]
const AMOUNTS = [150, 200, 250, 300, 500]

export function AppearanceForm() {
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!profile || !user) return null

  async function replaceImage(event: ChangeEvent<HTMLInputElement>, bucket: ImageBucket) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user || !profile) return
    setBusy(true)
    setError(null)
    try {
      const side = bucket === 'avatars' ? AVATAR_SIDE : BACKGROUND_SIDE
      const path = await uploadImage(bucket, user.id, await prepareImage(file, side))
      const column = bucket === 'avatars' ? 'avatar_path' : 'background_path'
      const previous = profile[column]
      await updateProfile({ [column]: path })
      if (previous) await removeImage(bucket, previous)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
    }
    setBusy(false)
  }

  async function removeBackground() {
    if (!profile?.background_path) return
    const previous = profile.background_path
    await updateProfile({ background_path: null })
    await removeImage('backgrounds', previous)
  }

  return (
    <>
      <section className="section">
        <h2>Foto del profilo</h2>
        <div className="row">
          {profile.avatar_path ? (
            <img className="avatar" src={avatarUrl(profile.avatar_path)} alt="" />
          ) : (
            <span className="avatar" aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span>
          )}
          <input aria-label="Foto del profilo" type="file" accept="image/*" disabled={busy} onChange={(e) => void replaceImage(e, 'avatars')} />
        </div>
      </section>

      <section className="section">
        <h2>Aspetto</h2>
        <div className="choices" role="group" aria-label="Stile della home">
          {STYLES.map((style) => (
            <button
              key={style.id}
              className="choice"
              aria-pressed={profile.home_style === style.id}
              onClick={() => void updateProfile({ home_style: style.id })}
            >
              {style.label}
            </button>
          ))}
        </div>
        <div className="stack">
          <label>
            Sfondo dell'app
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => void replaceImage(e, 'backgrounds')} />
          </label>
        </div>
        {profile.background_path && (
          <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={() => void removeBackground()}>Rimuovi sfondo</button>
        )}
        {error && <p role="alert" className="error">{error}</p>}
      </section>

      <section className="section">
        <h2>Quando segni una bevuta</h2>
        <p className="hint">Il suono si sente solo con l'app aperta. Le notifiche usano sempre il suono scelto nelle impostazioni dell'iPhone.</p>
        <div className="choices" role="group" aria-label="Suono">
          {SOUNDS.map((sound) => (
            <button
              key={sound.id}
              className="choice"
              aria-pressed={profile.sound === sound.id}
              onClick={() => {
                playSound(sound.id)
                void updateProfile({ sound: sound.id })
              }}
            >
              {sound.label}
            </button>
          ))}
        </div>
        <div className="choices" role="group" aria-label="Quantità per bevuta">
          {AMOUNTS.map((amount) => (
            <button
              key={amount}
              className="choice num"
              aria-pressed={profile.drink_ml === amount}
              onClick={() => void updateProfile({ drink_ml: amount })}
            >
              {amount} ml
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
