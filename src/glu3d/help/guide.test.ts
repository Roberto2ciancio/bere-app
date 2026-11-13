import { describe, expect, it } from 'vitest'
import { GUIDE, PAGE_TIPS } from './guide'
import { MIN_SCORE, normalize, rankGuide, searchGuide } from './search'

// Rotte dichiarate in src/App.tsx (copiate qui: se App.tsx cambia, va aggiornata anche questa lista).
const ROUTES = ['/home', '/classifica', '/storico', '/storico/calendario', '/tazze', '/profilo', '/profilo/obiettivo', '/profilo/avvisi', '/profilo/bevute', '/profilo/aspetto', '/profilo/account', '/profilo/aiuto', '/promemoria', '/notifiche', '/feedback', '/privacy', '/novita', '/segnala']

// Frasi scritte diversamente dalle `questions`: sinonimi, errori comuni, frasi lunghe.
const REAL: [string, string][] = [
  ['vorrei abbassare la quantità di acqua giornaliera', 'goal-change'],
  ['ho sbagliato obiettivo, come lo modifico', 'goal-change'],
  ['quanta acqua dovrei bere in base al mio peso', 'goal-calc'],
  ['mi serve un calcolo automatico dei litri giusti per me', 'goal-calc'],
  ["con il caldo l'app mi aumenta l'obiettivo?", 'goal-heat'],
  ['come faccio ad avere più acqua quando ci sono 30 gradi', 'goal-heat'],
  ['ho fatto palestra oggi, dove lo scrivo', 'workout'],
  ['sono andato a correre e voglio più obiettivo', 'workout'],
  ['dove tocco per segnare che ho bevuto un bicchiere', 'drink-log'],
  ["registrare l'acqua appena bevuta", 'drink-log'],
  ['il bicchiere che uso è da 300 ml, come lo imposto', 'drink-amount'],
  ['cambiare i millilitri del pulsante ho bevuto', 'drink-amount'],
  ['ho bevuto una birra, come la segno', 'drink-other'],
  ['voglio segnare un succo di frutta e non acqua', 'drink-other'],
  ['ho toccato ho bevuto per errore', 'drink-undo'],
  ['ho premuto due volte per sbaglio, annullare', 'drink-undo'],
  ['cancellare una bevuta di ieri', 'drink-remove'],
  ['elimina una bevuta segnata alle 10 stamattina', 'drink-remove'],
  ["mi sono dimenticato di segnare l'acqua di ieri", 'drink-past'],
  ['inserire una bevuta in un altro giorno', 'drink-past'],
  ['creare una bottiglia da 750 ml', 'cups'],
  ['voglio aggiungere la mia borraccia', 'cups'],
  ['come inserisco una bevanda mia tipo la tisana', 'custom-drinks'],
  ["il tè conta meno dell'acqua?", 'hydration-pct'],
  ['perché il caffè idrata di meno', 'hydration-pct'],
  ['come registro un caffè', 'coffee'],
  ['ho preso un espresso', 'coffee'],
  ['quanta caffeina posso assumere al giorno', 'caffeine-limit'],
  ['mi dice che ho superato il limite di caffeina', 'caffeine-limit'],
  ['ho segnato la bevuta ma ero senza internet', 'offline-drink'],
  ['senza connessione funziona lo stesso', 'offline-drink'],
  ["posso segnare l'acqua dall'icona senza aprire l'app", 'shortcuts'],
  ["tenere premuto l'icona sul telefono", 'shortcuts'],
  ['mi dice sei indietro di 400 ml, cosa vuol dire', 'home-pace'],
  ['perché mi dice che sono in linea', 'home-pace'],
  ["che cos'è quel personaggio che si riempie d'acqua", 'glu-fill'],
  ['voglio che il telefono mi avvisi ogni ora di bere', 'reminders-create'],
  ['come imposto una sveglia per ricordarmi di bere', 'reminders-create'],
  ['scegliere io gli orari dei promemoria', 'reminders-manual'],
  ['aggiungere un orario specifico alle 15:30', 'reminders-manual'],
  ['voglio spegnere un programma senza cancellarlo', 'reminders-manage'],
  ['mi arrivano due notifiche uguali', 'reminders-manage'],
  ['non voglio notifiche di notte, solo dalle 8 alle 20', 'reminders-hours'],
  ['limitare gli avvisi a certe ore', 'reminders-hours'],
  ["posso rimandare il promemoria di un quarto d'ora", 'reminders-snooze'],
  ['ricordamelo più tardi', 'reminders-snooze'],
  ['a cosa servono gli orari che imparano', 'reminders-learned'],
  ["l'app mi propone orari dove di solito bevo", 'reminders-learned'],
  ['sono in vacanza, voglio sospendere i messaggi', 'pause'],
  ['sto male e non voglio perdere la serie', 'pause'],
  ['come faccio a ricevere gli avvisi', 'push-on'],
  ['abilitare le notifiche push', 'push-on'],
  ['basta notifiche, voglio disattivarle', 'push-off'],
  ['non mi arriva nessuna notifica', 'push-problems'],
  ['come provo se le notifiche funzionano', 'push-problems'],
  ['mettere i pulsanti 200 e 500 ml nella notifica', 'push-amounts'],
  ["voglio smettere di ricevere promemoria quando ho raggiunto l'obiettivo", 'push-stop'],
  ['voglio bloccare gli sproni che mi arrivano dagli amici', 'push-friends'],
  ["non voglio più sapere quando un amico raggiunge l'obiettivo", 'push-friends'],
  ['come tolgo il resoconto del lunedì', 'push-summary'],
  ['riepilogo della sera', 'push-summary'],
  ['su iphone non mi arrivano le notifiche', 'iphone'],
  ['devo aggiungere alla schermata home per avere le notifiche', 'iphone'],
  ["come metto bere sul telefono come un'app", 'install'],
  ["come si scarica l'app", 'install'],
  ['chi vince nella classifica', 'board-how'],
  ['come si decide il primo posto', 'board-how'],
  ['voglio dare una spinta a un amico', 'board-poke'],
  ["come faccio i complimenti a chi ha raggiunto l'obiettivo", 'board-cheer'],
  ['come faccio a salire di livello', 'levels'],
  ['cosa significa il numero accanto al nome', 'levels'],
  ['vedere il grafico dei giorni', 'history-chart'],
  ['come vedo quanto ho bevuto la settimana scorsa', 'history-chart'],
  ['guardare il mese intero', 'history-calendar'],
  ["statistiche dell'anno", 'history-calendar'],
  ['cosa sono le sfide', 'challenges'],
  ['quali premi posso ottenere', 'achievements'],
  ['i badge che ho sbloccato', 'achievements'],
  ["quanti giorni di fila ho raggiunto l'obiettivo", 'streak'],
  ['ho saltato un giorno e la serie non si è rotta', 'streak-saver'],
  ["cos'è il jolly settimanale", 'streak-saver'],
  ["voglio cambiare come mi chiamo nell'app", 'name'],
  ["mettere la mia faccia al posto dell'avatar", 'photo'],
  ['cambiare lo sfondo con una mia immagine', 'background'],
  ['voglio vedere le once invece dei litri', 'units'],
  ['voglio un rumore diverso quando bevo', 'sound'],
  ['Glu mi disturba con le tremarelle', 'glu-calm'],
  ['spegnere il 3d per consumare meno batteria', 'glu-3d'],
  ['modalità notte', 'dark'],
  ['voglio un backup dei miei dati', 'backup'],
  ['scaricare le bevute in excel', 'backup'],
  ['ho scordato la mia password', 'password'],
  ['come cambio la mia password', 'password'],
  ["disconnettermi dall'account", 'signout'],
  ['voglio cancellare per sempre il mio profilo', 'delete'],
  ['quali dati personali avete di me', 'privacy'],
  ["ho un'idea per migliorare l'app", 'feedback'],
  ['una foto in classifica è offensiva', 'report'],
  ["dove leggo le novità dell'app", 'news'],
  ["cosa c'è di nuovo nell'ultima versione", 'news'],
  // Ondata finale: le domande più semplici sulla bevuta e sulla serie.
  ['come aggiungo acqua', 'drink-log'],
  ['bevuta', 'drink-log'],
  ['quanta acqua devo bere', 'goal-calc'],
  ['come funziona la serie', 'streak'],
  ['quanta caffeina posso bere', 'caffeine-limit'],
  ['quanta acqua ha un caffè', 'hydration-pct'],
  ['quanto caffè posso bere al giorno', 'caffeine-limit'],
]

