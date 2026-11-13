import assetato from './glu/assetato.svg?raw'
import festa from './glu/festa.svg?raw'
import tranquillo from './glu/tranquillo.svg?raw'
import type { WeekCardData, WeekMood } from './weekCard'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

// Sempre la tavolozza chiara di src/styles/tokens.css: l'immagine è la stessa anche col tema scuro.
const C = {
  bg: '#F2FAFF',
  surface: '#FFFFFF',
  track: '#E1F0FA',
  ink: '#0B2545',
  inkSoft: '#47607D',
  brand: '#0872B0',
  brandDeep: '#065683',
  light: '#AECFE3',
  streak: '#B07A00',
}

const DISPLAY = '"Baloo 2", ui-rounded, system-ui, sans-serif'
const BODY = 'Nunito, ui-sans-serif, system-ui, sans-serif'

const GLU: Record<WeekMood, string> = { festa, tranquillo, assetato }

/** Aspetta Baloo 2 e Nunito (già nel pacchetto); se non arrivano si usano i caratteri di sistema. */
async function loadFonts() {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (!fonts?.load) return
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise((resolve) => (timer = setTimeout(resolve, 2000)))
  try {
    await Promise.race([Promise.all([fonts.load(`800 64px "Baloo 2"`), fonts.load('800 36px Nunito'), fonts.load('700 36px Nunito')]).catch(() => {}), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Oltre questa attesa Glu si lascia perdere: l'immagine non resta mai appesa. */
export const GLU_TIMEOUT_MS = 3000

/** Glu dall'SVG, come immagine. null se il browser non riesce a leggerlo: l'immagine si fa senza. */
function loadGlu(mood: WeekMood): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(new Blob([GLU[mood]], { type: 'image/svg+xml' }))
  return new Promise((resolve) => {
    const img = new Image()
    const done = (result: HTMLImageElement | null) => {
      clearTimeout(timer)
      img.onload = img.onerror = null
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => done(null), GLU_TIMEOUT_MS)
    img.onload = () => done(img)
    img.onerror = () => done(null)
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.fill()
}

/** Scrive centrato; se il testo è troppo largo rimpicciolisce il carattere finché ci sta. */
function centered(ctx: CanvasRenderingContext2D, text: string, y: number, weight: number, size: number, family: string, color: string, maxWidth = CARD_WIDTH - 140) {
  let px = size
  ctx.font = `${weight} ${px}px ${family}`
  while (px > 20 && ctx.measureText(text).width > maxWidth) {
    px -= 2
    ctx.font = `${weight} ${px}px ${family}`
  }
  ctx.fillStyle = color
  ctx.fillText(text, CARD_WIDTH / 2, y)
}

/** Disegna «La mia settimana su Bere» (1080×1350, per le storie e i messaggi) e la restituisce come PNG. */
export async function drawWeekCard(data: WeekCardData, canvas: HTMLCanvasElement = document.createElement('canvas')): Promise<Blob> {
  const [, glu] = await Promise.all([loadFonts(), loadGlu(data.mood)])
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non disponibile')

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  centered(ctx, data.title, 150, 800, 76, DISPLAY, C.ink)

  // Glu al centro, sopra la card del grafico.
  const gluSize = 340
  if (glu) ctx.drawImage(glu, (CARD_WIDTH - gluSize) / 2, 200, gluSize, gluSize)

  // Card bianca con le sette barre.
  const cardX = 70
  const cardY = 580
  const cardW = CARD_WIDTH - cardX * 2
  const cardH = 420
  ctx.fillStyle = C.surface
  roundRect(ctx, cardX, cardY, cardW, cardH, 44)

  const n = data.bars.length || 1
  const areaTop = cardY + 50
  const areaBottom = cardY + cardH - 100
  const areaH = areaBottom - areaTop
  const slot = (cardW - 80) / n
  const barW = Math.min(88, slot * 0.66)
  data.bars.forEach((bar, i) => {
    const cx = cardX + 40 + slot * i + slot / 2
    ctx.fillStyle = C.track
    roundRect(ctx, cx - barW / 2, areaTop, barW, areaH, 18)
    const h = Math.max(bar.ratio * areaH, bar.ratio > 0 ? 18 : 0)
    if (h > 0) {
      ctx.fillStyle = bar.met ? C.brand : C.light
      roundRect(ctx, cx - barW / 2, areaBottom - h, barW, h, 18)
    }
    const today = bar.label === 'Oggi'
    ctx.font = `800 ${today ? 30 : 38}px ${BODY}`
    ctx.fillStyle = today ? C.brandDeep : C.inkSoft
    ctx.fillText(bar.label, cx, areaBottom + 62)
  })

  centered(ctx, data.metLine, 1090, 800, 64, DISPLAY, C.brandDeep)
  centered(ctx, data.litersLine, 1160, 700, 46, BODY, C.ink)
  if (data.streakLine) centered(ctx, data.streakLine, 1222, 800, 42, BODY, C.streak)

  centered(ctx, 'Bere · roberto2ciancio.github.io/bere-app', 1305, 700, 30, BODY, C.inkSoft)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG non creato'))), 'image/png')
  })
}
