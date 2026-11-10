import type confettiFn from 'canvas-confetti'

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function haptic(): void {
  try {
    navigator.vibrate?.(10)
  } catch {
    // vibrazione non disponibile: niente da fare
  }
}

type Kind = 'goal' | 'level' | 'small'

const BURSTS: Record<Kind, confettiFn.Options[]> = {
  goal: [{ particleCount: 90, spread: 70, startVelocity: 40, origin: { y: 0.7 } }],
  level: [
    { particleCount: 80, spread: 80, angle: 60, startVelocity: 50, origin: { x: 0, y: 0.75 } },
    { particleCount: 80, spread: 80, angle: 120, startVelocity: 50, origin: { x: 1, y: 0.75 } },
  ],
  small: [{ particleCount: 24, spread: 50, startVelocity: 25, scalar: 0.8, origin: { y: 0.8 } }],
}

// I coriandoli sono un di più: ogni errore (canvas assente, import fallito) viene ignorato.
export function confetti(kind: Kind): void {
  if (prefersReducedMotion()) return
  void import('canvas-confetti')
    .then(({ default: fire }) => {
      for (const burst of BURSTS[kind]) void fire({ disableForReducedMotion: true, ...burst })
    })
    .catch(() => {})
}
