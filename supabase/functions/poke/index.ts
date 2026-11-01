import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { pushMessage } from '../_shared/webpush.ts'
import type { Subscription } from '../send-reminders/core.ts'
import { runPoke } from './core.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await db.auth.getUser(token)
  const from = auth.user?.id
  if (!from) return json({ error: 'unauthorized' }, 401)

  const to = (await request.json().catch(() => null))?.to
  if (typeof to !== 'string') return json({ error: 'destinatario mancante' }, 400)

  try {
    const status = await runPoke(
      {
        async claim(sender, target) {
          const { data, error } = await db.rpc('claim_poke', { p_from: sender, p_to: target })
          if (error) throw new Error(error.message)
          return data as string
        },
        async senderName(id) {
          const { data } = await db.from('profiles').select('display_name').eq('id', id).maybeSingle()
          return (data?.display_name as string | undefined) ?? 'Un amico'
        },
        async subscriptions(id) {
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
      from,
      to,
    )
    return json({ status })
  } catch {
    // to arriva dal client: un id non valido non deve diventare un errore del server visibile.
    return json({ status: 'failed' })
  }
})
