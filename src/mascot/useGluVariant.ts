import { useOptionalAuth } from '../auth/AuthProvider'
import { useOptionalProfile } from '../auth/ProfileProvider'
import { readCache } from '../lib/cache'
import { levelOf } from '../levels/levels'
import { useSharedLevels } from '../levels/useLevels'
import { CLASSIC_VARIANT, variantById, type GluVariant } from './variants'
import { GLU_VARIANTS } from './variantsFlag'

/**
 * La variante di Glu da mostrare: la scelta del profilo se il livello la sblocca, altrimenti Glu classico.
 * Finché il livello non è noto si usa l'ultimo salvato sul telefono; senza niente, classico.
 */
export function useGluVariant(): GluVariant {
  const profile = useOptionalProfile()?.profile
  const userId = useOptionalAuth()?.user?.id ?? null
  const points = useSharedLevels(GLU_VARIANTS && userId !== null)
  if (!GLU_VARIANTS || !userId) return CLASSIC_VARIANT
  const variant = variantById(profile?.home_style)
  const mine = points?.get(userId)
  const level = mine !== undefined ? levelOf(mine).level : readCache<number>(`bere.lastLevel.${userId}`)
  return level !== null && level >= variant.level ? variant : CLASSIC_VARIANT
}
