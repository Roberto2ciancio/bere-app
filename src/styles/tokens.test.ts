/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Il CSS si legge con fs: con vitest gli import ?raw dei .css arrivano vuoti.
const dir = __dirname
const tokens = readFileSync(join(dir, 'tokens.css'), 'utf8')

// Blocco `{ ... }` che segue `start` (senza annidamenti).
function block(css: string, start: string): string {
  const i = css.indexOf(start)
  if (i < 0) throw new Error(`blocco non trovato: ${start}`)
  const open = css.indexOf('{', i)
  return css.slice(open + 1, css.indexOf('}', open))
}

function vars(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

// Luminanza relativa WCAG 2.x
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const light = vars(block(tokens, ':root'))
// Il blocco scuro è annidato nel media query: leggiamo tutte le variabili da lì in poi.
const darkMedia = tokens.slice(tokens.indexOf('@media (prefers-color-scheme: dark)'))
const darkVars = vars(darkMedia)

const pairs: [string, string][] = [
  ['--ink', '--bg'],
  ['--ink', '--surface'],
  ['--ink-soft', '--surface'],
  ['--ink-soft', '--bg'],
  ['--on-brand', '--brand'],
  ['--on-brand', '--danger'],
  ['--danger', '--surface'],
  ['--brand-deep', '--surface'],
]

describe('tokens.css', () => {
  it('definisce tutte le variabili previste', () => {
    for (const name of [
      '--bg', '--surface', '--surface-2', '--ink', '--ink-soft', '--line', '--brand', '--brand-deep',
      '--on-brand', '--success', '--success-deep', '--streak', '--danger', '--reward', '--water',
      '--water-deep', '--radius', '--radius-lg', '--shadow', '--press', '--ease-out', '--ease-spring',
      '--display', '--body',
    ]) {
      expect(light[name], `${name} (chiaro)`).toBeTruthy()
    }
    expect(Object.keys(darkVars)).toEqual(expect.arrayContaining(['--bg', '--surface', '--ink', '--brand']))
  })

  for (const [theme, set] of [['chiaro', light], ['scuro', darkVars]] as const) {
    for (const [fg, bg] of pairs) {
      it(`${theme}: contrasto ${fg} su ${bg} almeno 4,5`, () => {
        const ratio = contrast(set[fg], set[bg])
        expect(ratio, `${set[fg]} su ${set[bg]}`).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('nessun tema legato allo stile della Home in src/styles', () => {
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((f: string) => {
        const p = join(d, f)
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.css') ? [p] : []
      })
    const files = walk(dir)
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/:root\[data-style=/)
    }
  })
})
