import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProfile, type HomeStyle } from '../auth/ProfileProvider'
import { Avatar } from '../avatars/Avatar'
import { AvatarPicker } from '../avatars/AvatarPicker'
import type { Units } from '../domain/hydration'
import { playSound, SOUNDS } from '../home/sounds'
import { currentDeviceSettingsName } from '../lib/platform'
import { removeImage } from './imageUpload'
import { useImageReplace } from './useImageReplace'

const STYLES: { id: HomeStyle; label: string }[] = [
  { id: 'glu', label: 'Glu' },
  { id: 'bottle', label: 'Bottiglia' },
  { id: 'ring', label: 'Anello' },
  { id: 'drops', label: 'Gocce' },
  { id: 'drop-face', label: 'Gocciolina' },
  { id: 'cat', label: 'Gatto' },
  { id: 'fish', label: 'Pesce' },
  { id: 'can', label: 'Lattina Red Bull' },
]
const UNITS: { id: Units; label: string }[] = [
  { id: 'ml', label: 'Litri' },
  { id: 'oz', label: 'Once' },
]
const AMOUNTS = [150, 200, 250, 300, 500]

/** Foto e nome: come ti vedono gli altri in classifica. */
export function ProfileHeader() {
  const { profile, updateProfile, saveProfile } = useProfile()
  const { error: imageError, busy, replaceImage } = useImageReplace()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [avatarError, setAvatarError] = useState(false)

  const currentName = profile?.display_name ?? ''
  useEffect(() => {
    setName(currentName)
  }, [currentName])

  if (!profile) return null

  // Prima il server: se il salvataggio non riesce resta scelto l'avatar di prima.
  async function pickAvatar(path: string) {
    setAvatarError(false)
    if (!(await saveProfile({ avatar_path: path }))) setAvatarError(true)
  }

  function saveName(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    if (!name.trim()) return setError('Inserisci il tuo nome')
    setError(null)
    void updateProfile({ display_name: name.trim() }).then(() => setSaved(true))
  }

  return (
    <section className="card profile-head" aria-label="Il tuo profilo">
      <div className="profile-id">
        <Avatar path={profile.avatar_path} name={profile.display_name} large />
        <label className="file-button">
          {busy ? 'Caricamento…' : 'Cambia foto'}
          <input aria-label="Foto del profilo" type="file" accept="image/*" disabled={busy} onChange={(e) => void replaceImage(e, 'avatars')} />
        </label>
      </div>
      {imageError && <p role="alert" className="error">{imageError}</p>}
      <div className="field">
        <h3 id="avatar-picker-title">Oppure scegli un avatar</h3>
        <AvatarPicker value={profile.avatar_path} labelledBy="avatar-picker-title" onPick={(path) => void pickAvatar(path)} />
        {avatarError && <p role="alert" className="error">Salvataggio non riuscito. Controlla la connessione e riprova.</p>}
      </div>
      <form className="stack" onSubmit={saveName} noValidate>
        <label>
          Nome
          <input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        {saved && <p role="status" className="hint">Nome salvato.</p>}
        <button className="secondary">Salva nome</button>
      </form>
      <p className="hint">Nome e foto sono visibili agli altri utenti nella classifica.</p>
    </section>
  )
}

/** Cosa succede quando segni una bevuta. */
export function DrinkPrefs() {
  const { profile, updateProfile } = useProfile()
  if (!profile) return null

  return (
    <section className="card">
      <h2>Bevute</h2>
      <div className="field">
        <h3>Quantità per bevuta</h3>
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
      </div>
      <div className="field">
        <h3>Unità di misura</h3>
        <div className="choices" role="group" aria-label="Unità di misura">
          {UNITS.map((unit) => (
            <button
              key={unit.id}
              className="choice"
              aria-pressed={(profile.units ?? 'ml') === unit.id}
              onClick={() => void updateProfile({ units: unit.id })}
            >
              {unit.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <h3>Suono</h3>
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
        <p className="hint">Il suono si sente solo con l'app aperta. Le notifiche usano sempre il suono scelto nelle impostazioni {currentDeviceSettingsName()}.</p>
      </div>
      <Link className="link-row" to="/tazze">Tazze e bevande</Link>
    </section>
  )
}

/** Stile della home e sfondo dell'app. */
export function AppearanceForm() {
  const { profile, updateProfile } = useProfile()
  const { error, busy, replaceImage } = useImageReplace()
  if (!profile) return null

  async function removeBackground() {
    if (!profile?.background_path) return
    const previous = profile.background_path
    await updateProfile({ background_path: null })
    await removeImage('backgrounds', previous)
  }

  return (
    <section className="card">
      <h2>Aspetto</h2>
      <div className="field">
        <h3>Stile della home</h3>
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
      </div>
      <div className="field">
        <h3>Sfondo dell'app</h3>
        <div className="choices">
          <label className="file-button">
            {busy ? 'Caricamento…' : profile.background_path ? 'Cambia sfondo' : 'Scegli uno sfondo'}
            <input aria-label="Sfondo dell'app" type="file" accept="image/*" disabled={busy} onChange={(e) => void replaceImage(e, 'backgrounds')} />
          </label>
          {profile.background_path && (
            <button className="ghost" onClick={() => void removeBackground()}>Rimuovi sfondo</button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  )
}
