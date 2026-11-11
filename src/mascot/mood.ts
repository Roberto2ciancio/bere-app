export type GluMood = 'hello' | 'idle' | 'thirsty' | 'drink' | 'almost' | 'goal' | 'sad' | 'sleep' | 'levelup' | 'coffee' | 'workout'

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
  coffee: boolean // caffè bevuto negli ultimi 20 min
  workoutJustStarted: boolean // allenamento appena iniziato (scena breve)
  thirst: number // 0..1, da thirstLevel
}

/**
 * Sceglie l'umore di Glu. Priorità, dalla più alta:
 * drink > levelup > (sleep blocca coffee e workout) coffee > workout > goal > sleep > hello > sad > thirsty > almost > idle.
 */
export function pickMood(s: MoodState): GluMood {
  if (s.justDrank) return 'drink'
  if (s.levelUp) return 'levelup'
  const asleep = isAsleep(s)
  if (!asleep && s.coffee) return 'coffee'
  if (!asleep && s.workoutJustStarted) return 'workout'
  if (s.goalMl > 0 && s.totalMl >= s.goalMl) return 'goal'
  if (asleep) return 'sleep'
  if (s.firstOpenToday) return 'hello'
  // hello ha la precedenza nei primi 3 s; poi la tristezza si mostra una volta sola
  if (!s.firstOpenToday && s.yesterdayMet === false && !s.sadShown) return 'sad'
  // A 0 L ha sete a qualsiasi ora; altrimenti solo se dopo mezzogiorno è indietro col ritmo.
  if (s.totalMl === 0 || s.thirst >= 1) return 'thirsty'
  if (
    s.nowMinutes >= 720 &&
    s.expectedMl !== null &&
    s.expectedMl > 0 &&
    s.totalMl < 0.6 * s.expectedMl
  ) {
    return 'thirsty'
  }
  if (s.goalMl > 0 && s.totalMl >= 0.8 * s.goalMl) return 'almost'
  return 'idle'
}

export function isAsleep(s: Pick<MoodState, 'paused' | 'todayMinutes' | 'nowMinutes'>): boolean {
  if (s.paused) return true
  if (s.todayMinutes.length === 0) return false
  const first = Math.min(...s.todayMinutes)
  const last = Math.max(...s.todayMinutes)
  return s.nowMinutes < first - 30 || s.nowMinutes > last + 60
}
