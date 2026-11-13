import { describe, expect, it } from 'vitest'
import { profileLink } from './profileLinks'

describe('profileLink', () => {
  it('Profilo nuovo (app di prova): torna alla voce, col suo nome', () => {
    expect(profileLink('bevute', true)).toEqual({ to: '/profilo/bevute', label: '‹ Bevute e tazze' })
    expect(profileLink('avvisi', true)).toEqual({ to: '/profilo/avvisi', label: '‹ Promemoria e notifiche' })
  })
  it('Profilo di sempre (app vera): «Profilo» → /profilo come su main', () => {
    for (const s of ['obiettivo', 'avvisi', 'bevute', 'aspetto', 'account', 'aiuto'] as const) expect(profileLink(s, false)).toEqual({ to: '/profilo', label: 'Profilo' })
  })
  it('nei test unitari vale l’app vera', () => {
    expect(profileLink('aiuto')).toEqual({ to: '/profilo', label: 'Profilo' })
  })
})
