interface UpdateEnv {
  sw: {
    controller: unknown
    addEventListener(type: 'controllerchange', listener: () => void): void
    getRegistration(): Promise<{ update(): Promise<unknown> } | undefined>
  }
  reload: () => void
  doc: EventTarget & { visibilityState: string }
}

/**
 * Un'app installata può restare in memoria per giorni: senza questo continuerebbe a mostrare
 * la versione vecchia anche dopo che il service worker ha scaricato quella nuova.
 */
export function watchForUpdates({ sw, reload, doc }: UpdateEnv) {
  // Alla prima installazione il controller passa da nessuno al primo: non è un aggiornamento.
  const hadController = Boolean(sw.controller)
  let reloading = false
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    reload()
  })
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return
    void sw
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {
        // Senza rete si riprova al prossimo ritorno in primo piano.
      })
  })
}
