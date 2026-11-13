import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { pushMessage } from '../_shared/webpush.ts'
import type { Subscription } from '../send-reminders/core.ts'
import { parseCheer, runCheer } from './core.ts'

// verify_jwt è spento: dalla notifica il service worker non ha la sessione e manda solo il biglietto.
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await db.auth.getUser(token).catch(() => ({ data: { user: null } }))
  const input = parseCheer(await request.json().catch(() => null), auth.user?.id ?? null)
  if (!input) return json({ status: 'invalid' }, 400)

  try {
    const status = await runCheer(
      {
        async claimToken(value) {
          const { data, error } = await db.rpc('claim_cheer_token', { p_token: value })
          if (error) throw new Error(error.message)
          return ((data ?? []) as { to_user: string; from_name: string }[])[0] ?? null
        },
        async claim(from, to, reaction) {
          const { data, error } = await db.rpc('claim_cheer', { p_from: from, p_to: to, p_reaction: reaction })
          if (error) throw new Error(error.message)
          return data as string
        },
        async name(id) {
          const { data } = await db.from('profiles').select('display_name').eq('id', id).maybeSingle()
          return (data?.display_name as string | undefined) ?? 'Un amico'
        },
        async subscriptions(id) {
          // In pausa i complimenti non arrivano: per chi li manda risultano comunque inviati.
          const { data: paused } = await db.rpc('is_paused', { p_user: id })
          if (paused === true) return []
          const { data, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', id)
          if (error) throw new Error(error.message)
          return (data ?? []) as Subscription[]
        },
        push: pushMessage,
        removeSubscription: async (id) => {
          await db.from('push_subscriptions').delete().eq('id', id)
        },
        touchSubscription: async (id) => {
          await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', id)
        },
      },
      input,
    )
    return json({ status })
  } catch {
    return json({ status: 'failed' })
  }
})
