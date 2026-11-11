import { vi } from 'vitest'

type Row = Record<string, unknown>
type Result = { data: unknown; error: { message: string } | null }

/**
 * Finto client Supabase in memoria: conserva le righe per tabella così i test
 * controllano cosa resta salvato, non quali metodi sono stati chiamati.
 */
export function createFakeSupabase() {
  const tables: Record<string, Row[]> = {}
  const rpcResults: Record<string, unknown> = {}
  const uploads: { bucket: string; path: string; body: unknown }[] = []
  const removed: { bucket: string; paths: string[] }[] = []
  const failures = {
    select: null as string | null,
    insert: null as string | null,
    upsert: null as string | null,
    update: null as string | null,
    /** Codice dell'errore di update (per esempio 23514, violazione di un check). */
    updateCode: null as string | null,
    invoke: null as string | null,
  }
  const invocations: { name: string; body: unknown }[] = []
  const rpcCalls: { name: string; args: unknown }[] = []
  let listener: ((event: string, session: unknown) => void) | null = null
  let session: { user: { id: string; email?: string; created_at?: string } } | null = null
  let sessionError: { name: string; message: string } | null = null
  let invokeResult: unknown = {}

  function query(table: string) {
    const filters: ((r: Row) => boolean)[] = []
    let order: { column: string; ascending: boolean } | null = null
    let max: number | null = null
    let offset = 0
    let single = false
    let action: { kind: 'select' | 'delete' } | { kind: 'update'; patch: Row } = { kind: 'select' }

    const rows = () => (tables[table] ??= [])
    const run = (): Result => {
      if (failures.select && action.kind === 'select') return { data: null, error: { message: failures.select } }
      if (failures.update && action.kind === 'update') return { data: null, error: { message: failures.update, ...(failures.updateCode ? { code: failures.updateCode } : {}) } }
      let matched = rows().filter((r) => filters.every((f) => f(r)))
      if (action.kind === 'delete') {
        tables[table] = rows().filter((r) => !matched.includes(r))
        return { data: null, error: null }
      }
      if (action.kind === 'update') {
        const patch = action.patch
        matched.forEach((r) => Object.assign(r, patch))
      }
      if (order) {
        const { column, ascending } = order
        matched = [...matched].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1))
      }
      if (max !== null) matched = matched.slice(offset, offset + max)
      return { data: single ? (matched[0] ?? null) : matched, error: null }
    }

    const builder = {
      select: () => builder,
      eq(column: string, value: unknown) {
        filters.push((r) => r[column] === value)
        return builder
      },
      gte(column: string, value: string) {
        filters.push((r) => String(r[column]) >= value)
        return builder
      },
      range(from: number, to: number) {
        offset = from
        max = to - from + 1
        return builder
      },
      in(column: string, values: unknown[]) {
        filters.push((r) => values.includes(r[column]))
        return builder
      },
      order(column: string, options?: { ascending?: boolean }) {
        order = { column, ascending: options?.ascending ?? true }
        return builder
      },
      limit(n: number) {
        max = n
        return builder
      },
      maybeSingle() {
        single = true
        return builder
      },
      single() {
        single = true
        return builder
      },
      update(patch: Row) {
        action = { kind: 'update', patch }
        return builder
      },
      delete() {
        action = { kind: 'delete' }
        return builder
      },
      insert(values: Row | Row[]) {
        if (failures.insert) return Promise.resolve({ data: null, error: { message: failures.insert } })
        const list = (Array.isArray(values) ? values : [values]).map((v) => ({ id: crypto.randomUUID(), ...v }))
        rows().push(...list)
        const inserted = {
          select: () => ({ single: () => Promise.resolve({ data: list[0], error: null }) }),
          then: (resolve: (r: Result) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
        }
        return inserted
      },
      upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        if (failures.upsert) return Promise.resolve({ data: null, error: { message: failures.upsert } })
        const keys = options?.onConflict?.split(',').map((k) => k.trim()) ?? ['id']
        for (const value of [values].flat()) {
          const existing = rows().find((r) => keys.every((k) => r[k] === value[k]))
          if (existing) {
            if (!options?.ignoreDuplicates) Object.assign(existing, value)
          } else {
            rows().push({ id: crypto.randomUUID(), ...value })
          }
        }
        return Promise.resolve({ data: null, error: null })
      },
      then(resolve: (r: Result) => unknown) {
        return Promise.resolve(run()).then(resolve)
      },
    }
    return builder
  }

  const client = {
    from: query,
    rpc: vi.fn(async (name: string, args?: unknown) => {
      rpcCalls.push({ name, args })
      return { data: rpcResults[name] ?? null, error: null }
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: unknown) => {
          uploads.push({ bucket, path, body })
          return { data: { path }, error: null }
        },
        remove: async (paths: string[]) => {
          removed.push({ bucket, paths })
          return { data: [], error: null }
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${bucket}/${path}` } }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://cdn/signed/${bucket}/${path}` }, error: null }),
      }),
    },
    functions: {
      invoke: async (name: string, options?: { body?: unknown }) => {
        invocations.push({ name, body: options?.body })
        return failures.invoke
          ? { data: null, error: { message: failures.invoke } }
          : { data: invokeResult, error: null }
      },
    },
    auth: {
      getSession: async () => ({ data: { session }, error: sessionError }) as { data: { session: typeof session }; error: typeof sessionError },
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        listener = cb
        return { data: { subscription: { unsubscribe: () => (listener = null) } } }
      },
      signInWithPassword: vi.fn(async (_: { email: string; password: string }) => ({ data: { session: null }, error: null as { message: string } | null })),
      signUp: vi.fn(async (_: unknown) => ({ data: { session: null, user: { id: 'u1' } }, error: null as { message: string } | null })),
      verifyOtp: vi.fn(async (_: { email: string; token: string; type: string }) => ({ data: { session: null }, error: null as { message: string } | null })),
      resend: vi.fn(async (_: { type: string; email: string }) => ({ data: {}, error: null as { message: string } | null })),
      resetPasswordForEmail: vi.fn(async (_: string, __?: unknown) => ({ data: {}, error: null as { message: string } | null })),
      updateUser: vi.fn(async (_: unknown) => ({ data: {}, error: null as { message: string } | null })),
      signOut: vi.fn(async () => {
        session = null
        listener?.('SIGNED_OUT', null)
        return { error: null }
      }),
    },
  }

  return {
    client,
    tables,
    rpcResults,
    rpcCalls,
    uploads,
    removed,
    failures,
    invocations,
    signIn(id = 'u1', createdAt?: string) {
      session = { user: { id, email: 'a@b.it', created_at: createdAt } }
      listener?.('SIGNED_IN', session)
    },
    /** La sessione sparisce senza notifiche, come quando il token scade e manca la rete. */
    signOutSilently() {
      session = null
    },
    setSessionError(error: { name: string; message: string } | null) {
      sessionError = error
    },
    setInvokeResult(result: unknown) {
      invokeResult = result
    },
    emit(event: string) {
      listener?.(event, session)
    },
  }
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>
