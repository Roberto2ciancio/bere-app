import { corsHeaders, json } from '../_shared/cors.ts'

const BUCKETS = ['avatars', 'backgrounds']

export interface DeleteDeps {
  userFromToken(token: string): Promise<string | null>
  listFiles(bucket: string, userId: string): Promise<string[]>
  removeFiles(bucket: string, paths: string[]): Promise<void>
  deleteUser(userId: string): Promise<void>
}

/** Prima i file: se qualcosa fallisce il profilo esiste ancora e si può riprovare. */
export async function deleteAccount(deps: DeleteDeps, userId: string): Promise<void> {
  for (const bucket of BUCKETS) {
    const paths = await deps.listFiles(bucket, userId)
    if (paths.length > 0) await deps.removeFiles(bucket, paths)
  }
  await deps.deleteUser(userId)
}

export async function handleDelete(request: Request, deps: DeleteDeps): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  // L'utente si ricava solo dal token: nessun dato della richiesta può indicarne un altro.
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const userId = token ? await deps.userFromToken(token) : null
  if (!userId) return json({ error: 'unauthorized' }, 401)
  try {
    await deleteAccount(deps, userId)
    return json({ ok: true })
  } catch {
    return json({ error: 'delete failed' }, 500)
  }
}
