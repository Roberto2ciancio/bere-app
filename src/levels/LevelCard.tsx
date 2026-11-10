import { levelOf, POINTS } from './levels'
import { CountUp } from '../ui/motion/CountUp'

const pts = (n: number) => `${n.toLocaleString('it-IT')} ${n === 1 ? 'punto' : 'punti'}`

export function LevelCard({ points }: { points: number }) {
  const lv = levelOf(points)
  return (
    <section className="card level-card" aria-label="Livello e punti">
      <div className="level-head">
        <span className="level-emoji" aria-hidden="true">{lv.emoji}</span>
        <div className="level-text">
          <h2>Livello {lv.level} · {lv.name}</h2>
          <span className="chip chip-points"><CountUp value={lv.points} format={pts} /></span>
        </div>
      </div>
      <div className="progress" role="progressbar" aria-label={`Verso il livello ${lv.level + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={lv.progress}>
        <span style={{ width: `${lv.progress}%` }} />
      </div>
      <p className="hint">Ancora {pts(lv.missing)} per il livello {lv.level + 1}.</p>
      <details className="fold">
        <summary>Come si guadagnano i punti</summary>
        <ul className="fold-body level-rules hint">
          <li>1 punto ogni {POINTS.perMl} ml bevuti, fino all'obiettivo del giorno.</li>
          <li>+{POINTS.goalDay} per ogni giorno con l'obiettivo raggiunto.</li>
          <li>+{POINTS.week5} se in una settimana lo raggiungi almeno 5 giorni, +{POINTS.week7} se tutti e 7.</li>
          <li>Come in classifica, gli obiettivi sotto 1,5 L non danno bonus. Il livello si vede accanto al tuo nome in classifica.</li>
        </ul>
      </details>
    </section>
  )
}
