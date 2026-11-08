import { describe, expect, it } from 'vitest'
import { suggestTimes } from './suggestTimes'

const TZ = 'Europe/Rome'
// Novembre a Roma: ora locale = UTC + 1.
const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(2026, 10, day, h - 1, m)).toISOString()
}
const everyDay = (days: number, ...times: string[]) =>
  Array.from({ length: days }, (_, i) => times.map((t) => at(i + 1, t))).flat()

describe('suggestTimes', () => {
  it("propone l'orario in cui bevi quasi ogni giorno, arrotondato al quarto d'ora", () => {
    const drinks = [...everyDay(10, '10:32'), ...everyDay(10, '08:00')]
    expect(suggestTimes(drinks, TZ, [480])).toEqual([630])
  })

  it('non propone nulla con meno di una settimana di dati', () => {
    expect(suggestTimes(everyDay(6, '10:30'), TZ, [])).toEqual([])
  })

  it('ignora le abitudini rare', () => {
    const drinks = [...everyDay(20, '08:00'), ...everyDay(3, '15:00')]
    expect(suggestTimes(drinks, TZ, [])).toEqual([480])
  })

  it("salta gli orari che hanno già un promemoria entro tre quarti d'ora", () => {
    expect(suggestTimes(everyDay(10, '10:30'), TZ, [600])).toEqual([])
    expect(suggestTimes(everyDay(10, '10:30'), TZ, [570])).toEqual([630])
  })

  it('due bevute vicine nello stesso giorno contano come una sola abitudine', () => {
    expect(suggestTimes(everyDay(10, '10:20', '10:40'), TZ, [])).toEqual([630])
  })

  it('al massimo tre proposte, le abitudini più forti, in ordine di orario', () => {
    const drinks = [
      ...everyDay(14, '08:00', '11:00', '14:00', '17:00'),
      ...everyDay(8, '20:00'),
    ]
    expect(suggestTimes(drinks, TZ, [])).toHaveLength(3)
    expect(suggestTimes(drinks, TZ, [])).not.toContain(1200)
  })

  it('con la fascia attiva propone solo orari dentro la fascia', () => {
    const drinks = everyDay(10, '07:00', '12:00')
    expect(suggestTimes(drinks, TZ, [], { start: 480, end: 1080 })).toEqual([720])
  })

  it('usa le ore del fuso dell\'utente', () => {
    expect(suggestTimes(everyDay(10, '10:30'), 'UTC', [])).toEqual([570])
  })
})
