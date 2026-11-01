import { useEffect, useRef, useState } from 'react'

const LOCK_MS = 3000

export function MonsterPunishment({ onClose }: { onClose: () => void }) {
  const [canClose, setCanClose] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setCanClose(true), LOCK_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (canClose) button.current?.focus()
  }, [canClose])

  return (
    <div className="monster-overlay" role="alertdialog" aria-modal="true" aria-labelledby="monster-title" aria-describedby="monster-text">
      <div className="monster-card">
        <h2 id="monster-title">Una Monster? Davvero?</h2>
        <p id="monster-text">
          Che delusione. La Red Bull ti mette le ali, la sua lattina è perfetta e il suo gusto è poesia. Questa invece ti lascia a terra.
          Tutti lo vedranno: un segno negativo ti segue in classifica per un'ora.
        </p>
        <button ref={button} className="primary" disabled={!canClose} onClick={onClose}>Chiedo perdono alla Red Bull</button>
      </div>
    </div>
  )
}
