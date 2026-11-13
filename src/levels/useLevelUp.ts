import { useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { GLU_VARIANTS_LIST } from '../mascot/variants'
import { GLU_VARIANTS } from '../mascot/variantsFlag'
import { levelOf, type Level } from './levels'

/** Il testo della festa del livello; con le varianti di Glu dice anche quale Glu si è appena sbloccato. */
export function levelUpDetail(level: number): string {
  const base = 'Sei salito di livello: continua così.'
  const unlocked = GLU_VARIANTS ? GLU_VARIANTS_LIST.find((v) => v.level === level && v.level > 1) : undefined
  return unlocked ? `${base} Hai sbloccato ${unlocked.name}! Provalo in Aspetto e Glu.` : base
}

/**
 * Il livello raggiunto da ultimo, per far festa solo quando sale. Alla prima volta (nessun valore salvato)
 * il livello di partenza si scrive in silenzio: chi ha già dei punti non ha niente da festeggiare.
 */
export function useLevelUp(userId: string, points: number | null): { level: Level; isNew: boolean; dismiss: () => void } | null {
  const key = `bere.lastLevel.${userId}`
  const [dismissed, setDismissed] = useState(0)
  const level = points === null ? null : levelOf(points)
  const stored = readCache<number>(key)

  useEffect(() => {
    if (level && stored === null) writeCache(key, level.level)
  }, [key, level, stored])

  if (!level) return null
  const isNew = stored !== null && level.level > stored && dismissed < level.level
  return {
    level,
    isNew,
    dismiss: () => {
      writeCache(key, level.level)
      setDismissed(level.level)
    },
  }
}
