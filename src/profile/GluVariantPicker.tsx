import { useRef, useState, type KeyboardEvent } from 'react'
import { useOptionalAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/ProfileProvider'
import { readCache } from '../lib/cache'
import { levelOf, pointsForLevel } from '../levels/levels'
import { useSharedLevels } from '../levels/useLevels'
import { Glu } from '../mascot/Glu'
import { useGluVariant } from '../mascot/useGluVariant'
import { GLU_VARIANTS_LIST, type GluVariant } from '../mascot/variants'
import { GLU_VARIANTS } from '../mascot/variantsFlag'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/** «Il tuo Glu»: le sei varianti, quelle col lucchetto si sbloccano salendo di livello. Solo con GLU_VARIANTS. */
export function GluVariantPicker() {
  if (!GLU_VARIANTS) return null
  return <Picker />
}

function Picker() {
  const { profile, saveProfile } = useProfile()
  const userId = useOptionalAuth()?.user?.id ?? null
  const points = useSharedLevels(userId !== null)?.get(userId ?? '')
  const chosen = useGluVariant()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  if (!profile || !userId) return null

  // Come useGluVariant: finché i punti non arrivano vale l'ultimo livello salvato sul telefono, altrimenti 1.
  const level = points !== undefined ? levelOf(points).level : (readCache<number>(`bere.lastLevel.${userId}`) ?? 1)
  const tabbable = Math.max(0, GLU_VARIANTS_LIST.findIndex((v) => v.id === chosen.id))

  function move(event: KeyboardEvent, index: number) {
    const n = GLU_VARIANTS_LIST.length
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : STEP[event.key] ? (index + STEP[event.key] + n) % n : null
    if (target === null) return
    event.preventDefault()
    refs.current[target]?.focus()
  }

  async function pick(variant: GluVariant) {
    setFailed(false)
    if (variant.level > level) {
      setMessage(
        points !== undefined
          ? `Ti mancano ${pointsForLevel(variant.level) - points} punti al livello ${variant.level}.`
          : `Si sblocca al livello ${variant.level}.`,
      )
      return
    }
    setMessage('')
    if (variant.id === chosen.id) return
    // Prima il server: se il salvataggio non riesce resta la scelta di prima.
    if (!(await saveProfile({ home_style: variant.id }))) setFailed(true)
  }

  return (
    <section className="card glu-variants">
      <h2 id="glu-variants-title">Il tuo Glu</h2>
      <p className="hint">Sali di livello per sbloccare un Glu nuovo.</p>
      <div className="variant-picker" role="radiogroup" aria-labelledby="glu-variants-title">
        {GLU_VARIANTS_LIST.map((variant, index) => {
          const locked = variant.level > level
          return (
            <button
              key={variant.id}
              ref={(el) => {
                refs.current[index] = el
              }}
              type="button"
              role="radio"
              className="variant-option"
              aria-checked={variant.id === chosen.id}
              data-locked={locked || undefined}
              tabIndex={index === tabbable ? 0 : -1}
              onKeyDown={(e) => move(e, index)}
              onClick={() => void pick(variant)}
            >
              <span className="variant-art" aria-hidden="true">
                <Glu mood="idle" fill={0.6} size={56} variant={variant} />
                {locked && <LockIcon />}
                {variant.id === chosen.id && <span className="variant-check">✓</span>}
              </span>
              <span className="variant-name">{variant.name}</span>
              {locked && (
                <>
                  <span className="variant-level">Livello {variant.level}</span>
                  <span className="visually-hidden">, bloccato</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <p className="hint" role="status">{message}</p>
      {failed && <p role="alert" className="error">Salvataggio non riuscito. Controlla la connessione e riprova.</p>}
    </section>
  )
}

function LockIcon() {
  return (
    <svg className="variant-lock" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="3" fill="currentColor" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  )
}
