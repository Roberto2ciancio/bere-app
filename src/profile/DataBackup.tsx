import { useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { exportData, restoreData, toCsv } from './backup'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function DataBackup() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(work: () => Promise<string>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setMessage(await work())
    } catch (failure) {
      setError(failure instanceof Error && failure.message.includes('copia') ? failure.message : 'Operazione non riuscita. Controlla la connessione e riprova')
    }
    setBusy(false)
  }

  const today = new Date().toISOString().slice(0, 10)

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return
    await run(async () => {
      let backup: unknown
      try {
        backup = JSON.parse(await file.text())
      } catch {
        throw new Error('Questo file non è una copia valida di Bere')
      }
      const added = await restoreData(userId, backup)
      return `Ripristino completato: ${added.drinks} bevute, ${added.caffeine} caffeina, ${added.cups} tazze e ${added.drinkTypes} bevande aggiunte.`
    })
  }

  return (
    <details className="fold">
      <summary>Copia e ripristino dei dati</summary>
      <div className="fold-body">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void run(async () => {
            download(`bere-copia-${today}.json`, JSON.stringify(await exportData(userId ?? ''), null, 2), 'application/json')
            return 'Copia scaricata.'
          })}
        >
          Scarica copia (JSON)
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void run(async () => {
            download(`bere-bevute-${today}.csv`, toCsv((await exportData(userId ?? '')).drinks), 'text/csv')
            return 'File scaricato.'
          })}
        >
          Scarica bevute (CSV)
        </button>
        <label className="interval-field">
          Ripristina da una copia
          <input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => void restore(e)} />
        </label>
        <p className="hint">Il ripristino aggiunge bevute, caffeina, tazze e bevande che mancano, senza duplicarle. Non cambia programmi e obiettivi.</p>
        {error && <p role="alert" className="error">{error}</p>}
        {message && <p role="status" className="hint">{message}</p>}
      </div>
    </details>
  )
}
