import { supabase } from '../lib/supabase'

export type PushState = 'needs-install' | 'unsupported' | 'denied' | 'prompt' | 'granted'

export interface PushEnvironment {
  isIos: boolean
  isStandalone: boolean
  hasPush: boolean
  permission: NotificationPermission
}

export function detectPushState(env: PushEnvironment): PushState {
  if (env.isIos && !env.isStandalone) return 'needs-install'
  if (!env.hasPush) return 'unsupported'
  if (env.permission === 'denied') return 'denied'
  return env.permission === 'granted' ? 'granted' : 'prompt'
}

function browserEnvironment(): PushEnvironment {
  const hasNotification = typeof Notification !== 'undefined'
  return {
    // iPadOS si presenta come Mac, ma ha il touch.
    isIos: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1),
    isStandalone: window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    hasPush: 'serviceWorker' in navigator && 'PushManager' in window && hasNotification,
    permission: hasNotification ? Notification.permission : 'default',
  }
}

export function pushSupportState(): PushState {
  return detectPushState(browserEnvironment())
}

function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function register(subscription: PushSubscription) {
  const json = subscription.toJSON()
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  })
  if (error) throw new Error(error.message)
}

function newSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeKey(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''),
  })
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function hasDeviceSubscription(): Promise<boolean> {
  return (await currentSubscription()) !== null
}

/** Va chiamata da un tocco: iOS rifiuta la richiesta di permesso in ogni altro momento. */
export async function subscribePush(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permesso negato')
  const registration = await navigator.serviceWorker.ready
  // Il browser può restituire un'iscrizione già scartata dal servizio push: se ne chiede una nuova.
  await (await registration.pushManager.getSubscription())?.unsubscribe()
  await register(await newSubscription(registration))
}

/** All'apertura dell'app riallinea il server: un'iscrizione può cambiare o passare a un altro utente. */
export async function syncPushSubscription(): Promise<void> {
  if (pushSupportState() !== 'granted') return
  const registration = await navigator.serviceWorker.ready
  await register((await registration.pushManager.getSubscription()) ?? (await newSubscription(registration)))
}

export async function sendTestPush(): Promise<'sent' | 'no-device' | 'failed'> {
  const { data, error } = await supabase.functions.invoke('test-push')
  const status = (data as { status?: string } | null)?.status
  if (status === 'no-device') return 'no-device'
  return !error && status === 'sent' ? 'sent' : 'failed'
}

/** All'uscita il telefono smette di ricevere i promemoria di questo profilo. */
export async function unregisterPush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
