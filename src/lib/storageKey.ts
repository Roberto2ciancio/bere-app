/** App vera e app di prova stanno sullo stesso sito: senza prefisso si leggerebbero i dati a vicenda. */
export const storagePrefix = (mode: string) => (mode === 'devapp' ? 'dev.' : '')

export const storageKey = (key: string) => storagePrefix(import.meta.env.MODE) + key
