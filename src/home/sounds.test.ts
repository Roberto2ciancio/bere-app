import { afterEach, describe, expect, it, vi } from 'vitest'
import { playBuzzer } from './sounds'

const oscillators: { type: string }[] = []

class FakeAudioContext {
  currentTime = 0
  resume = async () => {}
  destination = {}
  createOscillator() {
    const oscillator = {
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (node: unknown) => node,
      start() {},
      stop() {},
    }
    oscillators.push(oscillator)
    return oscillator
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node: unknown) => node }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  oscillators.length = 0
})

describe('playBuzzer', () => {
  it('con suoni disattivati resta in silenzio', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    playBuzzer('none')
    expect(oscillators).toHaveLength(0)
  })

  it('usa un timbro sgradevole, non la nota della bevuta', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    playBuzzer('goccia')
    expect(oscillators.length).toBeGreaterThan(0)
    expect(oscillators.every((o) => o.type === 'sawtooth')).toBe(true)
  })
})
