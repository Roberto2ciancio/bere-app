import { avatarUrl } from '../profile/imageUpload'
import { findPreset, PRESET_PREFIX, presetId } from './presets'

/** Avatar pronto, foto caricata o, in mancanza, l'iniziale del nome. */
export function Avatar({ path, name, large = false }: { path: string | null; name: string; large?: boolean }) {
  const className = large ? 'avatar avatar-lg' : 'avatar'
  const preset = findPreset(presetId(path))
  if (preset) return <span className={`${className} avatar-preset`} aria-hidden="true">{preset.render()}</span>
  // Un preset sconosciuto (tolto in futuro) non è un file: mai chiederlo allo storage.
  if (!path || path.startsWith(PRESET_PREFIX)) {
    return <span className={className} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
  }
  return <img className={className} src={avatarUrl(path)} alt="" />
}
