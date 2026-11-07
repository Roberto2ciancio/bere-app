/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CHEER_ACTION, cheerConfirmation, DRINK_ACTION, drinkConfirmation, notificationOptions, SNOOZE_ACTION, snoozeConfirmation, type DrinkFromPushResult, type NotificationPayload, type SnoozeFromPushResult } from './push/notification'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// L'app si apre anche senza rete, dove il segnale può mancare.
// Quella vera non deve intercettare l'app di prova, che sta in una sottocartella e ha il suo service worker.
const denylist = self.registration.scope.endsWith('/dev/') ? [] : [/\/dev\//]
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist }))

self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Il service worker non ha la sessione dell'utente: queste funzioni accettano la chiave pubblica e l'id del promemoria.
function rpc(name: string, logId: string) {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_log_id: logId }),
  })
}

async function markReceived(logId: string) {
  try {
    await rpc('mark_push_received', logId)
  } catch {
    // Solo statistica: non deve mai impedire la notifica.
  }
}

/** «Bevuto ✓»: segna la bevuta senza aprire l'app e risponde con il totale di oggi. */
async function drinkFromNotification(logId: string) {
  let result: DrinkFromPushResult | null = null
  try {
    const response = await rpc('drink_from_push', logId)
    if (response.ok) result = (await response.json()) as DrinkFromPushResult
  } catch {
    // Senza rete: la conferma invita ad aprire l'app.
  }
  const { title, options } = drinkConfirmation(result)
  await self.registration.showNotification(title, options)
}

/** «Tra 15 min»: il server rimanda lo stesso promemoria di un quarto d'ora. */
async function snoozeFromNotification(logId: string) {
  let result: SnoozeFromPushResult | null = null
  try {
    const response = await rpc('snooze_from_push', logId)
    if (response.ok) result = (await response.json()) as SnoozeFromPushResult
  } catch {
    // Senza rete: la conferma lo dice.
  }
  const { title, options } = snoozeConfirmation(result)
  await self.registration.showNotification(title, options)
}

/** «Complimenti» dall'avviso di un amico: il biglietto basta, la sessione non serve. */
async function cheerFromNotification(token: string) {
  let status: string | null = null
  try {
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cheer`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (response.ok) status = ((await response.json()) as { status?: string }).status ?? null
  } catch {
    // Senza rete: la conferma invita ad aprire la classifica.
  }
  const { title, options } = cheerConfirmation(status)
  await self.registration.showNotification(title, options)
}

self.addEventListener('push', (event) => {
  let payload: NotificationPayload = { title: 'È ora di bere', body: '', url: '#/home' }
  try {
    payload = { ...payload, ...(event.data?.json() as Partial<NotificationPayload>) }
  } catch {
    // Messaggio illeggibile: si mostra comunque il promemoria, altrimenti iOS può revocare l'iscrizione.
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, notificationOptions(payload)),
      payload.logId ? markReceived(payload.logId) : Promise.resolve(),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string; logId?: string; cheerToken?: string } | null
  if (event.action === DRINK_ACTION && data?.logId) {
    event.waitUntil(drinkFromNotification(data.logId))
    return
  }
  if (event.action === SNOOZE_ACTION && data?.logId) {
    event.waitUntil(snoozeFromNotification(data.logId))
    return
  }
  if (event.action === CHEER_ACTION && data?.cheerToken) {
    event.waitUntil(cheerFromNotification(data.cheerToken))
    return
  }
  const url = new URL(data?.url ?? '#/home', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const client = clients[0]
      if (client) {
        await client.focus()
        await client.navigate(url).catch(() => null)
        return
      }
      await self.clients.openWindow(url)
    }),
  )
})
