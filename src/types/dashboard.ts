// Formas de salida de las RPC dashboard_resumen / dashboard_serie_mensual
// (klia-staging). Loose pero tipado — evita `any` disperso en page.tsx y
// DashboardClient.tsx.

export interface MontosMoneda {
  valor: number
  cobrado: number
  por_cobrar: number
  por_cobrar_particular: number
  por_cobrar_os: number
}

export interface ResumenBloque {
  sesiones: { total: number; realizadas: number; pendientes: number; no_asistio: number }
  atendidos: number
  nuevos: number
  montos: Record<string, MontosMoneda> | null
}

export interface SparkBucket {
  b: number
  realizadas: number
  atendidos: number
  cobrado: Record<string, number> | null
  por_cobrar: Record<string, number> | null
}

export interface DashboardResumen {
  actual: ResumenBloque
  comparado: ResumenBloque | null
  spark: SparkBucket[]
  ve_cobros: boolean
}

export interface SerieMensualMes {
  mes: string
  montos: Record<string, { cobrado: number; por_cobrar: number }>
}
