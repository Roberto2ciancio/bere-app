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
    version: '1.9.1',
    date: '2026-11-11',
    title: 'Arriva Glu',
    notes: [
      'Glu, una goccia d’acqua, ti tiene compagnia nella Home: cambia umore durante la giornata e dice la sua nel fumetto.',
      'Glu si riempie d’acqua man mano che bevi.',
      'Quando raggiungi l’obiettivo c’è la festa, con i coriandoli (se hai «riduci movimento», niente coriandoli).',
      'Puoi sceglierlo, o tornare agli stili di prima, in Profilo › Aspetto.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-11-10',
    title: 'Nuova grafica',
    notes: [
      'Colori nuovi e più vivaci, bottoni più morbidi e card rinnovate in tutta l’app.',
      'Il tema chiaro o scuro segue quello del telefono. Gli stili Anello e Gocce non cambiano più i colori dell’app.',
      'Animazioni nuove: numeri che salgono e cambi di pagina più fluidi.',
      'Se sul telefono hai attivato «riduci movimento», l’app non anima più nulla.',
    ],
  },
  {
    version: '1.8.2',
    date: '2026-11-10',
    title: 'Livelli e punti',
    notes: [
      "Ora guadagni punti: 1 ogni 100 ml fino all'obiettivo, +20 per ogni giorno a obiettivo, +50 per una settimana con almeno 5 giorni e +150 se sono tutti e 7.",
      'Con i punti sali di livello, da Goccia 💧 a Oceano 🐋. Il tuo livello e quanto manca al prossimo sono nello Storico.',
      'In classifica, accanto al nome di ognuno, c’è il suo livello. I punti contano anche i giorni passati.',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-11-10',
    title: 'Caffè a 80 mg',
    notes: [
      'Un caffè torna a valere 80 mg di caffeina, il valore tipico di un espresso. I caffè già segnati restano come sono.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-11-10',
    title: 'Salva-serie e calendario',
    notes: [
      "Salva-serie: ogni settimana il primo giorno in cui non raggiungi l'obiettivo la serie non si rompe. Nello Storico vedi se l'hai già usato.",
      "Nuovo calendario, dallo Storico: ogni giorno del mese colorato per com'è andato (raggiunto, almeno metà, meno di metà, salva-serie, pausa).",
      "Statistiche del mese e dell'anno: giorni a obiettivo, totale, media, serie più lunga e giorno migliore. Nella vista Anno tocchi un mese per aprirlo.",
    ],
  },
  {
    version: '1.7.1',
    date: '2026-11-08',
    title: 'Notifiche su misura',
    notes: [
      "Nel Profilo puoi mettere nel promemoria «Bevuto 200 ml» e «Bevuto 500 ml», per segnare quanto hai bevuto davvero. Su Android prendono il posto di «Bevuto ✓» e «Tra 15 min».",
      "In Promemoria, Bere guarda quando bevi di solito e ti propone di aggiungere un promemoria agli orari in cui non ne ricevi. Basta un tocco, oppure «Non ora».",
    ],
  },
  {
    version: '1.7.0',
    date: '2026-11-07',
    title: 'Notifiche più furbe',
    notes: [
      "Nel promemoria c'è «Tra 15 min»: lo stesso promemoria torna un quarto d'ora dopo, fino a 3 volte. Se intanto segni la bevuta, non torna.",
      'Modalità pausa, dal Profilo: in vacanza o quando non stai bene niente notifiche per 1, 3, 7 o 14 giorni, e la serie non si rompe.',
      "Durante la pausa non arrivano neppure sproni, complimenti e riepiloghi. Puoi riprendere quando vuoi con «Riprendi adesso».",
    ],
  },
  {
    version: '1.6.1',
    date: '2026-11-06',
    title: 'Più solida',
    notes: [
      "Se qualcosa va storto, al posto dello schermo bianco compare «Ricarica l'app», e l'errore ci arriva in automatico per correggerlo.",
      'Con lo stile «gocce», sui telefoni piccoli le gocce si rimpiccioliscono invece di finire sopra il prossimo promemoria.',
      "L'aumento per il caldo non sparisce più se apri l'app mentre il profilo sta ancora caricando.",
    ],
  },
  {
    version: '1.6.0',
    date: '2026-11-06',
    title: "Scorciatoie dall'icona",
    notes: [
      "Tieni premuta l'icona di Bere: con «Ho bevuto» segni una bevuta, con «Caffè» un caffè, senza passare dall'app.",
      "Sull'app Android serve la nuova versione dell'APK; da Chrome su Android funziona da sola. Su iPhone le scorciatoie non sono disponibili.",
      'Sui telefoni più bassi la bottiglia non copre più il prossimo promemoria.',
    ],
  },
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
