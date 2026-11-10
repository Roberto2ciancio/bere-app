import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from './effects'

type Props = {
  value: number
  format?: (n: number) => string
  duration?: number
}

// Al primo render mostra subito il valore; anima solo quando `value` cambia.
// Pensato per valori interi (ml, punti): il valore mostrato è sempre arrotondato.
export function CountUp({ value, format = String, duration = 0.6 }: Props) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    if (start === value) return
    if (prefersReducedMotion()) {
      from.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / (duration * 1000))
      const eased = 1 - (1 - p) ** 3
      const n = p >= 1 ? value : start + (value - start) * eased
      from.current = n
      setShown(n)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span aria-label={format(value)}>{format(Math.round(shown))}</span>
}
