import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import type { PushPayload, Subscription } from '../send-reminders/core.ts'

const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get('VAPID_KEYS_JSON') ?? '{}'), { extractable: false })
const server = await webpush.ApplicationServer.new({
  contactInformation: `mailto:${Deno.env.get('VAPID_CONTACT_EMAIL')}`,
  vapidKeys,
})

/** Invia il messaggio e restituisce lo stato HTTP del servizio push di Apple, Google o Mozilla. */
export async function pushMessage(subscription: Subscription, payload: PushPayload): Promise<number> {
  const subscriber = server.subscribe({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  })
  try {
    await subscriber.pushTextMessage(JSON.stringify(payload), {
      // Il telefono può restare senza segnale per un po': oltre 30 minuti il promemoria non serve più.
      // Urgenza alta per non attendere il risparmio energetico.
      ttl: 1800,
      urgency: webpush.Urgency.High,
    })
    return 201
  } catch (error) {
    if (error instanceof webpush.PushMessageError) return error.response.status
    throw error
  }
}
