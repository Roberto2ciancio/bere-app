import { describe, expect, it } from 'vitest'
import { activeHoursError, activePace, amountForNow, inActiveHours } from './activeHours'

const hours = { start: 8 * 60, end: 18 * 60 }
const at = (h: number, m = 0) => h * 60 + m
const pace = (drunkMl: number, nowMinutes: number, goalMl = 3000) => activePace({ goalMl, drunkMl, nowMinutes, hours })

describe('fascia attiva: tabella di marcia', () => {
  it('3 L dalle 8 alle 18: all\'inizio servono 300 ml all\'ora', () => {
    expect(pace(0, at(8))).toMatchObject({ phase: 'active', expectedMl: 0, hourlyMl: 300, status: 'on-track' })
  })

  it('alle 12 dovrei essere a 1,2 L', () => {
    expect(pace(1200, at(12))).toMatchObject({ expectedMl: 1200, diffMl: 0, status: 'on-track', hourlyMl: 300 })
  })

  it('dice se sono indietro e di quanto', () => {
    expect(pace(800, at(12))).toMatchObject({ status: 'behind', diffMl: -400 })
  })

  it('dice se sono avanti e di quanto', () => {
    expect(pace(1500, at(12))).toMatchObject({ status: 'ahead', diffMl: 300 })
  })

  it('un piccolo scarto conta come in linea', () => {
    expect(pace(1150, at(12))).toMatchObject({ status: 'on-track' })
    expect(pace(1300, at(12))).toMatchObject({ status: 'on-track' })
  })
})

describe('fascia attiva: ricalcolo sulle ore che restano', () => {
  it('alle 14 con 1 L bevuto mancano 2 L su 4 ore: 500 ml all\'ora', () => {
    expect(pace(1000, at(14))).toMatchObject({ remainingMl: 2000, hourlyMl: 500, status: 'behind' })
  })

  it('se sono avanti il ritmo scende', () => {
    expect(pace(2200, at(14))).toMatchObject({ remainingMl: 800, hourlyMl: 200, status: 'ahead' })
  })

  it('a obiettivo raggiunto non chiede più niente, a qualunque ora', () => {
    for (const now of [at(7), at(14), at(19)]) expect(pace(3000, now)).toEqual({ phase: 'done' })
    expect(pace(3200, at(14))).toEqual({ phase: 'done' })
  })

  it('nell\'ultima ora non divide sui minuti rimasti', () => {
    expect(pace(2700, at(17, 50))).toMatchObject({ hourlyMl: 300, capped: false })
  })

  it('non chiede mai più di 1 L all\'ora', () => {
    expect(pace(0, at(16))).toMatchObject({ remainingMl: 3000, hourlyMl: 1000, capped: true })
  })

  it('la divisione segue la fascia scelta', () => {
    // 2 L dalle 9 alle 13: 500 ml all'ora
    expect(activePace({ goalMl: 2000, drunkMl: 0, nowMinutes: at(9), hours: { start: at(9), end: at(13) } })).toMatchObject({ hourlyMl: 500 })
  })
})

describe('fuori dalla fascia', () => {
  it('prima dell\'inizio aspetta e dice quando riprende', () => {
    expect(pace(0, at(6, 30))).toEqual({ phase: 'before', resumesAt: at(8) })
  })

  it('dalla fine in poi non fa più conti di marcia', () => {
    expect(pace(2000, at(18))).toEqual({ phase: 'after', remainingMl: 1000 })
    expect(pace(2000, at(23))).toEqual({ phase: 'after', remainingMl: 1000 })
  })

  it('l\'inizio è dentro la fascia, la fine no', () => {
    expect(inActiveHours(at(8), hours)).toBe(true)
    expect(inActiveHours(at(17, 59), hours)).toBe(true)
    expect(inActiveHours(at(18), hours)).toBe(false)
    expect(inActiveHours(at(7, 59), hours)).toBe(false)
  })
})

describe('quanto bere al promemoria', () => {
  it('con promemoria ogni ora è il ritmo orario', () => {
    expect(amountForNow(pace(1000, at(14)), at(14), at(15), hours)).toBe(500)
  })

  it('con promemoria ogni mezz\'ora è metà', () => {
    expect(amountForNow(pace(1000, at(14)), at(14), at(14, 30), hours)).toBe(250)
  })

  it('con promemoria radi non chiede mai più di un\'ora di ritmo in una volta', () => {
    expect(amountForNow(pace(1000, at(14)), at(14), at(16), hours)).toBe(500)
    // ultimo promemoria della fascia: nessun prossimo, o il prossimo è fuori fascia
    expect(amountForNow(pace(1000, at(14)), at(14), null, hours)).toBe(500)
    expect(amountForNow(pace(1000, at(14)), at(14), at(19), hours)).toBe(500)
  })

  it('all\'ultimo promemoria dell\'ultima ora chiede tutto quello che manca', () => {
    expect(amountForNow(pace(2700, at(17, 30)), at(17, 30), null, hours)).toBe(300)
  })

  it('nell\'ultima ora con un altro promemoria dopo chiede solo la sua parte', () => {
    expect(amountForNow(pace(2700, at(17, 30)), at(17, 30), at(17, 45), hours)).toBe(80)
  })

  it('non chiede mai più di quanto manca', () => {
    expect(amountForNow(pace(2950, at(17)), at(17), null, hours)).toBe(50)
  })

  it('fuori fascia o a obiettivo raggiunto non chiede niente', () => {
    expect(amountForNow(pace(0, at(7)), at(7), at(8), hours)).toBe(0)
    expect(amountForNow(pace(3000, at(12)), at(12), at(13), hours)).toBe(0)
  })
})

describe('orari della fascia', () => {
  it('8-18 va bene', () => {
    expect(activeHoursError(at(8), at(18))).toBeNull()
    expect(activeHoursError(0, 24 * 60)).toBeNull()
  })

  it('la fine prima dell\'inizio o uguale non va bene', () => {
    expect(activeHoursError(at(18), at(8))).toMatch(/dopo l'ora di inizio/)
    expect(activeHoursError(at(8), at(8))).toMatch(/dopo l'ora di inizio/)
  })

  it('una fascia sotto l\'ora non va bene', () => {
    expect(activeHoursError(at(8), at(8, 30))).toMatch(/almeno un'ora/)
  })

  it('orari fuori dalla giornata non vanno bene', () => {
    expect(activeHoursError(-60, at(8))).toMatch(/validi/)
    expect(activeHoursError(at(8), 25 * 60)).toMatch(/validi/)
    expect(activeHoursError(Number.NaN, at(8))).toMatch(/validi/)
  })
})
