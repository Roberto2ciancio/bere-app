import { describe, expect, it, vi } from 'vitest'
import { watchForUpdates } from './appUpdate'

function setup(hasController: boolean) {
  const listeners: Record<string, () => void> = {}
  const update = vi.fn(async () => {})
  const sw = {
    controller: hasController ? {} : null,
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = fn
    },
    getRegistration: vi.fn(async () => ({ update })),
  }
  const reload = vi.fn()
  const doc = new EventTarget() as EventTarget & { visibilityState: string }
  doc.visibilityState = 'visible'
  watchForUpdates({ sw, reload, doc })
  return { listeners, update, reload, doc, sw }
}

describe('watchForUpdates', () => {
  it('quando arriva una nuova versione ricarica una sola volta', () => {
    const { listeners, reload } = setup(true)
    listeners.controllerchange()
    listeners.controllerchange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('alla prima installazione non ricarica', () => {
    const { listeners, reload } = setup(false)
    listeners.controllerchange()
    expect(reload).not.toHaveBeenCalled()
  })

  it('tornando in primo piano cerca una nuova versione', async () => {
    const { update, doc } = setup(true)
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
  })

  it('mentre è in background non cerca nulla', () => {
    const { sw, doc } = setup(true)
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(sw.getRegistration).not.toHaveBeenCalled()
  })

  it('senza rete il controllo fallito non genera errori', async () => {
    const { update, doc } = setup(true)
    update.mockRejectedValueOnce(new Error('offline'))
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
  })
})
