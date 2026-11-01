import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleDelete, type DeleteDeps } from './core.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const deps: DeleteDeps = {
  async userFromToken(token) {
    const { data } = await db.auth.getUser(token)
    return data.user?.id ?? null
  },
  async listFiles(bucket, userId) {
    const { data, error } = await db.storage.from(bucket).list(userId)
    if (error) throw new Error(error.message)
    return (data ?? []).map((file) => `${userId}/${file.name}`)
  },
  async removeFiles(bucket, paths) {
    const { error } = await db.storage.from(bucket).remove(paths)
    if (error) throw new Error(error.message)
  },
  async deleteUser(userId) {
    const { error } = await db.auth.admin.deleteUser(userId)
    if (error) throw new Error(error.message)
  },
}

Deno.serve((request) => handleDelete(request, deps))
