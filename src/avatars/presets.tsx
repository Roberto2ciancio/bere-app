import type { JSX } from 'react'

export interface AvatarPreset {
  id: string
  label: string
  render: () => JSX.Element
}

export const PRESET_PREFIX = 'preset:'

/** 'preset:glu-rosso' → 'glu-rosso'; foto o null → null. */
export function presetId(path: string | null): string | null {
  return path?.startsWith(PRESET_PREFIX) ? path.slice(PRESET_PREFIX.length) : null
}

export const presetPath = (id: string) => `${PRESET_PREFIX}${id}`

// Glu «bolla» in piccolo, con le forme di src/mascot/Glu.tsx (coordinate 200×200, ridotte nel gruppo).
// L'acqua arriva al punto più largo del corpo: la sua forma è la metà bassa del corpo, senza clipPath.
const TORSO = 'M100 28C60 28 30 70 30 118c0 42 28 64 70 64s70-22 70-64c0-48-30-90-70-90z'
const TUFT = 'M96 36C88 14 104 2 118 12c-9 2-11 11-7 22z'
const WATER = 'M30 118c0 42 28 64 70 64s70-22 70-64q-17.5-8-35 0t-35 0-35 0-35 0z'
const INK = '#0b2545'
const PINK = '#ff5f8f'

interface Look {
  bg: string
  body: string
  water: string
  tuft?: boolean
  extra?: JSX.Element
}

const GLU = { body: '#cfebfb', water: '#19a0e8' }

const eye = (cx: number) => (
  <>
    <ellipse cx={cx} cy="90" rx="11" ry="14" fill={INK} />
    <circle cx={cx + 4} cy="84" r="4.2" fill="#fff" />
  </>
)

function art({ bg, body, water, tuft = true, extra }: Look) {
  return (
    <svg className="avatar-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill={bg} />
      <g transform="translate(-6 3) scale(.38)">
        <path d={TORSO} fill={body} />
        {tuft && <path d={TUFT} fill={body} />}
        <path d={WATER} fill={water} />
        <ellipse cx="62" cy="66" rx="9" ry="18" transform="rotate(28 62 66)" fill="#fff" opacity=".6" />
        {eye(74)}
        {eye(126)}
        <path d="M85 104q15 14 30 0" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        {extra}
      </g>
    </svg>
  )
}

// Accessori: forme piene e spesse, leggibili anche a 28 px.
const CAP = (
  <>
    <path d="M40 72C40 30 68 14 100 14s60 16 60 58z" fill="#e8463c" />
    <path d="M136 56h36a9 9 0 0 1 0 18h-36z" fill="#c2342b" />
    <circle cx="100" cy="14" r="8" fill="#fff" />
  </>
)
const GLASSES = (
  <g fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round">
    <circle cx="74" cy="90" r="21" fill="#fff" fillOpacity=".25" />
    <circle cx="126" cy="90" r="21" fill="#fff" fillOpacity=".25" />
    <path d="M95 88q5-5 10 0M53 86l-18-6M147 86l18-6" />
  </g>
)
const HEADPHONES = (
  <>
    <path d="M44 100C44-10 156-10 156 100" fill="none" stroke={PINK} strokeWidth="16" strokeLinecap="round" />
    <rect x="30" y="78" width="30" height="46" rx="15" fill={PINK} />
    <rect x="140" y="78" width="30" height="46" rx="15" fill={PINK} />
  </>
)
const BOW = (
  <g transform="rotate(18 140 38)" fill={PINK}>
    <path d="M140 38 112 20q-8 18 0 36zM140 38l28-18q8 18 0 36z" stroke={PINK} strokeWidth="6" strokeLinejoin="round" />
    <circle cx="140" cy="38" r="10" fill="#e23d76" />
  </g>
)

const preset = (id: string, label: string, look: Look): AvatarPreset => ({ id, label, render: () => art(look) })

// Ordine e id stabili: sono salvati nei profili come 'preset:<id>'.
export const AVATAR_PRESETS: AvatarPreset[] = [
  preset('glu-azzurro', 'Goccia azzurra', { bg: '#0872b0', body: '#d9f1fd', water: '#38bdf8' }),
  preset('glu-rosso', 'Goccia rossa', { bg: '#b3261e', body: '#ffe2de', water: '#ff6b5b' }),
  preset('glu-verde', 'Goccia verde', { bg: '#1e7f4f', body: '#ddf7e8', water: '#3ccb7f' }),
  preset('glu-giallo', 'Goccia gialla', { bg: '#a86a12', body: '#fff4d1', water: '#ffc93c' }),
  preset('glu-viola', 'Goccia viola', { bg: '#6b3fc4', body: '#eee7ff', water: '#a98bff' }),
  preset('glu-arancio', 'Goccia arancione', { bg: '#c2541a', body: '#ffe8d6', water: '#ff9548' }),
  preset('glu-rosa', 'Goccia rosa', { bg: '#b8336a', body: '#ffe3ee', water: '#ff7eb0' }),
  preset('glu-blu', 'Goccia blu', { bg: '#1d3e9e', body: '#e0e9ff', water: '#5b8cff' }),
  preset('glu-cappellino', 'Goccia con il cappellino', { bg: '#0b4f7c', ...GLU, tuft: false, extra: CAP }),
  preset('glu-occhiali', 'Goccia con gli occhiali', { bg: '#128c7e', ...GLU, extra: GLASSES }),
  preset('glu-cuffie', 'Goccia con le cuffie', { bg: '#3b4f8f', ...GLU, extra: HEADPHONES }),
  preset('glu-fiocco', 'Goccia con il fiocco', { bg: '#7b4fd6', ...GLU, extra: BOW }),
]

export const findPreset = (id: string | null) => AVATAR_PRESETS.find((p) => p.id === id)
