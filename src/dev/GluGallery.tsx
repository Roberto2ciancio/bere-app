import { Glu } from '../mascot/Glu'
import type { GluMood } from '../mascot/mood'

const MOODS: GluMood[] = ['hello', 'idle', 'thirsty', 'drink', 'goal', 'sad', 'sleep', 'levelup']
const FILLS = [0, 0.5, 1]

// Solo nell'app di prova: tutti gli umori e i livelli d'acqua, per gli screenshot.
export default function GluGallery() {
  return (
    <main style={{ padding: 16, display: 'grid', gap: 16 }} data-testid="glu-gallery">
      <h1>Glu</h1>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Glu mood="idle" fill={0.5} size={240} onTap={() => {}} />
      </div>
      {MOODS.map((mood) => (
        <section key={mood} style={{ display: 'grid', gap: 4 }}>
          <h2>{mood}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {FILLS.map((fill) => (
              <figure key={fill} style={{ margin: 0, textAlign: 'center' }}>
                <Glu mood={mood} fill={fill} size={104} onTap={() => {}} />
                <figcaption style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                  {mood} · {fill * 100}%
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
