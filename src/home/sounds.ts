export const SOUNDS: { id: string; label: string }[] = [
  { id: 'goccia', label: 'Goccia' },
  { id: 'campanella', label: 'Campanella' },
  { id: 'none', label: 'Nessuno' },
]

let context: AudioContext | null = null

function tone(ctx: AudioContext, from: number, to: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

/** Il verso della Monster: stonato, ma a volume moderato. Rispetta chi ha scelto "Nessuno". */
export function playBuzzer(soundId: string) {
  if (soundId === 'none' || typeof AudioContext === 'undefined') return
  context ??= new AudioContext()
  void context.resume()
  const now = context.currentTime
  tone(context, 140, 70, now, 0.9, 0.18, 'sawtooth')
  tone(context, 149, 74, now, 0.9, 0.18, 'sawtooth')
}

/** Suono in-app: deve partire da un tocco, altrimenti iOS lo blocca. */
export function playSound(id: string) {
  if (id === 'none' || typeof AudioContext === 'undefined') return
  context ??= new AudioContext()
  void context.resume()
  const now = context.currentTime
  if (id === 'campanella') {
    tone(context, 1320, 1320, now, 0.5, 0.15)
    tone(context, 1980, 1980, now + 0.08, 0.5, 0.08)
  } else {
    tone(context, 500, 1100, now, 0.14, 0.25)
  }
}
