export interface NotificationPayload {
  title: string
  body: string
  url: string
  logId?: string
}

/** Niente tag: un tag fisso sostituirebbe in silenzio un promemoria ancora non letto. */
export function notificationOptions(payload: NotificationPayload): NotificationOptions {
  return {
    body: payload.body,
    icon: 'icon-192.png',
    data: { url: payload.url },
  }
}
