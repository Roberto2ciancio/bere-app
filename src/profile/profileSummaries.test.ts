import { describe, expect, it } from 'vitest'
import { drinkSummary, goalSummary, notificationSummary, pauseUntilLabel } from './profileSummaries'

describe('goalSummary', () => {
  it('mostra l’obiettivo di oggi in litri', () => {
    expect(goalSummary(2700, 'ml')).toBe('2,7 L al giorno')
    expect(goalSummary(3000, undefined)).toBe('3 L al giorno')
  })
  it('in once con le once', () => {
    expect(goalSummary(2000, 'oz')).toBe('67,6 oz al giorno')
  })
  it('un trattino neutro mentre carica', () => {
    expect(goalSummary(null, 'ml')).toBe('—')
  })
})

describe('drinkSummary', () => {
  it('quantità per bevuta e unità', () => {
    expect(drinkSummary(200, 'ml')).toBe('200 ml · litri')
    expect(drinkSummary(250, undefined)).toBe('250 ml · litri')
    expect(drinkSummary(200, 'oz')).toBe('6,8 oz · once')
  })
})

describe('pauseUntilLabel', () => {
  it('giorno/mese a due cifre', () => {
    expect(pauseUntilLabel('2026-11-14')).toBe('14/11')
    expect(pauseUntilLabel('2026-01-05')).toBe('05/01')
  })
})

describe('notificationSummary', () => {
  const on = { support: 'granted' as const, off: false, pauseEnd: null, reminders: 3 }
  it('attive con il numero di promemoria', () => {
    expect(notificationSummary(on)).toBe('Attive · 3 promemoria')
    expect(notificationSummary({ ...on, reminders: 1 })).toBe('Attive · 1 promemoria')
    expect(notificationSummary({ ...on, reminders: 0 })).toBe('Attive · nessun promemoria')
  })
  it('attive senza numero finché i promemoria non arrivano', () => {
    expect(notificationSummary({ ...on, reminders: null })).toBe('Attive')
  })
  it('in pausa: la data di fine prevale sui promemoria', () => {
    expect(notificationSummary({ ...on, pauseEnd: '2026-11-14' })).toBe('In pausa fino al 14/11')
  })
  it('spente se disattivate o mai attivate', () => {
    expect(notificationSummary({ ...on, off: true })).toBe('Spente')
    expect(notificationSummary({ ...on, off: true, pauseEnd: '2026-11-14' })).toBe('Spente')
    expect(notificationSummary({ ...on, support: 'prompt' })).toBe('Spente')
  })
  it('browser senza notifiche, telefono che le blocca, iPhone da installare', () => {
    expect(notificationSummary({ ...on, support: 'unsupported' })).toBe('Non disponibili su questo browser')
    expect(notificationSummary({ ...on, support: 'denied' })).toBe('Bloccate dal telefono')
    expect(notificationSummary({ ...on, support: 'needs-install' })).toBe("Installa l'app per attivarle")
  })
})
