/**
 * Dove si cambia il suono delle notifiche, detto come lo dice il telefono:
 * «dell'iPhone», «dell'iPad», «di Android», altrimenti «del dispositivo».
 * iPadOS si presenta come un Mac: lo si riconosce dallo schermo touch.
 */
export function deviceSettingsName(userAgent: string, maxTouchPoints = 0): string {
  if (/iPhone|iPod/.test(userAgent)) return "dell'iPhone"
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "dell'iPad"
  if (/Android/i.test(userAgent)) return 'di Android'
  return 'del dispositivo'
}

export const currentDeviceSettingsName = () =>
  typeof navigator === 'undefined' ? 'del dispositivo' : deviceSettingsName(navigator.userAgent, navigator.maxTouchPoints)
