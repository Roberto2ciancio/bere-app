/**
 * Profilo nuovo (indice di sei voci, ognuna con la sua pagina): per ora solo nell'app di prova.
 * L'app vera tiene il Profilo di sempre (LegacyProfilePage) finché l'utente non lo accende.
 * Nei test unitari vale false (app vera): i test del Profilo nuovo lo forzano con vi.mock.
 *
 * Quando si accende: NEW_PROFILE = true (o si toglie), versione 1.11.0 in package.json e questa voce
 * in cima a changelog.ts:
 *
 *   version: '1.11.0', title: 'Profilo più semplice', notes:
 *   - Il Profilo ora è un elenco di sei voci: Obiettivo, Promemoria e notifiche, Bevute e tazze, Aspetto e Glu,
 *     Account e privacy, Aiuto e suggerimenti.
 *   - Ogni voce ha la sua pagina e, nell’elenco, un riepilogo di com’è impostata: l’obiettivo di oggi, se le
 *     notifiche sono attive o in pausa, la quantità per bevuta.
 *   - In cima trovi la tua immagine, il nome e il livello: tocca l’immagine per cambiarla.
 *   - Con Glu in 3D, in «Aiuto e suggerimenti» c’è «Chiedi a Glu»; la guida di Glu conosce le nuove pagine e
 *     ti porta nel posto giusto.
 */
// `import.meta.env` manca quando i test e2e (Node) importano la guida: lì vale come produzione.
export const NEW_PROFILE: boolean = import.meta.env?.MODE === 'devapp'