describe('GUIDE', () => {
  it('ha almeno 40 voci con id unici', () => {
    expect(GUIDE.length).toBeGreaterThanOrEqual(40)
    expect(new Set(GUIDE.map((e) => e.id)).size).toBe(GUIDE.length)
  })

  it('ogni voce ha 3-6 domande, 1-5 passi, titolo e parole chiave', () => {
    for (const e of GUIDE) {
      expect(e.title.trim(), e.id).not.toBe('')
      expect(e.questions.length, `${e.id} questions`).toBeGreaterThanOrEqual(3)
      expect(e.questions.length, `${e.id} questions`).toBeLessThanOrEqual(6)
      expect(e.answer.length, `${e.id} answer`).toBeGreaterThanOrEqual(1)
      expect(e.answer.length, `${e.id} answer`).toBeLessThanOrEqual(5)
      expect(e.keywords.length, `${e.id} keywords`).toBeGreaterThan(0)
    }
  })

  it('ogni route è una rotta di App.tsx', () => {
    for (const e of GUIDE) if (e.route) expect(ROUTES, e.id).toContain(e.route)
  })

  it('i percorsi «Profilo» › «…» usano i nomi delle sei voci del Profilo', () => {
    const sections = ['Obiettivo', 'Promemoria e notifiche', 'Bevute e tazze', 'Aspetto e Glu', 'Account e privacy', 'Aiuto e suggerimenti']
    const wrong: string[] = []
    for (const e of GUIDE) {
      for (const step of e.answer) {
        if (/«Profilo», sezione|scheda «Profilo»|nel «Profilo»/.test(step)) wrong.push(`${e.id}: «${step}»`)
        for (const m of step.matchAll(/«Profilo» › «([^»]+)»/g)) if (!sections.includes(m[1])) wrong.push(`${e.id}: ${m[1]}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('chi apre una voce del Profilo porta alla sua pagina (o a una pagina raggiunta da lì)', () => {
    const pages: Record<string, string[]> = {
      Obiettivo: ['/profilo/obiettivo'],
      'Promemoria e notifiche': ['/profilo/avvisi', '/promemoria', '/notifiche'],
      'Bevute e tazze': ['/profilo/bevute', '/tazze'],
      'Aspetto e Glu': ['/profilo/aspetto'],
      'Account e privacy': ['/profilo/account', '/privacy'],
      'Aiuto e suggerimenti': ['/profilo/aiuto', '/feedback', '/novita', '/segnala'],
    }
    const wrong: string[] = []
    for (const e of GUIDE) {
      const m = /^Apri «Profilo» › «([^»]+)»/.exec(e.answer[0])
      if (m && !pages[m[1]]?.includes(e.route ?? '')) wrong.push(`${e.id}: ${m[1]} → ${e.route}`)
    }
    expect(wrong).toEqual([])
  })

  it('ogni domanda di ogni voce porta a quella voce', () => {
    const failures: string[] = []
    for (const e of GUIDE) {
      for (const q of e.questions) {
        const got = searchGuide(q, GUIDE).best?.id ?? null
        if (got !== e.id) failures.push(`«${q}» → ${got} (atteso ${e.id})`)
      }
    }
    expect(failures).toEqual([])
  })

  it('almeno 40 frasi reali, scritte a parte, portano alla voce giusta', () => {
    expect(REAL.length).toBeGreaterThanOrEqual(40)
    const ids = new Set(GUIDE.map((e) => e.id))
    const own = new Set(GUIDE.flatMap((e) => e.questions.map((q) => q.toLowerCase())))
    const failures: string[] = []
    for (const [phrase, id] of REAL) {
      expect(ids.has(id), `id ${id} inesistente`).toBe(true)
      if (own.has(phrase.toLowerCase())) failures.push(`«${phrase}» è già una question`)
      const got = searchGuide(phrase, GUIDE).best?.id ?? null
      if (got !== id) failures.push(`«${phrase}» → ${got} (atteso ${id})`)
    }
    expect(failures).toEqual([])
  })

  it('frasi senza senso o fuori tema: nessuna risposta sicura', () => {
    const wrong = ['xyz qwerty', 'ricetta della pizza margherita', 'chi ha vinto la partita di calcio', 'asdf jkl', 'che tempo fa domani a Roma', 'qual è la capitale della Francia', 'raccontami una barzelletta']
      .filter((q) => searchGuide(q, GUIDE).best !== null)
    expect(wrong).toEqual([])
  })

  it('i passi non sono vuoti', () => {
    for (const e of GUIDE) for (const step of e.answer) expect(step.trim().length, e.id).toBeGreaterThan(5)
  })
})

describe('PAGE_TIPS', () => {
  it('ogni pagina ha 4 suggerimenti che puntano a voci esistenti', () => {
    const ids = new Set(GUIDE.map((e) => e.id))
    for (const page of ['home', 'storico', 'classifica', 'profilo'] as const) {
      expect(PAGE_TIPS[page], page).toHaveLength(4)
      for (const id of PAGE_TIPS[page]) expect(ids.has(id), `${page}: ${id}`).toBe(true)
    }
  })
})

describe('affinamenti di ricerca', () => {
  it('«metà» non si confonde con «obiettivo»', () => {
    expect(normalize('metà')).not.toEqual(normalize('obiettivo'))
  })
  it('tema scuro e modalità notte trovano la stessa voce', () => {
    expect(searchGuide('tema scuro', GUIDE).best?.id).toBe('dark')
    expect(searchGuide('modalità notte', GUIDE).best?.id).toBe('dark')
  })
})

describe('fix round 1: suggerimenti vicini e pulizie', () => {
  it("«come cambio l'obiettivo»: niente argomenti scollegati in «Forse cercavi»", () => {
    const r = searchGuide("come cambio l'obiettivo", GUIDE)
    expect(r.best?.id).toBe('goal-change')
    const ids = r.suggestions.map((s) => s.id)
    expect(ids).not.toContain('signout')
    expect(ids).not.toContain('news')
  })
  it('«cosa vuol dire almeno metà nel calendario» non risponde col cambio obiettivo', () => {
    expect(searchGuide('cosa vuol dire almeno metà nel calendario', GUIDE).best?.id).not.toBe('goal-change')
  })
  it('nessuna domanda ripetuta nella stessa voce', () => {
    for (const e of GUIDE) expect(new Set(e.questions).size, e.id).toBe(e.questions.length)
  })
  it('ogni suggerimento vale almeno metà soglia e il 35% del primo', () => {
    for (const q of ["come cambio l'obiettivo", 'notifiche', 'serie', 'tazza', 'promemoria', 'caffè']) {
      const ranked = rankGuide(q, GUIDE)
      if (!ranked.length) continue
      const floor = Math.max(MIN_SCORE * 0.5, ranked[0].score * 0.35)
      const score = new Map(ranked.map((r) => [r.entry.id, r.score]))
      for (const s of searchGuide(q, GUIDE).suggestions) expect(score.get(s.id)!, `${q}: ${s.id}`).toBeGreaterThanOrEqual(floor)
    }
  })
})

describe('ondata finale: niente argomenti fuori tema', () => {
  const ids = (q: string) => searchGuide(q, GUIDE).suggestions.map((s) => s.id)
  it('«acqua» da sola: nessuna risposta sicura, propone il calcolo dell\'obiettivo', () => {
    const r = searchGuide('acqua', GUIDE)
    expect(r.best).toBeNull()
    expect(r.suggestions.map((s) => s.id)).toContain('goal-calc')
  })
  it('«ieri ho dimenticato di segnare»: bevuta passata, nessuna password', () => {
    expect(searchGuide('ieri ho dimenticato di segnare', GUIDE).best?.id).toBe('drink-past')
    expect(ids('ieri ho dimenticato di segnare')).not.toContain('password')
  })
  it('«voglio meno promemoria»: prima i promemoria, non l\'obiettivo', () => {
    const r = searchGuide('voglio meno promemoria', GUIDE)
    const first = r.best ?? r.suggestions[0]
    expect(first.id).toBe('reminders-manage')
  })
  it('«cancella account»: cancellare il profilo, senza «Annullare l\'ultima bevuta»', () => {
    expect(searchGuide('cancella account', GUIDE).best?.id).toBe('delete')
    expect(ids('cancella account')).not.toContain('drink-undo')
  })
  it('«come funziona la serie» stacca la classifica', () => {
    const r = searchGuide('come funziona la serie', GUIDE)
    expect(r.best?.id).toBe('streak')
    expect(ids('come funziona la serie')).not.toContain('board-how')
  })
})