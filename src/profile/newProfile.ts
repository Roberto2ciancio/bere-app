/**
 * Profilo nuovo (indice di sei voci, ognuna con la sua pagina): acceso nell'app e nella devapp dalla 1.11.0.
 * Nei test unitari vale false (Profilo di prima, LegacyProfilePage): i test del Profilo nuovo lo forzano con vi.mock.
 */
// Nei test e2e (Node) `import.meta.env` manca: vale come app (Profilo nuovo).
export const NEW_PROFILE: boolean = import.meta.env?.MODE !== 'test'
