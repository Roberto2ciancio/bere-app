// La guida di Glu, scritta a mano: ogni risposta descrive l'app com'è oggi, con i nomi esatti di schede,
// sezioni e pulsanti. Se cambia una schermata, cambia anche la voce qui (e il test in guide.test.ts).
// Le schede in basso sono: «Oggi», «Storico», «Classifica», «Profilo».

import { GLU_VARIANTS } from '../../mascot/variantsFlag'
import { NEW_PROFILE } from '../../profile/newProfile'
import type { GuideEntry } from './search'

/**
 * Una voce della guida. `legacy`: risposta e rotta del Profilo di sempre (una sola pagina), che vale
 * nell'app vera finché il Profilo nuovo (pagine per voce, NEW_PROFILE) è solo nell'app di prova.
 */
export interface GuideSource extends GuideEntry {
  legacy?: { answer: string[]; route?: string }
  /** `variants`: la voce c'è solo dove le varianti di Glu sono accese (GLU_VARIANTS, per ora solo l'app di prova). */
  onlyWhen?: 'variants'
}

/** Le voci nella forma del Profilo nuovo (app di prova). Per l'app usare activeGuide(). */
export const GUIDE: GuideSource[] = [
  // --- Obiettivo ---
  {
    id: 'goal-change',
    title: "Cambiare l'obiettivo",
    questions: [
      "come cambio l'obiettivo",
      'voglio bere meno al giorno',
      'come aumento la quantità di acqua giornaliera',
      "dove si imposta l'obiettivo",
      "modificare l'obiettivo giornaliero",
    ],
    keywords: ['giornaliero', 'litri', 'abbassare', 'alzare', 'aumentare', 'diminuire', 'impostare', 'meno', 'al giorno', 'quantità', 'modificare'],
    answer: [
      'Apri «Profilo» › «Obiettivo».',
      'Scrivi i litri nel campo «Obiettivo giornaliero (litri)»: da 0,1 a 10.',
      'Tocca «Salva obiettivo». Vale da domani.',
      'Con un obiettivo sotto 1,5 L non entri in classifica.',
    ],
    route: '/profilo/obiettivo',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» e vai alla sezione «Obiettivo».",
        "Scrivi i litri nel campo «Obiettivo giornaliero (litri)»: da 0,1 a 10.",
        "Tocca «Salva obiettivo». Vale da domani.",
        "Con un obiettivo sotto 1,5 L non entri in classifica.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'goal-calc',
    title: "Calcolare l'obiettivo dal peso",
    questions: [
      "come calcolo l'obiettivo dal mio peso",
      'quanta acqua devo bere per il mio peso',
      "l'app può calcolarmi i litri giusti",
      "calcolatore dell'obiettivo",
    ],
    keywords: ['calcolare', 'calcolo', 'calcolalo', 'calcolatore', 'peso', 'kg', 'chili', 'suggerito', 'stima', 'attività', 'sedentaria', 'litri giusti', 'automatico', 'acqua', 'devo bere', 'quanto bere'],
    answer: [
      'Apri «Profilo» › «Obiettivo» e tocca «Calcolalo per me».',
      'Scrivi il tuo «Peso (kg)» e scegli l\'«Attività»: Sedentaria, Leggera, Moderata o Intensa.',
      'Spunta «Oggi fa caldo», oppure tocca «Controlla il meteo di oggi».',
      'Leggi il «Suggerito» e tocca «Usa questo obiettivo»; poi «Salva obiettivo» per confermarlo.',
      'È solo una stima, non un consiglio medico.',
    ],
    route: '/profilo/obiettivo',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Obiettivo», e tocca «Calcolalo per me».",
        "Scrivi il tuo «Peso (kg)» e scegli l'«Attività»: Sedentaria, Leggera, Moderata o Intensa.",
        "Spunta «Oggi fa caldo», oppure tocca «Controlla il meteo di oggi».",
        "Leggi il «Suggerito» e tocca «Usa questo obiettivo»; poi «Salva obiettivo» per confermarlo.",
        "È solo una stima, non un consiglio medico.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'goal-heat',
    title: 'Più acqua nei giorni caldi',
    questions: [
      "l'obiettivo sale quando fa caldo",
      'come attivo i giorni caldi',
      'voglio più acqua quando fa molto caldo',
      'aumento automatico con la temperatura',
    ],
    keywords: ['caldo', 'giorni caldi', 'temperatura', 'gradi', 'meteo', 'città', 'estate', 'afa', 'aumento', 'automatico'],
    answer: [
      'Apri «Profilo» › «Obiettivo» e trova «Giorni caldi».',
      'Attiva «Più acqua nei giorni caldi».',
      'Scegli la città: scrivila e tocca «Cerca», oppure tocca «Usa la mia posizione». Con «Cambia» la modifichi.',
      "Nei giorni caldi l'obiettivo sale: +250 ml dai 25 °C, +500 ml dai 30 °C, +750 ml dai 35 °C. Lo vedi nella scheda «Oggi».",
    ],
    route: '/profilo/obiettivo',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Obiettivo», e trova «Giorni caldi».",
        "Attiva «Più acqua nei giorni caldi».",
        "Scegli la città: scrivila e tocca «Cerca», oppure tocca «Usa la mia posizione». Con «Cambia» la modifichi.",
        "Nei giorni caldi l'obiettivo sale: +250 ml dai 25 °C, +500 ml dai 30 °C, +750 ml dai 35 °C. Lo vedi nella scheda «Oggi».",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'workout',
    title: "Segnare l'allenamento",
    questions: [
      "ho fatto allenamento, come lo segno",
      'mi sto allenando, dove lo segno',
      'dove segno lo sport',
      "togliere l'allenamento segnato",
    ],
    keywords: ['allenamento', 'allenarmi', 'allenare', 'sport', 'palestra', 'corsa', 'correre', 'workout', 'fitness', 'sudato', 'esercizio', 'obiettivo', 'oggi'],
    answer: [
      'Nella scheda «Oggi» tocca «Ho fatto allenamento»: +500 ml all\'obiettivo di oggi.',
      'Il riquadro diventa «Allenamento segnato». Toccalo di nuovo per toglierlo.',
    ],
    route: '/home',
  },

  // --- Segnare le bevute ---
  {
    id: 'drink-log',
    title: 'Segnare una bevuta',
    questions: [
      'come segno una bevuta',
      "dove segno l'acqua che ho bevuto",
      'come registro quello che bevo',
      "ho appena bevuto un bicchiere d'acqua",
      "come aggiungo l'acqua che ho bevuto",
    ],
    keywords: ['bicchiere', 'aggiungere', 'aggiungo', 'bevuta', 'segnare'],
    answer: [
      'Nella scheda «Oggi» tocca il pulsante grande «Ho bevuto», con la quantità scritta accanto.',
      "Il totale sale e Glu si riempie. Un secondo tocco subito dopo viene ignorato, per evitare doppioni.",
      'Per cambiare la quantità del pulsante vai su «Profilo» › «Bevute e tazze».',
    ],
    route: '/home',
    legacy: {
      answer: [
        "Nella scheda «Oggi» tocca il pulsante grande «Ho bevuto», con la quantità scritta accanto.",
        "Il totale sale e Glu si riempie. Un secondo tocco subito dopo viene ignorato, per evitare doppioni.",
        "Per cambiare la quantità del pulsante vai su «Profilo», sezione «Bevute».",
      ],
      route: "/home",
    },
  },
  {
    id: 'drink-amount',
    title: 'Cambiare la quantità per bevuta',
    questions: [
      'ml predefiniti del pulsante ho bevuto',
      'il mio bicchiere è più grande, dove lo imposto',
      'voglio segnare 300 ml a ogni tocco',
      'quantità predefinita per bevuta',
    ],
    keywords: ['quantità', 'millilitri', 'ml', 'predefinita', 'pulsante', 'grande', 'piccolo', '150', '250', '300', '500'],
    answer: [
      'Apri «Profilo» › «Bevute e tazze».',
      'In «Quantità per bevuta» scegli 150, 200, 250, 300 o 500 ml.',
      'Il pulsante «Ho bevuto» nella scheda «Oggi» userà quella quantità.',
    ],
    route: '/profilo/bevute',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» e vai alla sezione «Bevute».",
        "In «Quantità per bevuta» scegli 150, 200, 250, 300 o 500 ml.",
        "Il pulsante «Ho bevuto» nella scheda «Oggi» userà quella quantità.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'drink-other',
    title: 'Segnare un\'altra bevanda',
    questions: [
      "come segno un tè o un succo",
      'ho bevuto un succo invece dell\'acqua',
      'devo segnare una birra o un vino',
      "come scelgo un'altra bevanda o una quantità diversa",
    ],
    keywords: ['tè', 'latte', 'succo', 'bibita', 'birra', 'vino', 'frutta', 'spremuta', 'invece', 'segnare', 'bevuto'],
    answer: [
      'Nella scheda «Oggi» tocca il pulsante «+» accanto a «Ho bevuto»: si apre «Cosa hai bevuto?».',
      'Tocca una tazza (Bicchiere, Tazza, Bottiglia o le tue), oppure scegli la «Bevanda» e scrivi la «Quantità (ml)», da 1 a 2000.',
      'Tocca «Segna».',
    ],
    route: '/home',
  },
  {
    id: 'drink-undo',
    title: "Annullare l'ultima bevuta",
    questions: [
      "ho segnato una bevuta per sbaglio, come l'annullo",
      "come annullo l'ultima bevuta",
      'ho toccato due volte',
      "devo annullare l'ultima bevuta",
    ],
    keywords: ['annullare', 'annulla', 'ultima', 'sbaglio', 'errore', 'sbagliato', 'indietro', 'toccato', 'premuto', 'due volte'],
    answer: [
      "Nella scheda «Oggi», sopra «Ho bevuto», compare «Annulla l'ultima»: toccalo.",
      "Toglie l'ultima bevuta di oggi. Per una bevuta più vecchia usa lo «Storico».",
    ],
    route: '/home',
  },
  {
    id: 'drink-remove',
    title: 'Togliere una bevuta dallo Storico',
    questions: [
      'come tolgo una bevuta dallo storico',
      'voglio cancellare una bevuta di ieri',
      'eliminare una bevuta vecchia',
      "come correggo una quantità sbagliata",
    ],
    keywords: ['togliere', 'cancellare', 'eliminare', 'storico', 'ieri', 'vecchia', 'correggere', 'elenco', 'alle 10'],
    answer: [
      'Apri la scheda «Storico».',
      'Tocca la barra del giorno nel grafico (sono visibili 7 o 30 giorni); per oggi è già scelto.',
      "Nell'elenco del giorno tocca la ✕ accanto alla bevuta da togliere.",
    ],
    route: '/storico',
  },
  {
    id: 'drink-past',
    title: 'Aggiungere una bevuta a un giorno passato',
    questions: [
      'mi sono dimenticato di segnare una bevuta di ieri',
      'come aggiungo una bevuta a un altro giorno',
      'inserire una bevuta in un giorno passato',
      'posso aggiungere una bevuta in ritardo',
    ],
    keywords: ['passato', 'ieri', 'dimenticato', 'ritardo', 'altro giorno', 'recuperare', 'storico', 'vecchio', 'dimenticare'],
    answer: [
      'Apri la scheda «Storico» e tocca la barra del giorno nel grafico.',
      'Apri «Aggiungi una bevuta a questo giorno».',
      'Scegli la «Bevanda», scrivi la «Quantità (ml)» e tocca «Aggiungi a questo giorno».',
    ],
    route: '/storico',
  },
  {
    id: 'cups',
    title: 'Creare le tue tazze',
    questions: [
      'come creo una tazza mia',
      'voglio aggiungere la mia bottiglia',
      'come cambio le tazze del pulsante più',
      'aggiungere un bicchiere da 330 ml',
    ],
    keywords: ['tazza', 'tazze', 'bottiglia', 'borraccia', 'bicchiere', 'personalizzata', 'creare', 'creo', 'crea', 'aggiungere', 'tazze e bevande', 'capienza', '330', '750'],
    answer: [
      'Apri «Profilo» › «Bevute e tazze» › «Tazze e bevande».',
      'In «Le tue tazze» scrivi il «Nome della tazza» e i «Millilitri», scegli la bevanda e tocca «Aggiungi tazza».',
      "Con «Elimina» la togli. Senza tazze tue l'app propone Bicchiere, Tazza e Bottiglia.",
    ],
    route: '/tazze',
    legacy: {
      answer: [
        "Apri «Tazze e bevande»: dal «Profilo», sezione «Bevute».",
        "In «Le tue tazze» scrivi il «Nome della tazza» e i «Millilitri», scegli la bevanda e tocca «Aggiungi tazza».",
        "Con «Elimina» la togli. Senza tazze tue l'app propone Bicchiere, Tazza e Bottiglia.",
      ],
      route: "/tazze",
    },
  },
  {
    id: 'custom-drinks',
    title: 'Creare una bevanda personalizzata',
    questions: [
      'come creo una bevanda che non c\'è',
      'voglio creare una bevanda mia',
      'posso inserire la tisana o la spremuta',
      'bevande personalizzate',
    ],
    keywords: ['bevanda', 'bevande', 'personalizzata', 'creare', 'creo', 'crea', 'aggiungere', 'nuova', 'tisana', 'spremuta', 'inventare', 'non c\'è', 'idrata', 'tazze e bevande'],
    answer: [
      'Apri «Profilo» › «Bevute e tazze» › «Tazze e bevande».',
      'In «Le tue bevande» scrivi il «Nome della bevanda» e «Quanto idrata (%)», da 0 a 150.',
      'Tocca «Aggiungi bevanda»: la trovi poi tra le bevande quando segni una bevuta.',
    ],
    route: '/tazze',
    legacy: {
      answer: [
        "Apri «Tazze e bevande»: dal «Profilo», sezione «Bevute».",
        "In «Le tue bevande» scrivi il «Nome della bevanda» e «Quanto idrata (%)», da 0 a 150.",
        "Tocca «Aggiungi bevanda»: la trovi poi tra le bevande quando segni una bevuta.",
      ],
      route: "/tazze",
    },
  },
  {
    id: 'hydration-pct',
    title: 'Quanto conta ogni bevanda',
    questions: [
      'perché il caffè conta meno dell\'acqua',
      'quanto vale un tè sull\'obiettivo',
      'cosa significa la percentuale accanto alla bevanda',
      'tutte le bevande contano uguale',
    ],
    keywords: ['percentuale', 'idrata', 'idratazione', 'conta', 'vale', 'birra', 'bibita', 'succo', 'latte', 'tè', 'caffè', 'bevanda', 'idratare', 'acqua'],
    answer: [
      "Ogni bevanda conta in proporzione a una percentuale: Acqua 100%, Tè 90%, Latte 90%, Succo 85%, Caffè 80%, Bibita 70%, Birra 50%.",
      'Esempio: 200 ml di Caffè contano 160 ml verso l\'obiettivo. È un valore indicativo.',
      'Per le bevande tue scegli tu la percentuale in «Tazze e bevande».',
    ],
    route: '/tazze',
  },

  // --- Caffè e caffeina ---
  {
    id: 'coffee',
    title: 'Segnare un caffè',
    questions: [
      'come segno un caffè',
      'dove registro la caffeina',
      'ho preso un caffè, dove lo segno',
      'togliere un caffè segnato per errore',
    ],
    keywords: ['caffè', 'caffeina', 'espresso', 'tazzina', 'annulla caffeina', 'mg', 'preso', 'cappuccino'],
    answer: [
      'Nella scheda «Oggi» tocca il riquadro «Caffè»: ogni tocco è un caffè da 80 mg di caffeina.',
      'Sotto vedi i mg di caffeina rispetto ai 400 di riferimento.',
      'Per toglierne uno tocca «Annulla caffeina».',
      'Il riquadro conta la caffeina e non aggiunge acqua: per farlo contare come bevuta usa «+» e scegli «Caffè».',
    ],
    route: '/home',
  },
  {
    id: 'caffeine-limit',
    title: 'Il limite di caffeina',
    questions: [
      'qual è il limite di caffeina',
      'cosa significa oltre i 400 mg di riferimento',
      'qual è il limite del caffè',
      'quanti caffè al giorno posso prendere',
      'quanta caffeina posso bere al giorno',
    ],
    keywords: ['caffeina', 'limite', '400', 'mg', 'riferimento', 'troppo', 'superato', 'oltre', 'efsa', 'assumere', 'assumo', 'bere', 'al giorno'],
    answer: [
      'Il riquadro «Caffè» nella scheda «Oggi» mostra «mg di caffeina su 400».',
      'Oltre i 400 mg compare «oltre i 400 di riferimento»: è il valore indicativo per un adulto sano in una giornata, non un consiglio medico.',
      'Nello «Storico» c\'è anche la sfida «Caffeina sotto i 200 mg ogni giorno della settimana».',
    ],
    route: '/home',
  },

  // --- La schermata Oggi ---
  {
    id: 'offline-drink',
    title: 'Segnare senza connessione',
    questions: [
      'funziona senza internet',
      'ho segnato una bevuta senza rete',
      'cosa significa salvata sul telefono',
      'senza segnale le bevute si perdono',
    ],
    keywords: ['offline', 'internet', 'rete', 'connessione', 'segnale', 'wifi', 'salvata sul telefono', 'senza rete', 'sincronizzare', 'coda'],
    answer: [
      'Puoi segnare bevute e caffè anche senza rete.',
      'Nella scheda «Oggi» compare «Salvata sul telefono: la invio appena torna la rete».',
      'Quando la rete torna, vengono inviate da sole.',
    ],
    route: '/home',
  },
  {
    id: 'shortcuts',
    title: "Segnare dall'icona dell'app",
    questions: [
      "posso segnare una bevuta dall'icona senza aprire l'app",
      "come uso le scorciatoie dell'icona",
      "tenere premuta l'icona dell'app",
      "scorciatoia per segnare il caffè dall'icona",
    ],
    keywords: ['scorciatoia', 'scorciatoie', 'icona', 'pressione lunga', 'tenere premuto', 'premuta', 'veloce', 'rapido'],
    answer: [
      "Con l'app installata, su Android tieni premuta l'icona di Bere.",
      'Scegli «Segna una bevuta» oppure «Segna un caffè».',
      "L'app si apre sulla scheda «Oggi» e conferma, per esempio «Segnati 200 ml ✓».",
    ],
  },
  {
    id: 'home-pace',
    title: 'Sei in linea, indietro o avanti',
    questions: [
      'cosa significa sei indietro',
      'cosa vuol dire sei in linea',
      "cosa significa per essere in pari",
      "cosa vuol dire da ora circa all'ora",
    ],
    keywords: ['indietro', 'in linea', 'avanti', 'in pari', 'ritmo', 'dovresti essere', 'all\'ora', 'recuperare', 'fascia attiva', 'a quest\'ora', 'riprendo', 'sei indietro'],
    answer: [
      "Nella scheda «Oggi», sotto il totale, l'app confronta quanto hai bevuto con quanto dovresti aver bevuto a quest'ora.",
      "Con la «Fascia attiva» accesa («Profilo» › «Obiettivo») leggi «Sei in linea», «Sei indietro di…» o «Sei avanti di…», e «Da ora circa … all'ora».",
      'Senza fascia attiva il confronto usa gli orari dei tuoi promemoria: «… per essere in pari» oppure «Sei in pari».',
    ],
    route: '/home',
    legacy: {
      answer: [
        "Nella scheda «Oggi», sotto il totale, l'app confronta quanto hai bevuto con quanto dovresti aver bevuto a quest'ora.",
        "Con la «Fascia attiva» accesa (Profilo › Obiettivo) leggi «Sei in linea», «Sei indietro di…» o «Sei avanti di…», e «Da ora circa … all'ora».",
        "Senza fascia attiva il confronto usa gli orari dei tuoi promemoria: «… per essere in pari» oppure «Sei in pari».",
      ],
      route: "/home",
    },
  },
  {
    id: 'glu-fill',
    title: 'Cosa fa Glu',
    questions: [
      'chi è il personaggio Glu',
      'cosa fa il personaggio Glu',
      "perché Glu si riempie d'acqua",
      'cos\'è il personaggio nella schermata oggi',
    ],
    keywords: ['glu', 'personaggio', 'mascotte', 'goccia', 'riempie', 'riempirsi', 'umore', 'faccia', 'chi sei'],
    answer: [
      "Glu è la goccia della scheda «Oggi»: si riempie d'acqua man mano che bevi rispetto al tuo obiettivo.",
      'Accanto vedi il totale, per esempio «su 2 L · 45%».',
      'Cambia umore durante la giornata e fa festa quando raggiungi l\'obiettivo.',
    ],
    route: '/home',
  },

  // --- Promemoria ---
  {
    id: 'reminders-create',
    title: 'Creare un promemoria',
    questions: [
      'come creo un promemoria',
      'voglio una notifica ogni ora per ricordarmi di bere',
      'come imposto i promemoria',
      "voglio che l'app mi ricordi di bere",
    ],
    keywords: ['creare', 'creo', 'ricordare', 'ricordami', 'ricordo', 'ricordarmi', 'ogni ora', 'sveglia', 'allarme', 'programma', 'ricordamelo', 'intervallo', 'impostare'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche» › «Gestisci i promemoria».',
      'In «Ricordamelo ogni…» scegli 30 min, 1 ora, 1 ora e mezza, 2 ore, 3 ore oppure «Altro» (da 15 a 720 minuti).',
      'Imposta «Dalle» e «Alle», scegli i giorni e tocca «Crea promemoria».',
      'Per un altro programma tocca «Nuovo programma». Servono le notifiche attive: vedi «Stato notifiche».',
    ],
    route: '/promemoria',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» › «Promemoria e notifiche» › «Gestisci i promemoria».",
        "In «Ricordamelo ogni…» scegli 30 min, 1 ora, 1 ora e mezza, 2 ore, 3 ore oppure «Altro» (da 15 a 720 minuti).",
        "Imposta «Dalle» e «Alle», scegli i giorni e tocca «Crea promemoria».",
        "Per un altro programma tocca «Nuovo programma». Servono le notifiche attive: vedi «Stato notifiche».",
      ],
      route: "/promemoria",
    },
  },
  {
    id: 'reminders-manual',
    title: 'Scegliere gli orari a mano',
    questions: [
      'come scelgo gli orari dei promemoria',
      'voglio un promemoria a un orario preciso',
      'aggiungere un orario a un programma',
      'come tolgo un orario dal promemoria',
    ],
    keywords: ['orari', 'orario', 'a mano', 'preciso', 'manuale', 'aggiungi orario', 'nome del programma', 'specifico', 'riempi a intervalli', 'aggiungere un orario'],
    answer: [
      'Nella pagina «Promemoria» tocca «Preferisco scegliere gli orari a mano» (oppure «Modifica» su un programma esistente).',
      "Scrivi il «Nome del programma» e scegli i giorni.",
      'Scegli l\'ora in «Nuovo orario» e tocca «Aggiungi orario». Per toglierne uno tocca la sua ×. «Riempi a intervalli» li crea per te.',
      'Tocca «Salva programma».',
    ],
    route: '/promemoria',
  },
  {
    id: 'reminders-manage',
    title: 'Spegnere, modificare o eliminare un programma',
    questions: [
      'come spengo un promemoria senza cancellarlo',
      'come elimino un programma di promemoria',
      'come modifico i miei programmi',
      'perché ricevo due promemoria uguali',
      'voglio ricevere meno promemoria',
    ],
    keywords: ['programma', 'programmi', 'spegnere', 'spengo', 'attivo', 'eliminare', 'cancellare', 'doppie', 'doppio', 'uguali', 'due', 'duplicate', 'disattivare', 'elimina programma', 'senza cancellarlo', 'notifiche', 'meno', 'troppi'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche» › «Gestisci i promemoria».',
      'In «I tuoi programmi» togli la spunta per spegnere un programma senza perderlo.',
      '«Modifica» apre il programma; da lì puoi cambiare orari e giorni, oppure toccare «Elimina programma».',
      'Se due programmi attivi hanno gli stessi orari compare «Stai ricevendo notifiche doppie»: spegni o elimina uno dei due.',
    ],
    route: '/promemoria',
    legacy: {
      answer: [
        "Apri la pagina «Promemoria» (Profilo › «Gestisci i promemoria»).",
        "In «I tuoi programmi» togli la spunta per spegnere un programma senza perderlo.",
        "«Modifica» apre il programma; da lì puoi cambiare orari e giorni, oppure toccare «Elimina programma».",
        "Se due programmi attivi hanno gli stessi orari compare «Stai ricevendo notifiche doppie»: spegni o elimina uno dei due.",
      ],
      route: "/promemoria",
    },
  },
  {
    id: 'reminders-hours',
    title: 'Fascia attiva',
    questions: [
      'come imposto la fascia attiva',
      'non voglio promemoria di notte',
      'come limito i promemoria a certe ore',
      'cos\'è dividi l\'obiettivo sulle ore attive',
    ],
    keywords: ['fascia attiva', 'fascia', 'ore attive', 'notte', 'dormo', 'solo', 'dividi', 'limitare', 'certe ore', 'limito', '20'],
    answer: [
      'Apri «Profilo» › «Obiettivo» e trova «Fascia attiva».',
      "Attiva «Dividi l'obiettivo sulle ore attive» e scegli «Dalle» e «Alle».",
      'Tocca «Salva fascia».',
      "L'app conta e manda promemoria solo dentro la fascia, e nella scheda «Oggi» ricalcola quanto bere ogni ora.",
    ],
    route: '/profilo/obiettivo',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Obiettivo», e trova «Fascia attiva».",
        "Attiva «Dividi l'obiettivo sulle ore attive» e scegli «Dalle» e «Alle».",
        "Tocca «Salva fascia».",
        "L'app conta e manda promemoria solo dentro la fascia, e nella scheda «Oggi» ricalcola quanto bere ogni ora.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'reminders-snooze',
    title: 'Rimandare un promemoria',
    questions: [
      'posso rimandare un promemoria',
      'cosa fa il pulsante tra 15 min',
      'posso posticipare la notifica di un quarto d\'ora',
      'come mi ricorda più tardi',
    ],
    keywords: ['tra 15 min', 'rimandare', 'rimando', 'snooze', 'più tardi', 'posticipare', 'bevuto ✓', 'pulsanti', 'quarto'],
    answer: [
      'Nella notifica del promemoria ci sono i pulsanti «Bevuto ✓» e «Tra 15 min».',
      '«Bevuto ✓» segna subito una bevuta, senza aprire l\'app. «Tra 15 min» ti ricorda di nuovo dopo un quarto d\'ora.',
    ],
  },
  {
    id: 'reminders-learned',
    title: 'Orari che imparano',
    questions: [
      'cosa sono gli orari che imparano',
      "l'app mi suggerisce degli orari",
      'voglio usare gli orari proposti',
      'dove è finita la scheda orari che imparano',
    ],
    keywords: ['orari che imparano', 'imparano', 'proposti', 'suggeriti', 'suggerisce', 'suggerimento', 'di solito bevi', 'proposta', 'non ora', 'impara'],
    answer: [
      'Nella pagina «Promemoria» può comparire la scheda «Orari che imparano»: propone gli orari in cui di solito bevi, ma senza promemoria.',
      'Tocca un orario, per esempio «+ 16:30», per aggiungerlo al programma attivo.',
      '«Non ora» la nasconde per una settimana. Compare solo se ci sono orari da proporre.',
    ],
    route: '/promemoria',
  },
  {
    id: 'pause',
    title: 'Mettere in pausa le notifiche',
    questions: [
      'come metto in pausa le notifiche',
      'vado in vacanza, come sospendo i promemoria',
      'sono malato e non voglio rompere la serie',
      'come riprendo dopo la pausa',
    ],
    keywords: ['pausa', 'vacanza', 'malattia', 'malato', 'male', 'sto male', 'sospendere', 'sospendo', 'sospensione', 'riprendi', 'riprendere', 'giorni di stop', 'stop', 'rompere', 'malata', 'influenza'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche», e trova «Pausa».',
      'Scegli la durata: «Oggi», «3 giorni», «7 giorni» o «14 giorni».',
      'Le notifiche si fermano e la serie non si rompe.',
      'Per finire prima tocca «Riprendi adesso».',
    ],
    route: '/profilo/avvisi',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Promemoria e notifiche», e trova «Pausa».",
        "Scegli la durata: «Oggi», «3 giorni», «7 giorni» o «14 giorni».",
        "Le notifiche si fermano e la serie non si rompe.",
        "Per finire prima tocca «Riprendi adesso».",
      ],
      route: "/profilo",
    },
  },

  // --- Notifiche ---
  {
    id: 'push-on',
    title: 'Attivare le notifiche',
    questions: [
      'come attivo le notifiche',
      'come faccio a ricevere i promemoria',
      'voglio attivare le notifiche',
      'non ho ancora attivato le notifiche',
    ],
    keywords: ['notifiche', 'attivare', 'abilitare', 'permesso', 'consentire', 'push', 'ricevere', 'accendere', 'bloccate', 'attivo'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche», e tocca «Attiva le notifiche» (anche in «Stato notifiche»).',
      'Accetta la richiesta del telefono.',
      'Se sono bloccate, riattivale da Impostazioni › Notifiche › Bere e riapri l\'app.',
      'I promemoria si creano in «Gestisci i promemoria».',
    ],
    route: '/profilo/avvisi',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Promemoria e notifiche», e tocca «Attiva le notifiche» (anche in «Stato notifiche»).",
        "Accetta la richiesta del telefono.",
        "Se sono bloccate, riattivale da Impostazioni › Notifiche › Bere e riapri l'app.",
        "I promemoria si creano in «Gestisci i promemoria».",
      ],
      route: "/notifiche",
    },
  },
  {
    id: 'push-off',
    title: 'Spegnere le notifiche',
    questions: [
      'come spengo le notifiche',
      'voglio smettere di ricevere notifiche',
      'come disattivo gli avvisi',
      'basta notifiche',
    ],
    keywords: ['notifiche', 'disattivare', 'spegnere', 'spengo', 'smettere', 'silenziare', 'disattiva', 'basta'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche».',
      'Tocca «Disattiva le notifiche» (c\'è anche in «Stato notifiche»).',
      'I tuoi programmi restano salvati: per riaccenderle tocca «Attiva le notifiche».',
      'Per fermarle solo per qualche giorno usa «Pausa».',
    ],
    route: '/profilo/avvisi',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Promemoria e notifiche».",
        "Tocca «Disattiva le notifiche» (c'è anche in «Stato notifiche»).",
        "I tuoi programmi restano salvati: per riaccenderle tocca «Attiva le notifiche».",
        "Per fermarle solo per qualche giorno usa «Pausa».",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'push-problems',
    title: 'Le notifiche non arrivano',
    questions: [
      'non arrivano le notifiche',
      'come controllo se le notifiche funzionano',
      'come mando una notifica di prova',
      'perché i promemoria arrivano in ritardo',
    ],
    keywords: ['non funzionano', 'ritardo', 'prova', 'stato notifiche', 'controllare', 'problema', 'registrato', 'ultimi invii', 'risparmio energetico', 'funzionano'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche» › «Stato notifiche».',
      'In alto leggi se sono attive o se «Questo telefono non è registrato»: in quel caso tocca «Attiva le notifiche».',
      'Tocca «Invia notifica di prova», chiudi l\'app e guarda se arriva.',
      '«Ultimi invii» mostra gli ultimi promemoria e il loro ritardo.',
      'Full Immersion e Risparmio energetico possono ritardare o nascondere gli avvisi.',
    ],
    route: '/notifiche',
  },
  {
    id: 'push-amounts',
    title: 'Pulsanti con la quantità nel promemoria',
    questions: [
      'come metto le quantità nella notifica',
      'voglio i pulsanti bevuto 200 e 500 ml',
      'bevuto ✓ al posto delle quantità',
      'segnare 500 ml direttamente dalla notifica',
    ],
    keywords: ['bevuto 200', 'bevuto 500', '200', '500', 'due pulsanti', 'quantità nella notifica', 'bevuto ✓', 'posto', 'al posto'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche».',
      'Attiva «Nel promemoria «Bevuto 200 ml» e «Bevuto 500 ml»».',
      'Su Android i pulsanti sono al massimo due: le quantità prendono il posto di «Bevuto ✓» e «Tra 15 min».',
    ],
    route: '/profilo/avvisi',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Promemoria e notifiche».",
        "Attiva «Nel promemoria «Bevuto 200 ml» e «Bevuto 500 ml»».",
        "Su Android i pulsanti sono al massimo due: le quantità prendono il posto di «Bevuto ✓» e «Tra 15 min».",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'push-stop',
    title: "Fermare i promemoria quando raggiungo l'obiettivo",
    questions: [
      "come fermo i promemoria quando ho finito l'obiettivo",
      "non voglio promemoria dopo aver raggiunto l'obiettivo",
      "cosa fa fermati quando raggiungo l'obiettivo",
    ],
    keywords: ['fermati', 'fermare', 'finito', 'completato', 'smettere', 'fermo'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche».',
      "Attiva «Fermati quando raggiungo l'obiettivo».",
      "Una volta raggiunto l'obiettivo di oggi, i promemoria si fermano.",
    ],
    route: '/profilo/avvisi',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Promemoria e notifiche».",
        "Attiva «Fermati quando raggiungo l'obiettivo».",
        "Una volta raggiunto l'obiettivo di oggi, i promemoria si fermano.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'push-friends',
    title: 'Notifiche degli amici',
    questions: [
      'come blocco gli sproni degli amici',
      'come avviso gli amici quando raggiungo l\'obiettivo',
      "non voglio sapere quando un amico raggiunge l'obiettivo",
      'voglio che gli amici non possano spronarmi',
    ],
    keywords: ['sproni', 'spronarmi', 'avvisare', 'bloccare', 'blocco', 'condividere', 'sapere', 'avvisami'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche».',
      '«Gli amici possono spronarmi»: spegnilo per non ricevere sproni.',
      '«Avvisa gli amici quando raggiungo l\'obiettivo»: decidi se loro lo sanno.',
      '«Avvisami quando un amico raggiunge l\'obiettivo»: decidi se lo sai tu.',
    ],
    route: '/profilo/avvisi',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Promemoria e notifiche».",
        "«Gli amici possono spronarmi»: spegnilo per non ricevere sproni.",
        "«Avvisa gli amici quando raggiungo l'obiettivo»: decidi se loro lo sanno.",
        "«Avvisami quando un amico raggiunge l'obiettivo»: decidi se lo sai tu.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'push-summary',
    title: 'Riepilogo serale e resoconto del lunedì',
    questions: [
      'come tolgo il riepilogo serale',
      'cos\'è il resoconto della settimana',
      'ricordami di bere se non apro l\'app',
      'come spengo i messaggi del lunedì',
    ],
    keywords: ['riepilogo', 'serale', 'sera', 'resoconto', 'settimana', 'lunedì', 'settimanale', 'inattivo', 'non apro', 'un giorno', 'mancato', 'messaggi del lunedì'],
    answer: [
      'Apri «Profilo» › «Promemoria e notifiche».',
      '«Ricordami di bere se non apro l\'app da un giorno», «Riepilogo serale se oggi mi è mancato parecchio» e «Resoconto della settimana il lunedì» si accendono e spengono qui.',
    ],
    route: '/profilo/avvisi',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Promemoria e notifiche».",
        "«Ricordami di bere se non apro l'app da un giorno», «Riepilogo serale se oggi mi è mancato parecchio» e «Resoconto della settimana il lunedì» si accendono e spengono qui.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'iphone',
    title: 'Notifiche su iPhone',
    questions: [
      'perché su iPhone non ricevo le notifiche',
      'notifiche su iPhone',
      "serve installare l'app per le notifiche",
      'cosa significa prima installa l\'app',
    ],
    keywords: ['iphone', 'ios', 'apple', 'safari', 'ipad', 'installata', 'condividi', 'prima installa', 'notifiche', 'schermata home'],
    answer: [
      "Su iPhone le notifiche funzionano solo con l'app installata sulla schermata Home (serve iOS 16.4 o successivo).",
      'Apri Bere in Safari, tocca «Condividi» in basso e scegli «Aggiungi alla schermata Home».',
      "Apri Bere dalla nuova icona e vai su «Stato notifiche» per attivarle.",
    ],
    route: '/notifiche',
  },
  {
    id: 'install',
    title: "Installare l'app sul telefono",
    questions: [
      "come installo l'app",
      "come metto l'app sulla schermata home",
      "come scarico l'app",
      "posso usare l'app come un'app vera",
    ],
    keywords: ['installare', 'installazione', 'installo', 'scaricare', 'scarico', 'icona', 'pwa', 'store', 'android', 'chrome', 'app vera', 'telefono', 'schermata home'],
    answer: [
      "L'app non ha un pulsante per installarla: si aggiunge dal browser.",
      'Su iPhone: apri Bere in Safari, tocca «Condividi» e scegli «Aggiungi alla schermata Home».',
      'Su Android: dal menu del browser scegli l\'opzione per installare l\'app o aggiungerla alla schermata Home.',
      'Poi apri Bere dalla nuova icona.',
    ],
  },

  // --- Classifica ---
  {
    id: 'board-how',
    title: 'Come funziona la classifica',
    questions: [
      'come funziona la classifica',
      'chi vince in classifica',
      'come si decide la posizione in classifica',
      'perché non sono in classifica',
    ],
    keywords: ['classifica', 'posizione', 'vince', 'vincere', 'primo', 'podio', 'parità', '1,5 L', 'punteggio', 'primo posto'],
    answer: [
      'Apri la scheda «Classifica».',
      "Vince chi raggiunge il proprio obiettivo in più giorni, da lunedì a domenica. A parità conta la serie più lunga di giorni consecutivi.",
      'Valgono solo obiettivi da 1,5 L in su.',
      'In alto vedi il tuo posto, i giorni a obiettivo e la serie; in fondo trovi «Come funziona».',
    ],
    route: '/classifica',
  },
  {
    id: 'board-poke',
    title: 'Spronare un amico',
    questions: [
      'come sprono un amico',
      'come mando uno sprono a un amico',
      'cosa fa il pulsante sprona',
      'perché non riesco a spronare',
    ],
    keywords: ['sprona', 'spronare', 'spronato', 'stimolare', '👋', 'limite', 'spinta', 'spingere'],
    answer: [
      'Nella scheda «Classifica» tocca «👋 Sprona» sulla riga di un amico.',
      'Gli arriva una notifica per ricordargli di bere.',
      'Al massimo 3 volte al giorno, e una volta all\'ora per la stessa persona. Se l\'amico ha spento gli sproni o la notifica non c\'è, lo leggi nel messaggio.',
    ],
    route: '/classifica',
  },
  {
    id: 'board-cheer',
    title: 'Mandare i complimenti',
    questions: [
      'come mando i complimenti a un amico',
      'cosa significa la scritta obiettivo di oggi',
      'a cosa serve il pulsante complimenti',
      "come faccio i complimenti a chi ha finito l'obiettivo",
    ],
    keywords: ['complimenti', 'applauso', '👏', 'congratularsi', 'festeggiare', 'inviati', 'bravo', 'finito', 'oggi'],
    answer: [
      'Quando un amico raggiunge l\'obiettivo del giorno, nella «Classifica» la sua riga mostra «🎉 obiettivo di oggi».',
      'Tocca «👏 Complimenti» su quella riga (oppure il pulsante «👏 Complimenti» nella notifica). Dopo l\'invio diventa «👏 Inviati».',
      'Puoi spegnere questi avvisi in «Profilo» › «Promemoria e notifiche».',
    ],
    route: '/classifica',
    legacy: {
      answer: [
        "Quando un amico raggiunge l'obiettivo del giorno, nella «Classifica» la sua riga mostra «🎉 obiettivo di oggi».",
        "Tocca «👏 Complimenti» su quella riga (oppure il pulsante «👏 Complimenti» nella notifica). Dopo l'invio diventa «👏 Inviati».",
        "Puoi spegnere questi avvisi nel «Profilo», in «Promemoria e notifiche».",
      ],
      route: "/classifica",
    },
  },
  {
    id: 'levels',
    title: 'Livelli e punti',
    questions: [
      'come si sale di livello',
      'come si guadagnano i punti',
      'cosa significa il numero accanto al nome in classifica',
      'quali sono i livelli',
    ],
    keywords: ['livello', 'livelli', 'punti', 'sorso', 'ruscello', 'fiume', 'lago', 'mare', 'oceano', 'salire', 'xp', 'esperienza', 'numero accanto al nome'],
    answer: [
      'Nella scheda «Storico» trovi la scheda del tuo livello (per esempio «Livello 3 · Sorso»), con «Come si guadagnano i punti».',
      "1 punto ogni 100 ml bevuti, fino all'obiettivo del giorno; +20 per ogni giorno con l'obiettivo raggiunto; +50 se in una settimana lo raggiungi almeno 5 giorni, +150 se tutti e 7.",
      'I livelli hanno nomi come Goccia, Sorso, Ruscello, Fiume, Lago, Mare, Oceano. Il tuo livello si vede accanto al nome in «Classifica».',
    ],
    route: '/storico',
  },

  // --- Storico ---
  {
    id: 'history-chart',
    title: 'Il grafico dei giorni',
    questions: [
      'dove vedo la media degli ultimi giorni',
      'come leggo il grafico dello storico',
      'come cambio il periodo da 7 a 30 giorni',
      'dove vedo la media',
    ],
    keywords: ['grafico', 'barre', 'storico', 'ultimi', '7 giorni', '30 giorni', 'media', 'tabella', 'litri per giorno', 'andamento', 'settimana scorsa', 'periodo'],
    answer: [
      'Apri la scheda «Storico».',
      'In alto scegli «7 giorni» o «30 giorni»: il grafico «Litri per giorno» mostra una barra per giorno e la linea dell\'«Obiettivo».',
      'Tocca una barra per vedere quel giorno. Sopra leggi la «Media» e i giorni «A obiettivo».',
      '«Vedi come tabella» mostra gli stessi dati in forma di tabella.',
    ],
    route: '/storico',
  },
  {
    id: 'share-week',
    title: 'Condividere la settimana',
    questions: [
      'come condivido la mia settimana',
      'posso mandare i miei risultati a un amico',
      'come faccio un\'immagine della settimana',
      'condividere su instagram',
    ],
    keywords: ['condividere', 'condividi', 'condivido', 'whatsapp', 'instagram', 'storie', 'mandare', 'inviare', 'immagine', 'foto della settimana', 'progressi', 'risultati', 'social', 'giorni a obiettivo'],
    answer: [
      'Apri la scheda «Storico» e, sotto il grafico, tocca «Condividi la settimana».',
      'Si prepara un\'immagine con gli ultimi 7 giorni: giorni a obiettivo, litri bevuti e serie.',
      'Sul telefono scegli dove mandarla (WhatsApp, Instagram…); dove non si può condividere, l\'immagine si scarica.',
      'L\'immagine non mostra il tuo nome né la tua foto.',
    ],
    route: '/storico',
  },
  {
    id: 'history-calendar',
    title: 'Calendario e statistiche del mese',
    questions: [
      'dove vedo il calendario',
      'come vedo il mese intero',
      'statistiche del mese',
      'come vedo le statistiche di tutto l\'anno',
    ],
    keywords: ['calendario', 'mese', 'mesi', 'anno', 'mensile', 'annuale', 'statistiche', 'giorni colorati', 'mese in numeri', 'mese per mese', 'dati dell\'anno'],
    answer: [
      'Apri la scheda «Storico» e, nella scheda «Statistiche», tocca «Calendario e statistiche del mese».',
      'Con «Mese» e «Anno» cambi vista; le frecce ‹ › passano al mese o all\'anno precedente o successivo.',
      'I giorni sono colorati: obiettivo raggiunto, almeno metà, meno di metà, salvato dal salva-serie, in pausa.',
      '«Il mese in numeri» riassume totale, media e serie più lunga.',
    ],
    route: '/storico/calendario',
  },
  {
    id: 'challenges',
    title: 'Sfide della settimana',
    questions: [
      'cosa sono le sfide della settimana',
      'come completo una sfida',
      'quando si azzerano le sfide',
      'dove vedo le sfide',
    ],
    keywords: ['sfide', 'sfida', 'fatta', 'completare', 'challenge', 'obiettivi settimanali', '15 litri', 'caffeina sotto'],
    answer: [
      'Apri la scheda «Storico» e trova «Sfide della settimana».',
      "Le sfide sono: raggiungere l'obiettivo 5 giorni, 3 giorni di fila, tutti i 7 giorni, bere 15 litri, e restare sotto i 200 mg di caffeina ogni giorno.",
      'Ogni barra mostra il progresso; quando è completa compare «Fatta ✓». La settimana va da lunedì a domenica.',
    ],
    route: '/storico',
  },
  {
    id: 'achievements',
    title: 'Traguardi',
    questions: [
      'dove vedo i traguardi',
      'quali traguardi posso ottenere',
      'come sblocco un traguardo',
      'cosa sono i badge',
    ],
    keywords: ['traguardi', 'traguardo', 'badge', 'medaglie', 'premi', 'sbloccati', 'sbloccare', 'da raggiungere', 'trofei', 'successi', 'riconoscimenti'],
    answer: [
      'Apri la scheda «Storico» e trova «Traguardi».',
      'Quelli ottenuti sono in elenco con ✓: Prima bevuta, Primo obiettivo, Tre di fila, Settimana piena, Un mese intero, 10 litri, 100 litri, 500 litri, 100 bevute, Mai sotto metà.',
      'Quelli che mancano sono in «Da raggiungere».',
    ],
    route: '/storico',
  },
  {
    id: 'streak',
    title: 'La serie',
    questions: [
      'cos\'è la serie',
      'dove vedo la mia serie',
      'come si allunga la serie',
      'cosa significa serie migliore',
    ],
    keywords: ['serie', 'giorni di fila', 'di fila', 'consecutivi', 'consecutivo', 'streak', 'giorni di seguito', 'continuità'],
    answer: [
      "La serie conta i giorni di fila in cui raggiungi l'obiettivo.",
      'Nella scheda «Storico», in «Statistiche», vedi «Serie in corso» e «Serie migliore».',
      'La «Pausa» e il salva-serie evitano che si rompa.',
    ],
    route: '/storico',
  },
  {
    id: 'streak-saver',
    title: 'Il salva-serie',
    questions: [
      'cos\'è il salva-serie',
      'come funziona il salva serie',
      'ho saltato un giorno, perdo la serie',
      'quando torna il salva-serie',
    ],
    keywords: ['salva', 'salvaserie', 'jolly', 'saltato', 'saltare', 'salta', 'rotta', 'mancato', 'scudo', 'protezione', 'settimanale'],
    answer: [
      "Ogni settimana, da lunedì a domenica, hai un salva-serie: il primo giorno in cui non raggiungi l'obiettivo la serie non si rompe.",
      'Il giorno salvato non allunga la serie. Dal secondo giorno mancato della settimana la serie riparte da zero.',
      'Lo trovi spiegato nello «Storico» e, in fondo, nel «Calendario».',
    ],
    route: '/storico/calendario',
  },

  // --- Profilo e aspetto ---
  {
    id: 'name',
    title: 'Cambiare il nome',
    questions: [
      'come cambio il mio nome',
      'dove modifico il nome del profilo',
      'dove modifico il mio nickname',
      'voglio un altro nome',
    ],
    keywords: ['nome', 'chiamo', 'chiamarmi', 'nickname', 'nomignolo', 'username', 'rinominare', 'chiama'],
    answer: [
      'Apri «Profilo» › «Aspetto e Glu»: nel campo «Nome», scrivi il nuovo nome (massimo 40 caratteri).',
      'Tocca «Salva nome».',
      'Nome e foto sono visibili agli altri utenti nella classifica.',
    ],
    route: '/profilo/aspetto',
    legacy: {
      answer: [
        "Apri la scheda «Profilo»: in alto, nel campo «Nome», scrivi il nuovo nome (massimo 40 caratteri).",
        "Tocca «Salva nome».",
        "Nome e foto sono visibili agli altri utenti nella classifica.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'photo',
    title: 'Cambiare foto o avatar',
    questions: [
      'come cambio la foto del profilo',
      "come scelgo un avatar",
      'voglio mettere una mia foto',
      'come tolgo la mia foto',
    ],
    keywords: ['foto', 'avatar', 'immagine', 'fotografia', 'faccia', 'carica', 'togliere foto'],
    answer: [
      'Apri «Profilo» › «Aspetto e Glu»: trovi la tua immagine.',
      'Tocca «Cambia foto» per caricarne una tua, oppure scegli un avatar in «Oppure scegli un avatar».',
      'Per togliere la foto scegli uno degli avatar. Nome e foto sono visibili a tutti in classifica.',
    ],
    route: '/profilo/aspetto',
    legacy: {
      answer: [
        "Apri la scheda «Profilo»: in alto trovi la tua immagine.",
        "Tocca «Cambia foto» per caricarne una tua, oppure scegli un avatar in «Oppure scegli un avatar».",
        "Per togliere la foto scegli uno degli avatar. Nome e foto sono visibili a tutti in classifica.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'background',
    title: "Cambiare lo sfondo dell'app",
    questions: [
      "come cambio lo sfondo dell'app",
      'voglio mettere una mia immagine come sfondo',
      'come tolgo lo sfondo',
      'dove scelgo lo sfondo',
    ],
    keywords: ['sfondo', 'wallpaper', 'scegli uno sfondo', 'rimuovi sfondo', 'foto di sfondo'],
    answer: [
      'Apri «Profilo» › «Aspetto e Glu».',
      'In «Sfondo dell\'app» tocca «Scegli uno sfondo» (poi diventa «Cambia sfondo») e scegli un\'immagine.',
      'Per toglierlo tocca «Rimuovi sfondo». Lo sfondo lo vedi solo tu.',
    ],
    route: '/profilo/aspetto',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» e vai alla sezione «Aspetto».",
        "In «Sfondo dell'app» tocca «Scegli uno sfondo» (poi diventa «Cambia sfondo») e scegli un'immagine.",
        "Per toglierlo tocca «Rimuovi sfondo». Lo sfondo lo vedi solo tu.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'units',
    title: 'Litri o once',
    questions: [
      'come cambio da litri a once',
      "come cambio l'unità di misura",
      'voglio vedere i ml invece delle once',
      'dove imposto le once',
    ],
    keywords: ['unità', 'misura', 'litri', 'once', 'oz', 'ml', 'millilitri', 'americane', 'unità di misura'],
    answer: [
      'Apri «Profilo» › «Bevute e tazze».',
      'In «Unità di misura» scegli «Litri» oppure «Once».',
    ],
    route: '/profilo/bevute',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» e vai alla sezione «Bevute».",
        "In «Unità di misura» scegli «Litri» oppure «Once».",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'sound',
    title: 'Il suono della bevuta',
    questions: [
      'come cambio il suono',
      'come tolgo il suono quando segno una bevuta',
      'dove scelgo il suono',
      'voglio un altro suono',
    ],
    keywords: ['suono', 'suoni', 'rumore', 'audio', 'campanella', 'bolla', 'gong', 'nessuno', 'muto', 'silenzioso', 'volume'],
    answer: [
      'Apri «Profilo» › «Bevute e tazze».',
      'In «Suono» scegli Goccia, Campanella, Bolla, Gong oppure Nessuno: toccandolo lo senti subito.',
      'Il suono si sente solo con l\'app aperta; le notifiche usano il suono scelto nelle impostazioni del telefono.',
    ],
    route: '/profilo/bevute',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» e vai alla sezione «Bevute».",
        "In «Suono» scegli Goccia, Campanella, Bolla, Gong oppure Nessuno: toccandolo lo senti subito.",
        "Il suono si sente solo con l'app aperta; le notifiche usano il suono scelto nelle impostazioni del telefono.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'glu-calm',
    title: 'Glu tranquillo',
    questions: [
      'come rendo Glu tranquillo',
      'Glu si muove troppo',
      'come tolgo le scenette di Glu',
      'cosa fa glu tranquillo',
    ],
    keywords: ['glu tranquillo', 'tranquillo', 'scenette', 'tremarelle', 'animazioni', 'movimento', 'calmo', 'fermo', 'disturba'],
    answer: [
      'Apri «Profilo» › «Aspetto e Glu».',
      'Attiva «Glu tranquillo»: Glu resta, ma senza scenette e tremarelle.',
    ],
    route: '/profilo/aspetto',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» e vai alla sezione «Aspetto».",
        "Attiva «Glu tranquillo»: Glu resta, ma senza scenette e tremarelle.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'glu-3d',
    title: 'Glu in 3D',
    questions: [
      'come spengo il 3D',
      'cosa fa glu in 3d',
      'come risparmio batteria con Glu',
      'come torno al Glu normale',
    ],
    keywords: ['3d', 'tre dimensioni', 'tridimensionale', 'batteria', 'risparmiare', 'consumare', 'consumo', 'glu in 3d', 'grafica'],
    answer: [
      "Apri «Profilo» › «Aspetto e Glu».",
      'Con «Glu in 3D» attivo Glu si muove in tre dimensioni. Spegnilo per risparmiare batteria: vale subito.',
    ],
    route: '/profilo/aspetto',
    legacy: {
      answer: [
        "Apri la scheda «Profilo» e vai alla sezione «Aspetto».",
        "Con «Glu in 3D» attivo Glu si muove in tre dimensioni. Spegnilo per risparmiare batteria: vale subito.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'glu-variants',
    title: 'Cambiare Glu',
    questions: [
      'come cambio Glu',
      'come sblocco Glu Menta',
      'posso avere un Glu di un altro colore',
      'perché alcuni Glu hanno il lucchetto',
    ],
    keywords: ['glu', 'varianti', 'variante', 'colore', 'colori', 'menta', 'limone', 'fragola', 'cocco', 'sbloccare', 'sblocco', 'sbloccato', 'lucchetto', 'scegliere', 'scelgo', 'scelta', 'verde', 'rosa', 'giallo'],
    answer: [
      'Apri «Profilo» › «Aspetto e Glu» e scorri fino a «Il tuo Glu».',
      'Tocca il Glu che preferisci: vale subito, ovunque ci sia Glu.',
      'I Glu col lucchetto si sbloccano salendo di livello: Glu Menta al livello 2, poi uno nuovo a ogni livello fino al 6. Toccandoli vedi quanti punti mancano.',
    ],
    route: '/profilo/aspetto',
    onlyWhen: 'variants',
  },
  {
    id: 'dark',
    title: 'Tema scuro',
    questions: [
      'come attivo il tema scuro',
      "c'è la modalità scura",
      "come metto l'app scura",
      'dark mode',
    ],
    keywords: ['tema', 'scuro', 'scura', 'dark', 'buio', 'modalità scura', 'modalità notte', 'nero', 'chiaro', 'luminosità'],
    answer: [
      "L'app non ha un interruttore: segue il tema del telefono.",
      'Con il tema scuro attivo nelle impostazioni del telefono, anche Bere diventa scura.',
    ],
  },

  // --- Dati e account ---
  {
    id: 'backup',
    title: 'Copia e ripristino dei dati',
    questions: [
      'come faccio una copia dei miei dati',
      'come ripristino i dati da una copia',
      'posso scaricare le bevute in CSV',
      'come esporto i miei dati in un file',
    ],
    keywords: ['copia', 'backup', 'ripristino', 'ripristinare', 'esportare', 'esporto', 'scaricare', 'csv', 'json', 'excel', 'file'],
    answer: [
      'Apri «Profilo» › «Account e privacy», e tocca «Copia e ripristino dei dati».',
      '«Scarica copia (JSON)» salva tutto in un file; «Scarica bevute (CSV)» salva solo le bevute, apribili in un foglio di calcolo.',
      '«Ripristina da una copia» aggiunge le bevute, la caffeina, le tazze e le bevande che mancano, senza duplicarle. Non cambia programmi e obiettivi.',
    ],
    route: '/profilo/account',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Account», e tocca «Copia e ripristino dei dati».",
        "«Scarica copia (JSON)» salva tutto in un file; «Scarica bevute (CSV)» salva solo le bevute, apribili in un foglio di calcolo.",
        "«Ripristina da una copia» aggiunge le bevute, la caffeina, le tazze e le bevande che mancano, senza duplicarle. Non cambia programmi e obiettivi.",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'password',
    title: 'Cambiare la password',
    questions: [
      'come cambio la password',
      'ho dimenticato la password',
      'come recupero la password',
      'voglio una nuova password',
    ],
    keywords: ['password', 'recuperare', 'recupero', 'reset', 'nuova', 'accesso', 'credenziali', 'ricordo'],
    answer: [
      'Apri «Profilo» › «Account e privacy», e tocca «Password».',
      'Scrivi la «Password attuale» e la «Nuova password» (almeno 8 caratteri), poi tocca «Cambia password».',
      'Se non la ricordi tocca «Non la ricordo: inviami un link». Da fuori dall\'app, nella pagina di accesso, usa «Password dimenticata?».',
    ],
    route: '/profilo/account',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Account», e tocca «Password».",
        "Scrivi la «Password attuale» e la «Nuova password» (almeno 8 caratteri), poi tocca «Cambia password».",
        "Se non la ricordi tocca «Non la ricordo: inviami un link». Da fuori dall'app, nella pagina di accesso, usa «Password dimenticata?».",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'signout',
    title: "Uscire dall'account",
    questions: [
      "come esco dall'account",
      'come faccio il logout',
      'voglio disconnettermi',
      'come cambio utente',
    ],
    keywords: ['uscire', 'esci', 'esco', 'logout', 'disconnettere', 'disconnettermi', 'utente', 'sloggare'],
    answer: [
      'Apri «Profilo» › «Account e privacy».',
      'Tocca «Esci».',
    ],
    route: '/profilo/account',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», in fondo alla sezione «Account».",
        "Tocca «Esci».",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'delete',
    title: 'Cancellare il profilo',
    questions: [
      'come cancello il mio profilo',
      "come elimino l'account",
      'voglio eliminare il mio profilo per sempre',
      'come mi disiscrivo',
    ],
    keywords: ['profilo', 'account', 'definitivamente', 'per sempre', 'cancellazione', 'disiscrivere', 'chiudere', 'elimina', 'cancellare', 'eliminare'],
    answer: [
      'Apri «Profilo» › «Account e privacy», e tocca «Privacy e cancellazione dell\'account».',
      'Nella sezione «Cancellare il profilo» scrivi ELIMINA.',
      'Tocca «Elimina definitivamente il profilo»: cancella subito profilo, foto, bevute, caffeina e promemoria. Non si può annullare.',
    ],
    route: '/privacy',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Account», e tocca «Privacy e cancellazione dell'account».",
        "Nella sezione «Cancellare il profilo» scrivi ELIMINA.",
        "Tocca «Elimina definitivamente il profilo»: cancella subito profilo, foto, bevute, caffeina e promemoria. Non si può annullare.",
      ],
      route: "/privacy",
    },
  },
  {
    id: 'privacy',
    title: 'Privacy e dati',
    questions: [
      "che dati conserva l'app",
      'chi può vedere le mie bevute',
      'dove sono conservati i miei dati',
      "quanti anni bisogna avere per usare l'app",
    ],
    keywords: ['privacy', 'chi vede', 'vede', 'vedere', 'visibile', 'privati', 'supabase', 'età', 'anni', '14', 'condivisi', 'sicurezza', 'pubblico', 'conservati', 'conserva', 'informazioni', 'personali'],
    answer: [
      'La pagina «Privacy» spiega cosa salviamo, chi lo vede, dove sono conservati i dati e l\'età minima (14 anni). La trovi in «Profilo» › «Account e privacy».',
      'Nome, foto e giorni a obiettivo sono visibili a tutti; acqua, caffè, orari e sfondo restano privati.',
    ],
    route: '/privacy',
    legacy: {
      answer: [
        "La pagina «Privacy» spiega cosa salviamo, chi lo vede, dove sono conservati i dati e l'età minima (14 anni). La trovi nel «Profilo», sezione «Account».",
        "Nome, foto e giorni a obiettivo sono visibili a tutti; acqua, caffè, orari e sfondo restano privati.",
      ],
      route: "/privacy",
    },
  },

  // --- Suggerimenti, segnalazioni, novità ---
  {
    id: 'ask-glu',
    title: 'Chiedere aiuto a Glu',
    questions: [
      'come chiedo aiuto a Glu',
      "cos'è chiedi a Glu",
      'come apro la chat di Glu',
      "c'è una guida dell'app",
    ],
    keywords: ['aiuto', 'guida', 'chiedi a glu', 'chat', 'chiedere', 'chiedo', 'assistente', 'help', 'istruzioni', 'spiegazioni'],
    answer: [
      "Tocca Glu quando è fermo nell'angolo o nell'anello di «Oggi»: si apre «Chiedi a Glu».",
      'Oppure apri «Profilo» › «Aiuto e suggerimenti» e tocca «Chiedi a Glu».',
      'Scrivi la domanda o tocca un suggerimento: Glu risponde con i passaggi e «Portami lì» ti porta nella schermata giusta.',
      "La chat c'è con «Glu in 3D» acceso, in «Profilo» › «Aspetto e Glu».",
    ],
    route: '/profilo/aiuto',
    legacy: {
      answer: [
        "Tocca Glu quando è fermo nell'angolo o nell'anello di «Oggi»: si apre «Chiedi a Glu».",
        "Scrivi la domanda o tocca un suggerimento: Glu risponde con i passaggi e «Portami lì» ti porta nella schermata giusta.",
        "La chat c'è con «Glu in 3D» acceso: lo trovi nel «Profilo», sezione «Aspetto».",
      ],
      route: "/profilo",
    },
  },
  {
    id: 'feedback',
    title: 'Inviare un suggerimento',
    questions: [
      'come invio un suggerimento',
      'voglio proporre un miglioramento',
      'dove segnalo un problema o un\'idea',
      'come contatto chi gestisce l\'app',
    ],
    keywords: ['suggerimento', 'suggerimenti', 'miglioramento', 'idea', 'proposta', 'feedback', 'consiglio', 'contattare', 'problema', 'bug', 'migliorare', 'proporre'],
    answer: [
      'Apri «Profilo» › «Aiuto e suggerimenti», e tocca «Suggerisci un miglioramento».',
      'Scrivi nel campo «Cosa miglioreresti?» (fino a 2000 caratteri) e tocca «Invia».',
    ],
    route: '/feedback',
    legacy: {
      answer: [
        "Apri la scheda «Profilo», sezione «Account», e tocca «Suggerisci un miglioramento».",
        "Scrivi nel campo «Cosa miglioreresti?» (fino a 2000 caratteri) e tocca «Invia».",
      ],
      route: "/feedback",
    },
  },
  {
    id: 'report',
    title: 'Segnalare una foto o un nome',
    questions: [
      'come segnalo una foto offensiva',
      'un nome in classifica è inappropriato',
      'una foto usa una mia opera senza permesso',
      'come segnalo un utente',
    ],
    keywords: ['segnalare', 'segnalazione', 'segnala', 'offensivo', 'inadatto', 'diritto d\'autore', 'copyright', 'abuso', 'inappropriato', 'offensiva'],
    answer: [
      'Apri la scheda «Classifica», tocca «Come funziona» e poi «Segnalalo» (lo trovi anche in «Profilo» › «Aiuto e suggerimenti» › «Segnala un contenuto»).',
      'Scegli «Cosa segnali?», scrivi il «Nome in classifica» e i dettagli.',
      'Tocca «Invia la segnalazione»: la controlliamo e, se serve, togliamo il contenuto.',
    ],
    route: '/segnala',
    legacy: {
      answer: [
        "Apri la scheda «Classifica», tocca «Come funziona» e poi «Segnalalo» (lo trovi anche nella pagina «Privacy»).",
        "Scegli «Cosa segnali?», scrivi il «Nome in classifica» e i dettagli.",
        "Tocca «Invia la segnalazione»: la controlliamo e, se serve, togliamo il contenuto.",
      ],
      route: "/segnala",
    },
  },
  {
    id: 'news',
    title: 'La Newsletter delle novità',
    questions: [
      'dove vedo le novità',
      'cosa è cambiato nell\'ultima versione',
      'cos\'è il pallino sull\'icona in alto',
      'dove leggo la newsletter',
    ],
    keywords: ['newsletter', 'novità', 'nuovo', 'versione', 'aggiornamento', 'changelog', 'pallino', 'ultima versione', 'release'],
    answer: [
      "Nella scheda «Oggi», in alto a destra, tocca l'icona «Newsletter»: ha un pallino se ci sono novità da leggere. La trovi anche in «Profilo» › «Aiuto e suggerimenti» › «Leggi le novità».",
      'La pagina elenca le novità di Bere, versione per versione, dalla più recente.',
    ],
    route: '/novita',
    legacy: {
      answer: [
        "Nella scheda «Oggi», in alto a destra, tocca l'icona «Newsletter»: ha un pallino se ci sono novità da leggere.",
        "La pagina elenca le novità di Bere, versione per versione, dalla più recente.",
      ],
      route: "/novita",
    },
  },
]

/** I 4 suggerimenti pronti per pagina (id di voci della guida). */
export const PAGE_TIPS: Record<'home' | 'storico' | 'classifica' | 'profilo', string[]> = {
  home: ['drink-log', 'goal-change', 'reminders-create', 'coffee'],
  storico: ['history-calendar', 'streak', 'challenges', 'drink-remove'],
  classifica: ['board-how', 'board-poke', 'levels', 'board-cheer'],
  profilo: ['push-on', 'photo', 'pause', 'backup'],
}

const strip = ({ legacy: _legacy, onlyWhen: _onlyWhen, ...entry }: GuideSource): GuideEntry => entry

/** La guida per un Profilo: nuovo (pagine per voce) o di sempre (`legacy` dove serve); le voci `onlyWhen: 'variants'` solo con variants. */
export function guideFor(newProfile: boolean, variants = false): GuideEntry[] {
  return GUIDE.filter((e) => variants || e.onlyWhen !== 'variants').map((e) =>
    newProfile || !e.legacy ? strip(e) : { ...strip(e), answer: e.legacy.answer, route: e.legacy.route },
  )
}

const cache = new Map<string, GuideEntry[]>()
/** La guida che vede l'utente: quella del Profilo nuovo solo dove NEW_PROFILE è acceso, «Cambiare Glu» solo con GLU_VARIANTS. */
export function activeGuide(): GuideEntry[] {
  const key = `${NEW_PROFILE}:${GLU_VARIANTS}`
  let guide = cache.get(key)
  if (!guide) cache.set(key, (guide = guideFor(NEW_PROFILE, GLU_VARIANTS)))
  return guide
}
