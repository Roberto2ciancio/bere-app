/** Glu in 3D: acceso nell'app e nella devapp dalla 1.10.0; spento nei test unitari (che lo forzano dove serve). */
export const GLU_3D_ENABLED: boolean = import.meta.env.MODE !== 'test'
