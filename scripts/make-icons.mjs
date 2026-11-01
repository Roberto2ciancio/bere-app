// Genera le icone delle app senza dipendenze: una goccia sorridente, azzurra per l'app vera e arancione per quella di prova.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const THEMES = {
  '': { top: [46, 196, 226], bottom: [10, 88, 140], water: [120, 214, 240], face: [11, 72, 110] },
  'dev-': { top: [255, 176, 59], bottom: [214, 67, 14], water: [255, 205, 130], face: [122, 46, 8] },
}
const WHITE = [255, 255, 255]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(4 + body.length + 4) // lunghezza, tipo e dati, CRC
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc(body), 4 + body.length)
  return out
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2

// La goccia: un cerchio e, sopra, una punta con i fianchi tangenti. Resta nella zona sicura delle icone Android.
const APEX = 0.15
const CENTER = 0.6
const RADIUS = 0.26
const DISTANCE = CENTER - APEX
const TANGENT_Y = CENTER - RADIUS * (RADIUS / DISTANCE)
const TANGENT_X = RADIUS * Math.sqrt(1 - (RADIUS / DISTANCE) ** 2)

function inDrop(x, y) {
  if (inCircle(x, y, 0.5, CENTER, RADIUS)) return true
  if (y < APEX || y > TANGENT_Y) return false
  return Math.abs(x - 0.5) <= ((y - APEX) / (TANGENT_Y - APEX)) * TANGENT_X
}

function inSmile(x, y) {
  const distance = Math.hypot(x - 0.5, y - 0.625)
  return y > 0.64 && distance > 0.058 && distance < 0.078
}

function pixel(x, y, theme) {
  if (inDrop(x, y)) {
    if (inCircle(x, y, 0.435, 0.59, 0.024) || inCircle(x, y, 0.565, 0.59, 0.024)) return theme.face
    if (inSmile(x, y)) return theme.face
    const wave = 0.75 + 0.012 * Math.sin(x * 26)
    return y > wave ? theme.water : WHITE
  }
  // Riflesso appena accennato in alto a sinistra, per dare volume allo sfondo.
  const base = mix(theme.top, theme.bottom, Math.min(1, Math.max(0, (x * 0.3 + y) / 1.3)))
  return inCircle(x, y, 0.1, 0.05, 0.42) ? mix(base, WHITE, 0.1) : base
}

function png(size, theme) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const samples = 4
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1)
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = pixel((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size, theme)
          color.forEach((v, i) => (sum[i] += v))
        }
      }
      sum.forEach((v, i) => (raw[row + 1 + px * 3 + i] = Math.round(v / samples ** 2)))
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 8 bit
  header[9] = 2 // RGB, senza trasparenza: iOS la riempirebbe di nero
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [prefix, theme] of Object.entries(THEMES)) {
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    writeFileSync(new URL(`../public/${prefix}${name}`, import.meta.url), png(size, theme))
  }
}
