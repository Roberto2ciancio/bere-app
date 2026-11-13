import { useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { GLU_VARIANTS_LIST } from '../mascot/variants'
import { GLU_VARIANTS } from '../mascot/variantsFlag'
import { levelOf, type Level } from './levels'

/** Il testo della festa del livello; con le varianti di Glu dice anche quali Glu si sono sbloccati salendo da `from` a `to`. */
export function levelUpDetail(from: number, to: number): string {
  const base = 'Sei salito di livello: continua così.'
  const names = GLU_VARIANTS ? GLU_VARIANTS_LIST.filter((v) => v.level > from && v.level <= to).map((v) => v.name) : []
  if (names.length === 0) return base
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
  return `${base} Hai sbloccato ${list}! ${names.length === 1 ? 'Provalo' : 'Provali'} in Aspetto e Glu.`
}

/**
 * Il livello raggiunto da ultimo, per far festa solo quando sale. Alla prima volta (nessun valore salvato)
 * il livello di partenza si scrive in silenzio: chi ha già dei punti non ha niente da festeggiare.
 */
export function useLevelUp(userId: string, points: number | null): { level: Level; from: number | null; isNew: boolean; dismiss: () => void } | null {
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
    /** Il livello salvato prima di questa festa (null alla prima volta). */
    from: stored,
    isNew,
    dismiss: () => {
      writeCache(key, level.level)
      setDismissed(level.level)
    },
  }
}
