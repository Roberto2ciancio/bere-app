import { supabase } from '../lib/supabase'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const AVATAR_SIDE = 512
export const BACKGROUND_SIDE = 1600

export type ImageBucket = 'avatars' | 'backgrounds'

export interface ImageTools {
  decode(file: File): Promise<{ width: number; height: number; source: CanvasImageSource }>
  encode(source: CanvasImageSource, width: number, height: number): Promise<Blob>
}

const browserTools: ImageTools = {
  async decode(file) {
    const bitmap = await createImageBitmap(file)
    return { width: bitmap.width, height: bitmap.height, source: bitmap }
  },
  encode(source, width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')?.drawImage(source, 0, 0, width, height)
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('conversione non riuscita'))), 'image/jpeg', 0.85)
    })
  },
}

export async function prepareImage(file: File, maxSide: number, tools: ImageTools = browserTools): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error("Il file scelto non è un'immagine")
  let decoded
  try {
    decoded = await tools.decode(file)
  } catch {
    throw new Error('Non riesco a leggere questa immagine. Prova con un JPG o un PNG')
  }
  const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height))
  const blob = await tools.encode(decoded.source, Math.round(decoded.width * scale), Math.round(decoded.height * scale))
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("L'immagine è troppo grande anche dopo la riduzione")
  return blob
}

export async function uploadImage(bucket: ImageBucket, userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error('Caricamento non riuscito. Controlla la connessione e riprova')
  return path
}

export async function removeImage(bucket: ImageBucket, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path])
}

export function avatarUrl(path: string): string {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function backgroundUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('backgrounds').createSignedUrl(path, 60 * 60 * 24 * 7)
  return data?.signedUrl ?? null
}
