import { supabase } from './supabase'

const KEY = 'bere.lastSeenPing'
const EVERY_MS = 15 * 60_000

/**
 * Dice al server che l'app è stata aperta: chi non la apre da un giorno riceve un promemoria.
 * Al massimo ogni 15 minuti, e senza rete non importa: ci si riprova alla prossima apertura.
 */
export function touchLastSeen(now = Date.now()) {
  try {
    const last = Number(localStorage.getItem(KEY) ?? 0)
    if (now - last < EVERY_MS) return
    localStorage.setItem(KEY, String(now))
  } catch {
    // Senza spazio salvato si avvisa comunque il server.
  }
  void Promise.resolve(supabase.rpc('touch_last_seen')).catch(() => {})
}
