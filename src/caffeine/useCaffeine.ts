import { useCallback, useEffect, useRef, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { summarizeCaffeine, type CaffeineKind } from './caffeine'
import { enqueueCaffeine, flushCaffeine, pendingCaffeine, removeQueuedCaffeine, type QueuedCaffeine } from './caffeineQueue'

const DOUBLE_TAP_MS = 400
const RETRY_MS = 30_000

interface Entry {
  client_id: string
  kind: CaffeineKind
  mg: number
  taken_at: string
}

async function send(item: QueuedCaffeine) {
  const { error } = await supabase.from('caffeine_intakes').upsert(item, { onConflict: 'user_id,client_id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export function useCaffeine(userId: string | null, date: string, tz: string) {
  const [synced, setSynced] = useState<Entry[]>([])
  const [queued, setQueued] = useState<QueuedCaffeine[]>([])
  const lastTap = useRef(-Infinity)
  const cacheKey = `bere.caffeine.${userId}`

  const refreshQueue = useCallback(() => {
    setQueued(userId ? pendingCaffeine(userId).filter((c) => c.local_date === date) : [])
  }, [userId, date])

  const sync = useCallback(async () => {
    if (!userId) return
    await flushCaffeine(userId, send)
    const { data, error } = await supabase.from('caffeine_intakes').select('client_id, kind, mg, taken_at').eq('user_id', userId).eq('local_date', date)
    if (!error && data) {
      setSynced(data as Entry[])
      writeCache(cacheKey, { date, entries: data })
    }
    refreshQueue()
  }, [userId, date, refreshQueue, cacheKey])

  useEffect(() => {
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

  const hasQueued = queued.length > 0
  useEffect(() => {
    if (!hasQueued) return
    const timer = setInterval(() => void sync(), RETRY_MS)
    return () => clearInterval(timer)
  }, [hasQueued, sync])

  // Una voce appena inviata può comparire sia in coda sia sul server.
  const queuedIds = new Set(queued.map((c) => c.client_id))
  const entries: Entry[] = [...synced.filter((c) => !queuedIds.has(c.client_id)), ...queued]

  const add = useCallback(
    (kind: CaffeineKind): boolean => {
      if (!userId) return false
      const now = Date.now()
      if (now - lastTap.current < DOUBLE_TAP_MS) return false
      lastTap.current = now
      enqueueCaffeine({ userId, kind, tz })
      refreshQueue()
      void sync()
      return true
    },
    [userId, tz, refreshQueue, sync],
  )

  const undoLast = useCallback(async () => {
    if (!userId || entries.length === 0) return
    const last = [...entries].sort((a, b) => a.taken_at.localeCompare(b.taken_at)).at(-1)!
    if (removeQueuedCaffeine(last.client_id)) {
      refreshQueue()
      return
    }
    setSynced((rows) => rows.filter((c) => c.client_id !== last.client_id))
    await supabase.from('caffeine_intakes').delete().eq('user_id', userId).eq('client_id', last.client_id)
  }, [userId, entries, refreshQueue])

  return { ...summarizeCaffeine(entries), pending: hasQueued, canUndo: entries.length > 0, add, undoLast }
}
