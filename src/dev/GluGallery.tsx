import { Glu, type GluExtras } from '../mascot/Glu'
import type { GluMood } from '../mascot/mood'

const MOODS: GluMood[] = ['thirsty', 'idle', 'drink', 'almost', 'goal', 'sleep', 'hello', 'sad', 'levelup', 'coffee', 'workout']
const FILLS = [0, 0.5, 1]

// Le reazioni, a tre per riga.
const REACTIONS: [string, [string, GluMood, GluExtras][]][] = [
  ['sete', [['0', 'idle', { thirst: 0 }], ['0,5', 'idle', { thirst: 0.5 }], ['1 + ventaglio', 'thirsty', { thirst: 1, fan: true }]]],
  ['caffè e allenamento', [['caffè', 'coffee', { jitter: true }], ['allenamento', 'workout', { headband: true, sweat: true }], ['fascia', 'idle', { headband: true }]]],
  ['corona', [['7', 'idle', { crown: 7 }], ['14', 'idle', { crown: 14 }], ['30', 'goal', { crown: 30, crownDrop: true }]]],
  ['inclinazione', [['−20', 'idle', { tilt: -20 }], ['0', 'idle', { tilt: 0 }], ['20', 'idle', { tilt: 20 }]]],
]

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
      {REACTIONS.map(([title, items]) => (
        <section key={title} style={{ display: 'grid', gap: 4 }} data-testid={`glu-reactions-${title}`}>
          <h2>{title}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {items.map(([label, mood, extras]) => (
              <figure key={label} style={{ margin: 0, textAlign: 'center' }}>
                <Glu mood={mood} fill={0.5} size={104} extras={extras} onTap={() => {}} />
                <figcaption style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
