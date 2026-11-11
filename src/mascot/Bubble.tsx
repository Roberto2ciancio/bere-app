import { m } from 'motion/react'

// key={text}: a ogni frase nuova il fumetto rientra con un pop.
export function Bubble({ text }: { text: string }) {
  return (
    <m.p
      key={text}
      className="glu-bubble"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      {text}
    </m.p>
  )
}
