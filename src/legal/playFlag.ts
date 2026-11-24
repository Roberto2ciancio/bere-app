/**
 * Regole di Google Play (blocco, condizioni d'uso, link alle pagine pubbliche): per ora solo nell'app di prova.
 * Le pagine pubbliche in public/ sono già online in entrambe.
 */
export const PLAY_RULES: boolean = import.meta.env?.MODE === 'devapp'
