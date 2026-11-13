/** Fase A: le varianti di Glu si vedono solo nell'app di prova. In produzione Glu resta quello classico. */
export const GLU_VARIANTS = import.meta.env?.MODE === 'devapp'
