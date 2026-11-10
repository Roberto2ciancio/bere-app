import { describe, expect, it } from 'vitest'
import { deviceSettingsName } from './platform'

describe('nome del dispositivo nelle istruzioni', () => {
  it('iPhone, iPad (anche quello che si finge Mac), Android, il resto', () => {
    expect(deviceSettingsName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBe("dell'iPhone")
    expect(deviceSettingsName('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe("dell'iPad")
    expect(deviceSettingsName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 5)).toBe("dell'iPad")
    expect(deviceSettingsName('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/138.0.0.0 Mobile Safari/537.36')).toBe('di Android')
    expect(deviceSettingsName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 0)).toBe('del dispositivo')
    expect(deviceSettingsName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/138.0.0.0')).toBe('del dispositivo')
  })
})
