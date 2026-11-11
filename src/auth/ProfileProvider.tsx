import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Activity, Units } from '../domain/hydration'
import { readCache, removeCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

const cacheKey = (userId: string) => `bere.profile.${userId}`
// Chiave lasciata da versioni vecchie (ripiego dello stile Glu): si toglie al caricamento del profilo.
const homeStyleKey = (userId: string) => `bere.homeStyle.${userId}`

export type HomeStyle = 'glu'

export interface Profile {
  id: string
  display_name: string
  avatar_path: string | null
  background_path: string | null
  home_style: HomeStyle
  sound: string
  drink_ml: number
  tz: string
  weight_kg?: number | null
  activity?: Activity | null
  units?: Units
  stop_at_goal?: boolean
  push_amounts?: boolean
  allow_pokes?: boolean
  share_goal?: boolean
  friend_goal_alerts?: boolean
  nudge_inactive?: boolean
  evening_summary?: boolean
  weekly_report?: boolean
  heat_boost?: boolean
  city_name?: string | null
  city_lat?: number | null
  city_lon?: number | null
  active_split?: boolean
  active_start_min?: number
  active_end_min?: number
}

interface ProfileValue {
  profile: Profile | null
  loading: boolean
  updateProfile(patch: Partial<Profile>): Promise<void>
  /** Salva prima sul server e aggiorna l'app solo se il salvataggio riesce. */
  saveProfile(patch: Partial<Profile>): Promise<boolean>
}

const ProfileContext = createContext<ProfileValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    let active = true
    const cached = readCache<Profile>(cacheKey(userId))
    setProfile(cached)
    setLoading(!cached)
    Promise.resolve(supabase.from('profiles').select('*').eq('id', userId).maybeSingle()).then(({ data }) => {
      if (!active) return
      const loaded = data as Profile | null
      if (loaded) {
        const next = { ...loaded }
        removeCache(homeStyleKey(userId))
        const deviceTz = new Intl.DateTimeFormat().resolvedOptions().timeZone
        if (deviceTz && loaded.tz !== deviceTz) {
          next.tz = deviceTz
          void supabase.from('profiles').update({ tz: deviceTz }).eq('id', userId).then()
        }
        writeCache(cacheKey(userId), next)
        setProfile(next)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [userId])

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return
      setProfile((current) => {
        if (!current) return current
        const next = { ...current, ...patch }
        writeCache(cacheKey(userId), next)
        return next
      })
      await supabase.from('profiles').update(patch).eq('id', userId)
    },
    [userId],
  )

  const saveProfile = useCallback(
    async (patch: Partial<Profile>): Promise<boolean> => {
      if (!userId) return false
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) return false
      setProfile((current) => {
        if (!current) return current
        const next = { ...current, ...patch }
        writeCache(cacheKey(userId), next)
        return next
      })
      return true
    },
    [userId],
  )

  return <ProfileContext.Provider value={{ profile, loading, updateProfile, saveProfile }}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileValue {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile fuori da ProfileProvider')
  return value
}
