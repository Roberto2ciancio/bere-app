import { useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { PRESET_PREFIX } from '../avatars/presets'
import { AVATAR_SIDE, BACKGROUND_SIDE, prepareImage, removeImage, uploadImage, type ImageBucket } from './imageUpload'

/** Carica la nuova immagine e cancella la precedente solo a caricamento riuscito. */
export function useImageReplace() {
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      // Un avatar pronto non è un file nello storage.
      if (previous && !previous.startsWith(PRESET_PREFIX)) await removeImage(bucket, previous)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito')
    }
    setBusy(false)
  }

  return { error, busy, replaceImage }
}
