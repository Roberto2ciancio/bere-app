import { levelOf } from './levels'

/** Il livello in breve (emoji e numero): in classifica accanto ai nomi, nel Profilo sotto il proprio. */
export function LevelBadge({ points }: { points: number }) {
  const lv = levelOf(points)
  return (
    <span className="level-badge" title={`Livello ${lv.level} · ${lv.name}`} aria-label={`livello ${lv.level}, ${lv.name}`}>
      <span aria-hidden="true">{lv.emoji} {lv.level}</span>
    </span>
  )
}
