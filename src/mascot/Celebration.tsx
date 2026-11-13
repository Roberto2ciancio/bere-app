import { m } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { prefersReducedMotion } from '../ui/motion/effects'
import { Glu } from './Glu'
import { useGluVariant } from './useGluVariant'

interface Props {
  kind: 'goal' | 'level'
  title: string
  detail?: string
  onClose: () => void
}

/**
 * La festa: un pannello che sale dal basso con Glu e un solo pulsante. Il focus va lì e, alla chiusura,
 * torna dov'era. Si chiude subito (senza animazione d'uscita), come gli altri pannelli.
 */
export function Celebration({ kind, title, detail, onClose }: Props) {
  const variant = useGluVariant()
  const titleId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  const [still] = useState(prefersReducedMotion)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Il pannello sta ancora salendo: senza preventScroll il browser proverebbe a portarlo in vista.
    button.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Chi aveva il focus può non esserci più (o non averlo mai avuto): si torna al pulsante principale.
      const target = before && before !== document.body && before.isConnected ? before : document.querySelector<HTMLElement>('button.drink')
      target?.focus()
    }
  }, [])

  return (
    <m.div
      className="sheet-overlay celebration-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      initial={still ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <m.div
        className="sheet celebration"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={still ? false : { y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="celebration-glu">
          <Glu mood={kind === 'goal' ? 'goal' : 'levelup'} fill={1} size={180} variant={variant} />
        </div>
        <h2 id={titleId}>{title}</h2>
        {detail && <p>{detail}</p>}
        <button ref={button} className="primary" onClick={onClose}>Evviva!</button>
      </m.div>
    </m.div>
  )
}
