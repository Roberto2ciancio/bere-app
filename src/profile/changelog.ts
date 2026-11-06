/**
 * Tutte le novità, dalla più recente. La prima voce è la versione attuale (deve coincidere con package.json):
 * si leggono nella Newsletter e, dopo un aggiornamento, nel popup delle novità.
 * Le versioni 0.x sono state ricostruite dalla storia del progetto.
 */
export interface Release {
  version: string
  date: string
  title: string
  notes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: '1.5.0',
    date: '2026-11-06',
    title: 'Più motivazione',
    notes: [
      "L'obiettivo si adatta: nel Profilo accendi «Più acqua nei giorni caldi» e scegli la tua città (+250, +500 o +750 ml in base alla massima di oggi).",
      "Nella schermata Oggi c'è «Ho fatto allenamento»: aggiunge 500 ml all'obiettivo del giorno.",
      'Riepilogo serale: se la giornata è andata male ti arriva un riassunto, con un invito a recuperare domani.',
      'Ogni lunedì il resoconto della settimana: media, giorni a obiettivo e posto in classifica.',
      'Nuove sfide: «Tutti i 7 giorni senza saltare» e «Caffeina sotto i 200 mg ogni giorno della settimana».',
      'Nuovo traguardo: «Mai sotto metà», 30 giorni di fila sempre sopra metà obiettivo.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-11-06',
    title: 'Complimenti e promemoria su misura',
    notes: [
      "Quando un amico raggiunge l'obiettivo del giorno ti arriva un avviso: con «👏 Complimenti» glielo fai sapere, dalla notifica o dalla Classifica.",
      "Se raggiungi tu l'obiettivo, gli amici vengono avvisati e possono farti i complimenti.",
      "Se non apri l'app da un giorno, ti arriva un promemoria con il tuo nome e il tuo obiettivo. Poi dopo 3 e 7 giorni, e basta.",
      'Mai di notte. Nel Profilo, in «Promemoria e notifiche», puoi spegnere ciascun avviso.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-06',
    title: 'Arriva la Newsletter',
    notes: [
      "Nuova sezione Newsletter: tocca l'icona in alto a sinistra nella schermata Oggi per leggere tutte le novità, versione per versione.",
      'Un pallino sull\'icona ti avvisa quando ci sono novità che non hai ancora letto.',
      'Le novità non sono più nel Profilo: le trovi tutte nella Newsletter.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-11-06',
    title: 'Novità a portata di mano',
    notes: [
      'Dopo un aggiornamento compare un riepilogo delle novità.',
      'Su iPhone, con la fascia attiva, la bottiglia non copre più il prossimo promemoria.',
      'Il riquadro della fascia attiva è più compatto.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-06',
    title: 'Bevi direttamente dalla notifica',
    notes: [
      "Nelle notifiche dei promemoria c'è «Bevuto ✓»: segna la bevuta senza aprire l'app.",
      "Nel Profilo trovi la versione dell'app.",
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-06',
    title: 'Bere diventa un\'app Android',
    notes: [
      'Bere si installa anche come app Android.',
      "Fascia attiva: l'obiettivo si divide sulle ore in cui sei sveglio, e l'app ti dice se sei in linea, indietro o avanti.",
      'Un caffè vale 20 mg di caffeina.',
      'Nuove pagine Oggi, Storico, Classifica e Profilo, pensate per il telefono.',
      "Puoi spronare la stessa persona al massimo una volta all'ora.",
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-01',
    title: 'Molto più di un promemoria',
    notes: [
      'Tipi di bevanda e tazze personalizzate, ognuna con quanto idrata.',
      'Storico con grafico, statistiche, sfide della settimana e traguardi.',
      "Calcolatore dell'obiettivo, litri o once, copia e ripristino dei dati.",
      'Classifica settimanale con «Sprona» per ricordare a un amico di bere.',
      'Nuovi stili della home: anello, gocce e personaggi.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-01',
    title: 'Nasce Bere',
    notes: [
      'Prima versione: obiettivo giornaliero, promemoria con notifiche e un tocco per segnare cosa bevi.',
      'Funziona anche senza rete: le bevute partono appena torna il segnale.',
      'Puoi spegnere le notifiche su un singolo dispositivo.',
    ],
  },
]
