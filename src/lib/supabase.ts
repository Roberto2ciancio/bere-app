import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-anon-key'

// Flusso implicito: il link di recupero si apre in Safari, che non condivide
// la memoria con la PWA installata, quindi PKCE non potrebbe completarsi.
export const supabase = createClient(url, anonKey, {
  auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
