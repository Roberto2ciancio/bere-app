import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const SIGNATURE = '89504e470d0a1a0a'

function crc32(buf: Buffer) {
  let c = 0xffffffff
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

/** Legge il file blocco per blocco come un browser: basta un byte fuori posto per rifiutarlo. */
function readPng(file: Buffer) {
  expect(file.subarray(0, 8).toString('hex')).toBe(SIGNATURE)
  const types: string[] = []
  const idat: Buffer[] = []
  let width = 0
  let height = 0
  let at = 8
  while (at < file.length) {
    const length = file.readUInt32BE(at)
    const type = file.subarray(at + 4, at + 8).toString('latin1')
    const data = file.subarray(at + 8, at + 8 + length)
    expect(file.readUInt32BE(at + 8 + length)).toBe(crc32(file.subarray(at + 4, at + 8 + length)))
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
    }
    if (type === 'IDAT') idat.push(data)
    types.push(type)
    at += 12 + length
  }
  expect(at).toBe(file.length)
  return { types, width, height, pixels: inflateSync(Buffer.concat(idat)) }
}

describe.each([
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['dev-icon-192.png', 192],
  ['dev-icon-512.png', 512],
  ['dev-apple-touch-icon.png', 180],
])('%s', (name, size) => {
  it(`è un PNG valido da ${size} pixel`, () => {
    const png = readPng(readFileSync(join(process.cwd(), 'public', name)))
    expect(png.types).toEqual(['IHDR', 'IDAT', 'IEND'])
    expect([png.width, png.height]).toEqual([size, size])
    expect(png.pixels.length).toBe((size * 3 + 1) * size)
  })
})
