import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { readCache, removeCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { unregisterPush } from '../push/subscribe'

export interface AuthUser {
  id: string
  email?: string
  created_at?: string
}

interface AuthValue {
  user: AuthUser | null
  loading: boolean
  recovering: boolean
  finishRecovery(): void
  signOut(): Promise<void>
}

const LAST_USER = 'bere.lastUser'

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Con un utente noto l'app parte subito: senza rete il rinnovo del token può durare decine di secondi.
  const [user, setUser] = useState<AuthUser | null>(() => readCache<AuthUser>(LAST_USER))
  const [loading, setLoading] = useState(() => readCache<AuthUser>(LAST_USER) === null)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    let active = true
    const remember = (next: AuthUser) => {
      writeCache(LAST_USER, { id: next.id, email: next.email, created_at: next.created_at })
      setUser(next)
      setLoading(false)
    }
    const forget = () => {
      removeCache(LAST_USER)
      setUser(null)
      setLoading(false)
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (data.session?.user) return remember(data.session.user as AuthUser)
      // Token scaduto e rete assente: la sessione è ancora salvata, non è un'uscita.
      if (error?.name === 'AuthRetryableFetchError' && readCache<AuthUser>(LAST_USER)) return setLoading(false)
      forget()
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) remember(session.user as AuthUser)
      else if (event === 'SIGNED_OUT') forget()
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await unregisterPush().catch(() => {})
    await supabase.auth.signOut()
  }, [])
  const finishRecovery = useCallback(() => setRecovering(false), [])

  return (
    <AuthContext.Provider value={{ user, loading, recovering, finishRecovery, signOut }}>{children}</AuthContext.Provider>
  )
}

/** Per chi può stare anche fuori da AuthProvider: null se manca. */
export const useOptionalAuth = () => useContext(AuthContext)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth fuori da AuthProvider')
  return value
}
