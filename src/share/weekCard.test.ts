import { describe, expect, it } from 'vitest'
import type { DayResult } from '../history/stats'
import { weekCardData } from './weekCard'

const TODAY = '2026-11-13' // venerdì

/** Sette giorni fino a oggi: i primi `met` a obiettivo (2 L su 2 L), gli altri a 1 L. */
function week(met: number, goalMl = 2000): DayResult[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = `2026-11-${String(7 + i).padStart(2, '0')}`
    const ok = i < met
    return { day, totalMl: ok ? goalMl : 1000, goalMl, met: ok }
  })
}

describe('weekCardData', () => {
  it('titolo, sette barre con lettere dei giorni e «Oggi» per oggi', () => {
    const data = weekCardData(week(3), 2, 'ml', TODAY)
    expect(data.title).toBe('La mia settimana su Bere')
    expect(data.bars).toHaveLength(7)
    // 7/11/2026 è un sabato.
    expect(data.bars.map((b) => b.label)).toEqual(['S', 'D', 'L', 'M', 'M', 'G', 'Oggi'])
  })

  it('0 giorni a obiettivo: Glu assetato, niente serie', () => {
    const data = weekCardData(week(0), 0, 'ml', TODAY)
    expect(data.metLine).toBe('0 giorni su 7 a obiettivo')
    expect(data.streakLine).toBeNull()
    expect(data.mood).toBe('assetato')
  })

  it('3 giorni: Glu tranquillo', () => {
    const data = weekCardData(week(3), 1, 'ml', TODAY)
    expect(data.metLine).toBe('3 giorni su 7 a obiettivo')
    expect(data.mood).toBe('tranquillo')
    expect(data.streakLine).toBe('Serie: 1 giorno')
  })

  it('5 giorni: Glu in festa', () => {
    expect(weekCardData(week(5), 5, 'ml', TODAY).mood).toBe('festa')
  })

  it('7 giorni: festa, litri totali e serie', () => {
    const data = weekCardData(week(7), 12, 'ml', TODAY)
    expect(data.metLine).toBe('7 giorni su 7 a obiettivo')
    expect(data.litersLine).toBe('14 L bevuti')
    expect(data.streakLine).toBe('Serie: 12 giorni')
    expect(data.mood).toBe('festa')
  })

  it('litri con la virgola e once con le unità dell’utente', () => {
    expect(weekCardData(week(3), 0, 'ml', TODAY).litersLine).toBe('10 L bevuti')
    expect(weekCardData(week(1, 2250), 0, undefined, TODAY).litersLine).toBe('8,25 L bevuti')
    expect(weekCardData(week(7), 0, 'oz', TODAY).litersLine).toMatch(/^473,4 oz bevuti$/)
  })

  it('un giorno a obiettivo si dice al singolare', () => {
    expect(weekCardData(week(1), 0, 'ml', TODAY).metLine).toBe('1 giorno su 7 a obiettivo')
  })

  it('le altezze stanno tra 0 e 1, rispetto al più alto tra bevuto e obiettivo', () => {
    const days = week(2)
    days[0] = { ...days[0], totalMl: 4000, met: true }
    days[6] = { ...days[6], totalMl: 0 }
    const { bars } = weekCardData(days, 0, 'ml', TODAY)
    for (const b of bars) {
      expect(b.ratio).toBeGreaterThanOrEqual(0)
      expect(b.ratio).toBeLessThanOrEqual(1)
    }
    expect(bars[0].ratio).toBe(1)
    expect(bars[1].ratio).toBe(0.5)
    expect(bars[6].ratio).toBe(0)
    expect(bars.map((b) => b.met)).toEqual([true, true, false, false, false, false, false])
  })

  it('una settimana vuota senza obiettivo non divide per zero', () => {
    const days = week(0, 0).map((d) => ({ ...d, totalMl: 0 }))
    expect(weekCardData(days, 0, 'ml', TODAY).bars.every((b) => b.ratio === 0)).toBe(true)
  })
})
