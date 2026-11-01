// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { deleteAccount, handleDelete, type DeleteDeps } from './core.ts'

function deps(over: Partial<DeleteDeps> = {}) {
  const steps: string[] = []
  const value: DeleteDeps = {
    userFromToken: async (token) => (token === 'valido' ? 'u1' : null),
    listFiles: async (bucket, userId) => [`${userId}/${bucket}.jpg`],
    removeFiles: async (bucket, paths) => {
      steps.push(`files:${bucket}:${paths.join()}`)
    },
    deleteUser: async (userId) => {
      steps.push(`user:${userId}`)
    },
    ...over,
  }
  return { value, steps }
}

const request = (token?: string, body?: unknown, method = 'POST') =>
  new Request('https://x/functions/v1/delete-account', {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  })

describe('deleteAccount', () => {
  it('rimuove prima i file dell\'utente, poi l\'utente', async () => {
    const { value, steps } = deps()
    await deleteAccount(value, 'u1')
    expect(steps).toEqual(['files:avatars:u1/avatars.jpg', 'files:backgrounds:u1/backgrounds.jpg', 'user:u1'])
  })

  it('senza file non chiama la rimozione', async () => {
    const { value, steps } = deps({ listFiles: async () => [] })
    await deleteAccount(value, 'u1')
    expect(steps).toEqual(['user:u1'])
  })

  it('se la rimozione dei file fallisce non cancella l\'utente', async () => {
    const { value, steps } = deps({
      removeFiles: async () => {
        throw new Error('storage')
      },
    })
    await expect(deleteAccount(value, 'u1')).rejects.toThrow('storage')
    expect(steps).toEqual([])
  })
})

describe('handleDelete', () => {
  it('senza JWT risponde 401', async () => {
    const { value, steps } = deps()
    expect((await handleDelete(request(), value)).status).toBe(401)
    expect(steps).toEqual([])
  })

  it('con JWT non valido risponde 401', async () => {
    const { value, steps } = deps()
    expect((await handleDelete(request('falso'), value)).status).toBe(401)
    expect(steps).toEqual([])
  })

  it('ignora un id passato nel corpo della richiesta', async () => {
    const { value, steps } = deps()
    expect((await handleDelete(request('valido', { userId: 'vittima' }), value)).status).toBe(200)
    expect(steps).toContain('user:u1')
    expect(steps).not.toContain('user:vittima')
  })

  it('un errore risponde 500', async () => {
    const { value } = deps({
      deleteUser: async () => {
        throw new Error('auth')
      },
    })
    expect((await handleDelete(request('valido'), value)).status).toBe(500)
  })
})
