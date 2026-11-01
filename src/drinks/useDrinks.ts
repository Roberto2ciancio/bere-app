import { useCallback, useEffect, useRef, useState } from 'react'
import { effectiveMl } from '../domain/hydration'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { enqueueDrink, flushQueue, pendingDrinks, removeQueued, type QueuedDrink } from './drinkQueue'

const DOUBLE_TAP_MS = 400
const RETRY_MS = 30_000

interface Entry {
  client_id: string
  amount_ml: number
  drunk_at: string
  hydration_pct?: number
}

export interface DrinkInput {
  amountMl: number
  drinkType: string
  hydrationPct: number
}

async function sendDrink(drink: QueuedDrink) {
  const { error } = await supabase.from('drinks').upsert(drink, { onConflict: 'user_id,client_id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export function useDrinks(userId: string | null, date: string, tz: string, drinkMl: number) {
  const [synced, setSynced] = useState<Entry[]>([])
  const [queued, setQueued] = useState<QueuedDrink[]>([])
  const [loaded, setLoaded] = useState(false)
  const lastTap = useRef(-Infinity)

  const refreshQueue = useCallback(() => {
    setQueued(userId ? pendingDrinks(userId).filter((d) => d.local_date === date) : [])
  }, [userId, date])

  const cacheKey = `bere.drinks.${userId}`

  const sync = useCallback(async () => {
    if (!userId) return
    await flushQueue(userId, sendDrink)
    const { data, error } = await supabase.from('drinks').select('client_id, amount_ml, drunk_at, hydration_pct').eq('user_id', userId).eq('local_date', date)
    if (!error && data) {
      setSynced(data as Entry[])
      writeCache(cacheKey, { date, entries: data })
    }
    refreshQueue()
    setLoaded(true)
  }, [userId, date, refreshQueue, cacheKey])

  useEffect(() => {
    // Senza rete il totale riparte da quanto già salvato oggi su questo telefono.
    const cached = readCache<{ date: string; entries: Entry[] }>(cacheKey)
    setSynced(cached?.date === date ? cached.entries : [])
    refreshQueue()
    void sync()
    const onWake = () => void sync()
    window.addEventListener('online', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('online', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [refreshQueue, sync, cacheKey, date])

  // Con segnale debole il telefono può risultare sempre online: l'evento 'online' non arriva mai.
  const hasQueued = queued.length > 0
  useEffect(() => {
    if (!hasQueued) return
    const timer = setInterval(() => void sync(), RETRY_MS)
    return () => clearInterval(timer)
  }, [hasQueued, sync])

  // Una bevuta appena inviata può comparire sia in coda sia sul server.
  const queuedIds = new Set(queued.map((d) => d.client_id))
  const entries: Entry[] = [...synced.filter((d) => !queuedIds.has(d.client_id)), ...queued]
  const totalMl = entries.reduce((sum, d) => sum + effectiveMl(d.amount_ml, d.hydration_pct ?? 100), 0)

  const drink = useCallback((input?: DrinkInput): boolean => {
    if (!userId) return false
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) return false
    lastTap.current = now
    enqueueDrink({ userId, amountMl: input?.amountMl ?? drinkMl, drinkType: input?.drinkType, hydrationPct: input?.hydrationPct, tz })
    refreshQueue()
    void sync()
    return true
  }, [userId, drinkMl, tz, refreshQueue, sync])

  const undoLast = useCallback(async () => {
    if (!userId || entries.length === 0) return
    const last = [...entries].sort((a, b) => a.drunk_at.localeCompare(b.drunk_at)).at(-1)!
    if (removeQueued(last.client_id)) {
      refreshQueue()
      return
    }
    setSynced((rows) => rows.filter((d) => d.client_id !== last.client_id))
    await supabase.from('drinks').delete().eq('user_id', userId).eq('client_id', last.client_id)
  }, [userId, entries, refreshQueue])

  return { totalMl, loaded, pending: queued.length > 0, canUndo: entries.length > 0, drink, undoLast }
}
