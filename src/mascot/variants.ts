export type GluVariantId = 'glu' | 'menta' | 'limone' | 'fragola' | 'cocco' | 'notte'
export type GluDetail = 'none' | 'mint' | 'lemon' | 'strawberry' | 'straw' | 'moon'

export interface GluVariant {
  id: GluVariantId
  name: string
  /** Livello a cui si sblocca. */
  level: number
  palette: { body: string; water: string; limb: string; feet: string }
  detail: GluDetail
}

export const GLU_VARIANTS_LIST: GluVariant[] = [
  { id: 'glu', name: 'Glu', level: 1, palette: { body: '#CFEBFB', water: '#19A0E8', limb: '#8CCDF2', feet: '#19A0E8' }, detail: 'none' },
  { id: 'menta', name: 'Glu Menta', level: 2, palette: { body: '#D3F5E9', water: '#1FB58F', limb: '#8FE0C6', feet: '#1FB58F' }, detail: 'mint' },
  { id: 'limone', name: 'Glu Limone', level: 3, palette: { body: '#FFF6C9', water: '#F2C014', limb: '#FFE27A', feet: '#E0A800' }, detail: 'lemon' },
  { id: 'fragola', name: 'Glu Fragola', level: 4, palette: { body: '#FFE0E6', water: '#F0506E', limb: '#FFA3B5', feet: '#E03A5A' }, detail: 'strawberry' },
  { id: 'cocco', name: 'Glu Cocco', level: 5, palette: { body: '#FBF6EE', water: '#C9A27E', limb: '#E8D7C3', feet: '#A87D57' }, detail: 'straw' },
  { id: 'notte', name: 'Glu Notte', level: 6, palette: { body: '#C9D3F5', water: '#3B4FC9', limb: '#8E9BE8', feet: '#2A3AA8' }, detail: 'moon' },
]

export const CLASSIC_VARIANT = GLU_VARIANTS_LIST[0]

/** La variante con questo id; id sconosciuto → Glu classico. */
export function variantById(id: string | null | undefined): GluVariant {
  return GLU_VARIANTS_LIST.find((v) => v.id === id) ?? CLASSIC_VARIANT
}

/** Le varianti già sbloccate a questo livello. */
export function unlockedVariants(level: number): GluVariant[] {
  return GLU_VARIANTS_LIST.filter((v) => v.level <= level)
}
