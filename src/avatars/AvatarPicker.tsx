import { useRef, type KeyboardEvent } from 'react'
import { AVATAR_PRESETS, presetId, presetPath } from './presets'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

interface Props {
  value: string | null
  onPick: (path: string) => void
  /** Id del titolo visibile che dà il nome al gruppo; senza, il nome è «Avatar». */
  labelledBy?: string
}

/** Griglia dei 12 avatar pronti: frecce, Home e Fine spostano il focus, clic, Invio o spazio scelgono. */
export function AvatarPicker({ value, onPick, labelledBy }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = presetId(value)
  // Un solo radio nel giro del Tab: quello scelto, altrimenti il primo.
  const tabbable = Math.max(0, AVATAR_PRESETS.findIndex((p) => p.id === current))

  function move(event: KeyboardEvent, index: number) {
    const n = AVATAR_PRESETS.length
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : STEP[event.key] ? (index + STEP[event.key] + n) % n : null
    if (target === null) return
    event.preventDefault()
    refs.current[target]?.focus()
  }

  return (
    <div className="avatar-picker" role="radiogroup" aria-label={labelledBy ? undefined : 'Avatar'} aria-labelledby={labelledBy}>
      {AVATAR_PRESETS.map((preset, index) => (
        <button
          key={preset.id}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="button"
          role="radio"
          className="avatar-option"
          aria-checked={preset.id === current}
          aria-label={preset.label}
          tabIndex={index === tabbable ? 0 : -1}
          onKeyDown={(e) => move(e, index)}
          onClick={() => onPick(presetPath(preset.id))}
        >
          {preset.render()}
        </button>
      ))}
    </div>
  )
}
