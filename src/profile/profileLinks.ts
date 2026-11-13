import { NEW_PROFILE } from './newProfile'

export type ProfileSection = 'obiettivo' | 'avvisi' | 'bevute' | 'aspetto' | 'account' | 'aiuto'

const TITLES: Record<ProfileSection, string> = {
  obiettivo: 'Obiettivo',
  avvisi: 'Promemoria e notifiche',
  bevute: 'Bevute e tazze',
  aspetto: 'Aspetto e Glu',
  account: 'Account e privacy',
  aiuto: 'Aiuto e suggerimenti',
}

/**
 * Dove porta «indietro» una pagina raggiunta dal Profilo. Profilo nuovo: alla sua voce («‹ Bevute e tazze»);
 * Profilo di sempre (app vera): al Profilo («Profilo»).
 */
export function profileLink(section: ProfileSection, newProfile: boolean = NEW_PROFILE): { to: string; label: string } {
  return newProfile ? { to: `/profilo/${section}`, label: `‹ ${TITLES[section]}` } : { to: '/profilo', label: 'Profilo' }
}
