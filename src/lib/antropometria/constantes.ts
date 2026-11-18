// Constantes de la librería de antropometría ISAK.
// Las constantes Phantom (p, s, d) fueron validadas numéricamente contra 4 informes
// reales de ISAKMetry (75/75 valores), pero no tienen cita formal. Ver spec §4.

/** Talla del Phantom (cm) y su desvío estándar — para el Z-score de la talla misma. */
export const TALLA_PHANTOM = 170.18
export const TALLA_PHANTOM_SD = 6.29

export type VariablePhantom =
  | 'masa' | 'tallaSentado' | 'envergadura'
  | 'triceps' | 'subescapular' | 'biceps' | 'crestaIliaca' | 'supraespinal'
  | 'abdominal' | 'muslo' | 'pantorrilla'
  | 'brazoRelajado' | 'brazoContraido' | 'cintura' | 'cadera' | 'musloMedio' | 'pierna'
  | 'humero' | 'biestiloideo' | 'femur'
  | 'brazoCorregido' | 'musloCorregido' | 'piernaCorregida'
  | 'adiposo' | 'muscular' | 'oseo'

/** [p, s, d]: Z = (v · (170,18/h)^d − p) / s */
export const PHANTOM: Record<VariablePhantom, readonly [number, number, number]> = {
  masa: [64.58, 8.6, 3],
  tallaSentado: [89.92, 4.5, 1],
  // Faltaba en la librería (solo se usaba para talla sentado y diámetros): se agrega
  // para el Z-score de envergadura en la tabla "Medidas básicas" del informe profesional.
  envergadura: [172.35, 7.41, 1],
  triceps: [15.4, 4.47, 1],
  subescapular: [17.2, 5.07, 1],
  biceps: [8.0, 2.0, 1],
  crestaIliaca: [22.4, 6.8, 1],
  supraespinal: [15.4, 4.47, 1],
  abdominal: [25.4, 7.78, 1],
  muslo: [27.0, 8.33, 1],
  pantorrilla: [16.0, 4.67, 1],
  brazoRelajado: [26.89, 2.33, 1],
  brazoContraido: [29.41, 2.37, 1],
  cintura: [71.91, 4.45, 1],
  cadera: [94.67, 5.58, 1],
  musloMedio: [53.21, 4.55, 1],
  pierna: [35.25, 2.3, 1],
  humero: [6.48, 0.35, 1],
  biestiloideo: [5.21, 0.28, 1],
  femur: [9.52, 0.48, 1],
  brazoCorregido: [22.05, 1.91, 1],
  musloCorregido: [47.34, 3.59, 1],
  piernaCorregida: [30.21, 1.98, 1],
  adiposo: [25.6, 5.85, 3],
  muscular: [25.55, 2.99, 3],
  oseo: [10.49, 1.57, 3],
}

/** Rangos del índice músculo/óseo. Defaults; en producción se leen de `antropometria_rangos`. */
export type Sexo = 'M' | 'F'
export const CATEGORIAS_MUSCULO_OSEO = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'] as const
export type CategoriaMusculoOseo = (typeof CATEGORIAS_MUSCULO_OSEO)[number]

/** 4 puntos de corte por sexo: separan las 5 categorías. */
export const RANGOS_MUSCULO_OSEO: Record<Sexo, readonly [number, number, number, number]> = {
  F: [2.01, 2.11, 2.78, 2.96],
  M: [2.34, 2.44, 3.11, 3.29],
}

/** Cortes de salud (OMS para cintura/cadera). Conicidad <1,40: sin validar (de ISAKMetry). */
export const CORTES_SALUD = {
  cinturaCadera: { F: 0.85, M: 0.9 } as Record<Sexo, number>,
  cinturaTalla: 0.5,
  conicidad: 1.4,
}

// Aprobado por la nutricionista el 17/11/2026: cortes de conicidad por sexo, del diseño del
// informe profesional. No reemplazan a CORTES_SALUD.conicidad (genérico, 1.4) — nada fuera de
// esta librería lo usa para clasificar hoy, así que no se tocó.
export const CORTES_CONICIDAD_POR_SEXO: Record<Sexo, number> = { M: 1.25, F: 1.18 }

export const EDAD_ADULTO = 18
