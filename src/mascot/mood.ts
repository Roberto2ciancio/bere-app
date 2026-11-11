export type GluMood = 'hello' | 'idle' | 'thirsty' | 'drink' | 'goal' | 'sad' | 'sleep' | 'levelup'

export interface MoodState {
  nowMinutes: number // minuti dalla mezzanotte, fuso del profilo
  totalMl: number
  goalMl: number
  expectedMl: number | null // expectedByNow(...) di hydration.ts
  todayMinutes: number[] // orari dei promemoria di oggi
  paused: boolean
  justDrank: boolean // ultima bevuta < 1,5 s fa
  levelUp: boolean
  firstOpenToday: boolean // per 3 s dopo la prima apertura del giorno
  yesterdayMet: boolean | null
  sadShown: boolean // tristezza già mostrata oggi (4 s passati)
}

/**
 * Sceglie l'umore di Glu. Priorità, dalla più alta:
 * drink > levelup > goal > sleep > hello > sad > thirsty > idle.
 */
export function pickMood(s: MoodState): GluMood {
  if (s.justDrank) return 'drink'
  if (s.levelUp) return 'levelup'
  if (s.goalMl > 0 && s.totalMl >= s.goalMl) return 'goal'
  if (isAsleep(s)) return 'sleep'
  if (s.firstOpenToday) return 'hello'
  // hello ha la precedenza nei primi 3 s; poi la tristezza si mostra una volta sola
  if (!s.firstOpenToday && s.yesterdayMet === false && !s.sadShown) return 'sad'
  if (
    s.nowMinutes >= 720 &&
    s.expectedMl !== null &&
    s.expectedMl > 0 &&
    s.totalMl < 0.6 * s.expectedMl
  ) {
    return 'thirsty'
  }
  return 'idle'
}

function isAsleep(s: MoodState): boolean {
  if (s.paused) return true
  if (s.todayMinutes.length === 0) return false
  const first = Math.min(...s.todayMinutes)
  const last = Math.max(...s.todayMinutes)
  return s.nowMinutes < first - 30 || s.nowMinutes > last + 60
}
