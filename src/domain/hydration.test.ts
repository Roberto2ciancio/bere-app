import { describe, expect, it } from 'vitest'
import { dayResults, achievements, challenges, computeStats, type DayTotal } from '../history/stats'
import { effectiveMl, expectedByNow, formatAmount, formatVolume, suggestGoal, BUILT_IN_DRINKS, drinkLabel } from './hydration'

describe('effectiveMl', () => {
  it('conta solo la parte che idrata', () => {
    expect(effectiveMl(200, 100)).toBe(200)
    expect(effectiveMl(200, 80)).toBe(160)
    expect(effectiveMl(500, 0)).toBe(0)
  })
})

describe('bevande predefinite', () => {
  it('l\'acqua è la prima e vale il 100%', () => {
    expect(BUILT_IN_DRINKS[0]).toMatchObject({ id: 'water', hydrationPct: 100 })
  })
  it('mostra il nome italiano, o quello personalizzato così com\'è', () => {
    expect(drinkLabel('water')).toBe('Acqua')
    expect(drinkLabel('Kombucha')).toBe('Kombucha')
  })
})

describe('suggestGoal', () => {
  it('parte dal peso e arrotonda a 100 ml', () => {
    expect(suggestGoal(70, 'sedentary', false)).toBe(2300)
  })
  it('aumenta con l\'attività e con il caldo', () => {
    expect(suggestGoal(70, 'very', false)).toBeGreaterThan(suggestGoal(70, 'moderate', false))
    expect(suggestGoal(70, 'moderate', false)).toBeGreaterThan(suggestGoal(70, 'light', false))
    expect(suggestGoal(70, 'light', true)).toBe(suggestGoal(70, 'light', false) + 500)
  })
  it('non esce dai limiti dell\'obiettivo', () => {
    expect(suggestGoal(20, 'sedentary', false)).toBeGreaterThanOrEqual(1000)
    expect(suggestGoal(400, 'very', true)).toBeLessThanOrEqual(6000)
  })
})

describe('expectedByNow', () => {
  const times = [480, 720, 1200]
  it('senza promemoria oggi non dice nulla', () => {
    expect(expectedByNow([], 3000, 600)).toBeNull()
  })
  it('prima del primo è zero, dopo l\'ultimo è l\'obiettivo', () => {
    expect(expectedByNow(times, 3000, 400)).toBe(0)
    expect(expectedByNow(times, 3000, 1300)).toBe(3000)
  })
  it('in mezzo cresce in proporzione alla giornata', () => {
    expect(expectedByNow(times, 3000, 840)).toBe(1500)
  })
  it('un solo promemoria non divide per zero', () => {
    expect(expectedByNow([480], 3000, 480)).toBe(3000)
  })
})

describe('unità', () => {
  it('in litri come sempre', () => {
    expect(formatVolume(1500, 'ml')).toBe('1,5 L')
    expect(formatAmount(200, 'ml')).toBe('200 ml')
  })
  it('in once americane', () => {
    expect(formatVolume(1000, 'oz')).toBe('33,8 oz')
    expect(formatAmount(200, 'oz')).toBe('6,8 oz')
  })
  it('senza preferenza usa i litri', () => {
    expect(formatVolume(1000, undefined)).toBe('1 L')
  })
})

const goals = [{ effectiveFrom: '2026-01-01', goalMl: 2000 }]
const day = (date: string, total: number, drinks = 5): DayTotal => ({ day: date, total_ml: total, drinks })

describe('computeStats', () => {
  it('senza dati è tutto a zero', () => {
    expect(computeStats([], goals, '2026-11-10')).toEqual({ totalMl: 0, drinks: 0, daysTracked: 0, completionRate: 0, bestStreak: 0, currentStreak: 0, averageMl: 0, lowDays: 0, bestHalfRun: 0 })
  })

  it('calcola totale, media, percentuale e giorni scarsi', () => {
    const stats = computeStats([day('2026-11-08', 2000), day('2026-11-09', 500), day('2026-11-10', 2100)], goals, '2026-11-10')
    expect(stats).toMatchObject({ totalMl: 4600, drinks: 15, daysTracked: 3, completionRate: 67, averageMl: 1533, lowDays: 1 })
  })

  it('la serie si interrompe con un giorno saltato', () => {
    const stats = computeStats([day('2026-11-01', 2000), day('2026-11-02', 2000), day('2026-11-03', 2000), day('2026-11-09', 2000), day('2026-11-10', 2000)], goals, '2026-11-10')
    expect(stats.bestStreak).toBe(3)
    expect(stats.currentStreak).toBe(2)
  })

  it('oggi non ancora raggiunto non azzera la serie in corso', () => {
    expect(computeStats([day('2026-11-09', 2000), day('2026-11-10', 100)], goals, '2026-11-10').currentStreak).toBe(1)
  })

  it('ieri mancato azzera la serie in corso', () => {
    expect(computeStats([day('2026-11-08', 2000), day('2026-11-09', 100)], goals, '2026-11-10').currentStreak).toBe(0)
  })

  it('usa l\'obiettivo in vigore quel giorno', () => {
    const changing = [{ effectiveFrom: '2026-01-01', goalMl: 1000 }, { effectiveFrom: '2026-11-10', goalMl: 5000 }]
    expect(computeStats([day('2026-11-09', 1000), day('2026-11-10', 1000)], changing, '2026-11-10').completionRate).toBe(50)
  })

  describe('giorni in pausa', () => {
    const paused = new Set(['2026-11-04', '2026-11-05', '2026-11-06'])
    const before = [day('2026-11-02', 2000), day('2026-11-03', 2000)]

    it('non rompono la serie e non la allungano', () => {
      const stats = computeStats([...before, day('2026-11-07', 2000)], goals, '2026-11-07', undefined, paused)
      expect(stats.bestStreak).toBe(3)
      expect(stats.currentStreak).toBe(3)
    })

    it('la serie in corso attraversa una pausa appena finita', () => {
      expect(computeStats(before, goals, '2026-11-07', undefined, paused).currentStreak).toBe(2)
    })

    it('un giorno in pausa con l’obiettivo raggiunto conta lo stesso', () => {
      const stats = computeStats([...before, day('2026-11-05', 2500)], goals, '2026-11-06', undefined, paused)
      expect(stats.currentStreak).toBe(3)
      expect(stats.bestStreak).toBe(3)
    })

    it('un giorno saltato fuori dalla pausa rompe comunque la serie', () => {
      const stats = computeStats([...before, day('2026-11-08', 2000)], goals, '2026-11-08', undefined, paused)
      expect(stats.bestStreak).toBe(2)
      expect(stats.currentStreak).toBe(1)
    })
  })
})

