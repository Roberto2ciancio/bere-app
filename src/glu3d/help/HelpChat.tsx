import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GUIDE, PAGE_TIPS } from './guide'
import { searchGuide, type GuideEntry } from './search'

export type HelpPage = 'home' | 'storico' | 'classifica' | 'profilo'

export const HELP_MAX_CHARS = 200

type Draft =
  | { from: 'user'; text: string }
  | { from: 'glu'; kind: 'answer'; entry: GuideEntry; more: GuideEntry[] }
  | { from: 'glu'; kind: 'unsure'; options: GuideEntry[] }
  | { from: 'glu'; kind: 'none' }
type Msg = Draft & { id: number }

const byId = (id: string) => GUIDE.find((e) => e.id === id)

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/** Viewport visibile: con la tastiera aperta è più basso della finestra. null: vale il CSS. */
function readView(): { h: number; top: number } | null {
  const vv = typeof window === 'undefined' ? undefined : window.visualViewport
  return vv ? { h: Math.round(vv.height), top: Math.round(vv.offsetTop) } : null
}

/** 'navigate': la chat si chiude perché si va a un'altra schermata («Portami lì», «Suggerimenti»). */
export type HelpCloseReason = 'navigate'

/**
 * La chat di Glu: un foglio dal basso che cerca nella guida scritta a mano (niente rete, niente salvataggi:
 * la conversazione vive finché il foglio è aperto).
 */
export function HelpChat({ page, onClose }: { page: HelpPage; onClose: (reason?: HelpCloseReason) => void }) {
  const navigate = useNavigate()
  const titleId = useId()
  const input = useRef<HTMLInputElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  const nextId = useRef(1)
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [view, setView] = useState(readView)
  const tips = PAGE_TIPS[page].map(byId).filter((e): e is GuideEntry => !!e)

  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    // Il foglio sta ancora comparendo: senza preventScroll il browser proverebbe a portarlo in vista.
    input.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Sui telefoni la tastiera restringe solo il viewport visibile: il foglio lo segue.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setView(readView())
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // Tab e Maiusc+Tab girano dentro il dialogo.
  function trapTab(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // A ogni risposta la conversazione scorre fino all'ultima domanda: si legge la risposta dall'inizio.
  useEffect(() => {
    const box = log.current
    const asked = box?.querySelectorAll<HTMLElement>('.help-msg.from-user')
    const last = asked?.[asked.length - 1]
    if (!box || !last) return
    box.scrollTop += last.getBoundingClientRect().top - box.getBoundingClientRect().top - 8
  }, [msgs])

  function push(...list: Draft[]) {
    setMsgs((cur) => [...cur, ...list.map((m): Msg => ({ ...m, id: nextId.current++ }))])
  }

  function pick(entry: GuideEntry) {
    const more = searchGuide(entry.title, GUIDE).suggestions.filter((e) => e.id !== entry.id).slice(0, 2)
    push({ from: 'user', text: entry.title }, { from: 'glu', kind: 'answer', entry, more })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const q = text.trim()
    if (!q) return
    setText('')
    const { best, suggestions } = searchGuide(q, GUIDE)
    const reply: Draft = best
      ? { from: 'glu', kind: 'answer', entry: best, more: suggestions }
      : suggestions.length
        ? { from: 'glu', kind: 'unsure', options: suggestions }
        : { from: 'glu', kind: 'none' }
    push({ from: 'user', text: q }, reply)
  }

  function go(route: string) {
    navigate(route)
    onClose('navigate')
  }

  const chips = (list: GuideEntry[], label: string) => (
    <div className="help-chips" role="group" aria-label={label}>
      {list.map((e) => (
        <button key={e.id} type="button" className="help-chip" onClick={() => pick(e)}>
          {e.title}
        </button>
      ))}
    </div>
  )

  return (
    <div
      className="sheet-overlay help-overlay"
      style={view ? { top: view.top, bottom: 'auto', height: view.h } : undefined}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="sheet help-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={view ? { height: `min(34rem, ${view.h - 12}px)`, maxHeight: view.h - 12 } : undefined}
        onKeyDown={trapTab}
      >
        <div className="help-head">
          <h2 id={titleId}>Chiedi a Glu</h2>
          <button type="button" className="ghost help-close" aria-label="Chiudi" onClick={() => onClose()}>
            ✕
          </button>
        </div>
        <div ref={log} className="help-log" role="log" aria-live="polite">
          <div className="help-msg from-glu">
            <p>Ciao! Chiedimi come si fa qualcosa nell'app.</p>
            {chips(tips, 'Suggerimenti')}
          </div>
          {msgs.map((m) => {
            if (m.from === 'user') {
              return (
                <div key={m.id} className="help-msg from-user">
                  <p>{m.text}</p>
                </div>
              )
            }
            if (m.kind === 'answer') {
              return (
                <div key={m.id} className="help-msg from-glu">
                  <p className="help-topic">{m.entry.title}</p>
                  <ol>
                    {m.entry.answer.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {m.entry.route && (
                    <button type="button" className="primary help-go" onClick={() => go(m.entry.route!)}>
                      Portami lì
                    </button>
                  )}
                  {m.more.length > 0 && (
                    <>
                      <p className="help-more">Forse cercavi</p>
                      {chips(m.more, 'Forse cercavi')}
                    </>
                  )}
                </div>
              )
            }
            if (m.kind === 'unsure') {
              return (
                <div key={m.id} className="help-msg from-glu">
                  <p>Non sono sicuro di aver capito. Intendevi:</p>
                  {chips(m.options, 'Intendevi')}
                </div>
              )
            }
            return (
              <div key={m.id} className="help-msg from-glu">
                <p>
                  Non lo so ancora. Puoi scriverlo nei{' '}
                  <Link to="/feedback" onClick={() => onClose('navigate')}>
                    Suggerimenti
                  </Link>
                </p>
              </div>
            )
          })}
        </div>
        <form className="help-form" onSubmit={submit}>
          <input
            ref={input}
            type="text"
            aria-label="La tua domanda"
            placeholder="Scrivi una domanda…"
            enterKeyHint="send"
            maxLength={HELP_MAX_CHARS}
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="primary">
            Invia
          </button>
        </form>
      </div>
    </div>
  )
}
