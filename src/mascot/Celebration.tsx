import { useEffect, useId, useRef } from 'react'
import { Glu } from './Glu'

interface Props {
  kind: 'goal' | 'level'
  title: string
  detail?: string
  onClose: () => void
}

/** La festa: Glu grande e un solo pulsante. Il focus va lì e, alla chiusura, torna dov'era. */
export function Celebration({ kind, title, detail, onClose }: Props) {
  const titleId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    button.current?.focus()
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
    <div className="sheet-overlay celebration-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet celebration" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="celebration-glu">
          <Glu mood={kind === 'goal' ? 'goal' : 'levelup'} fill={1} size={150} />
        </div>
        <h2 id={titleId}>{title}</h2>
        {detail && <p>{detail}</p>}
        <button ref={button} className="primary" onClick={onClose}>Evviva!</button>
      </div>
    </div>
  )
}
