import { m } from 'motion/react'

// Il contenitore live resta sempre nel DOM: così gli screen reader annunciano le frasi nuove.
// key={text}: a ogni frase nuova il fumetto rientra con un pop.
export function Bubble({ text }: { text: string }) {
  return (
    <div className="glu-bubble-live" aria-live="polite">
      <m.p
        key={text}
        className="glu-bubble"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        {text}
      </m.p>
    </div>
  )
}
