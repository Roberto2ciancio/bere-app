export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * Condivide l'immagine (WhatsApp, Instagram… dal menu del telefono) dove si possono condividere file;
 * altrimenti la scarica. Se chi condivide chiude il menu: «cancelled». Gli altri errori passano a chi chiama.
 */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: 'La mia settimana di acqua, segnata con Bere.' })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      throw error
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Il download parte subito: si libera la memoria poco dopo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