describe('dayResults', () => {
  it('restituisce tutti i giorni richiesti, anche quelli vuoti, dal più vecchio', () => {
    const results = dayResults([day('2026-11-10', 2500)], goals, '2026-11-10', 3)
    expect(results.map((r) => r.day)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10'])
    expect(results.map((r) => r.totalMl)).toEqual([0, 0, 2500])
    expect(results[2]).toMatchObject({ goalMl: 2000, met: true })
  })
})

describe('achievements', () => {
  const earned = (totals: DayTotal[]) => achievements(computeStats(totals, goals, '2026-11-10')).filter((a) => a.earned).map((a) => a.id)

  it('senza dati nessun traguardo, ma sono tutti elencati', () => {
    expect(earned([])).toEqual([])
    expect(achievements(computeStats([], goals, '2026-11-10')).length).toBeGreaterThan(5)
  })
  it('la prima bevuta e il primo obiettivo', () => {
    expect(earned([day('2026-11-10', 100, 1)])).toEqual(['first-drink'])
    expect(earned([day('2026-11-10', 2000, 1)])).toEqual(['first-drink', 'first-goal'])
  })
  it('le serie e i litri', () => {
    const week = Array.from({ length: 7 }, (_, i) => day(`2026-11-0${i + 1}`, 2000))
    const ids = achievements(computeStats(week, goals, '2026-11-07')).filter((a) => a.earned).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['streak-3', 'streak-7', 'liters-10']))
    expect(ids).not.toContain('streak-30')
  })
})

describe('challenges', () => {
  it('misura la settimana in corso, senza superare l\'obiettivo della sfida', () => {
    const week = Array.from({ length: 7 }, (_, i) => day(`2026-11-0${i + 2}`, 2000))
    const list = challenges(week, goals, '2026-11-02', '2026-11-08')
    expect(list[0]).toMatchObject({ progress: 5, target: 5, done: true })
  })
  it('non conta le settimane precedenti', () => {
    const list = challenges([day('2026-10-30', 2000)], goals, '2026-11-02', '2026-11-08')
    expect(list[0]).toMatchObject({ progress: 0, done: false })
  })
  it('7 giorni senza saltare: tutti i giorni della settimana a obiettivo', () => {
    const six = Array.from({ length: 6 }, (_, i) => day(`2026-11-0${i + 2}`, 2000))
    const seven = (totals: DayTotal[]) => challenges(totals, goals, '2026-11-02', '2026-11-08').find((c) => c.id === 'seven-days')
    expect(seven(six)).toMatchObject({ progress: 6, target: 7, done: false })
    expect(seven([...six, day('2026-11-08', 2000)])).toMatchObject({ progress: 7, done: true })
  })
  it('caffeina sotto i 200 mg: conta i giorni passati restati sotto, un giorno senza caffè vale', () => {
    const caffeine = new Map([['2026-11-02', 40], ['2026-11-03', 220], ['2026-11-04', 199]])
    const sfida = challenges([], goals, '2026-11-02', '2026-11-05', caffeine).find((c) => c.id === 'caffeine-week')
    expect(sfida).toMatchObject({ progress: 3, target: 7, done: false })
    const settimana = challenges([], goals, '2026-11-02', '2026-11-08', new Map([['2026-11-05', 120]])).find((c) => c.id === 'caffeine-week')
    expect(settimana).toMatchObject({ progress: 7, done: true })
    expect(challenges([], goals, '2026-11-02', '2026-11-08').find((c) => c.id === 'caffeine-week')).toBeUndefined()
  })
})

describe('mai sotto metà', () => {
  const days = (n: number, ml: number, from = '2026-10-01') => Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return day(d.toISOString().slice(0, 10), ml)
  })
  const earned = (totals: DayTotal[]) => achievements(computeStats(totals, goals, '2026-11-10')).find((a) => a.id === 'half-30')!.earned
  it('30 giorni di fila sopra metà obiettivo', () => {
    expect(computeStats(days(30, 1000), goals, '2026-11-10').bestHalfRun).toBe(30)
    expect(earned(days(30, 1000))).toBe(true)
  })
  it('un giorno sotto metà o un giorno saltato fa ripartire il conto', () => {
    const totals = days(30, 1000)
    totals[14] = { ...totals[14], total_ml: 500 }
    expect(earned(totals)).toBe(false)
    expect(earned(days(30, 1000).filter((_, i) => i !== 10))).toBe(false)
  })
})
