import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { prefersReducedMotion } from './effects'

type Props = {
  value: number
  format?: (n: number) => string
  duration?: number
}

// Al primo render mostra subito il valore; anima solo quando `value` cambia.
export function CountUp({ value, format = String, duration = 0.6 }: Props) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (from.current === value) return
    if (reduced) {
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (n) => {
        from.current = n
        setShown(n)
      },
      onComplete: () => {
        from.current = value
        setShown(value)
      },
    })
    return () => controls.stop()
  }, [value, duration, reduced])

  return <span aria-label={format(value)}>{format(reduced ? value : Math.round(shown))}</span>
}
