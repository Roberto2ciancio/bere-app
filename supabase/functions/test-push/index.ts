import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { pushMessage } from '../_shared/webpush.ts'
import { sendToDevices, type Subscription } from '../send-reminders/core.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await db.auth.getUser(token)
  const userId = auth.user?.id
  if (!userId) return json({ error: 'unauthorized' }, 401)

  const { data: subscriptions, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  if (error) return json({ error: error.message }, 500)

  const now = new Date()
  const { data: log, error: logError } = await db
    .from('push_log')
    .insert({ user_id: userId, scheduled_date: now.toISOString().slice(0, 10), scheduled_at: now.toISOString(), status: 'pending' })
    .select('id')
    .single()
  if (logError) return json({ error: logError.message }, 500)

  const status = await sendToDevices(
    {
      push: pushMessage,
      removeSubscription: async (id) => {
        await db.from('push_subscriptions').delete().eq('id', id)
      },
      touchSubscription: async (id) => {
        await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', id)
      },
    },
    (subscriptions ?? []) as Subscription[],
    { title: 'Notifica di prova', body: 'Se la vedi, i promemoria possono raggiungerti.', url: '#/notifiche', logId: log.id },
  )
  await db.from('push_log').update({ status, sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', log.id)

  return json({ status })
})
