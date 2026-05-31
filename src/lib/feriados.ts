export interface Feriado {
  dia: number
  mes: number
  motivo: string
  tipo: 'inamovible' | 'trasladable' | 'puente' | 'no_laborable'
  provincia?: string
}

const cache: Record<string, { data: Feriado[]; fetchedAt: number }> = {}
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function getFeriados(anio: number): Promise<Feriado[]> {
  const key = `nacional-${anio}`
  const cached = cache[key]
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data

  try {
    const res = await fetch(`https://nolaborables.com.ar/api/v2/feriados/${anio}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return []
    const data: Feriado[] = await res.json()
    cache[key] = { data, fetchedAt: Date.now() }
    return data
  } catch {
    return []
  }
}

const PROVINCIA_MAP: Record<string, string> = {
  'Buenos Aires': 'BA',
  'CABA': 'CABA',
  'Ciudad Autónoma de Buenos Aires': 'CABA',
  'Catamarca': 'CT',
  'Chaco': 'CC',
  'Chubut': 'CH',
  'Córdoba': 'CB',
  'Corrientes': 'CN',
  'Entre Ríos': 'ER',
  'Formosa': 'FM',
  'Jujuy': 'JY',
  'La Pampa': 'LP',
  'La Rioja': 'LR',
  'Mendoza': 'MZ',
  'Misiones': 'MN',
  'Neuquén': 'NQ',
  'Río Negro': 'RN',
  'Salta': 'SA',
  'San Juan': 'SJ',
  'San Luis': 'SL',
  'Santa Cruz': 'SC',
  'Santa Fe': 'SF',
  'Santiago del Estero': 'SE',
  'Tierra del Fuego': 'TF',
  'Tucumán': 'TU',
}

export async function getFeriadosProvinciales(anio: number, provincia: string): Promise<Feriado[]> {
  const codigo = PROVINCIA_MAP[provincia]
  if (!codigo) return []

  const key = `provincial-${anio}-${codigo}`
  const cached = cache[key]
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.data

  try {
    const res = await fetch(
      `https://nolaborables.com.ar/api/v2/feriados/${anio}?provincia=${codigo}`,
      { next: { revalidate: 86400 } },
    )
    if (!res.ok) return []
    const data: Feriado[] = await res.json()
    cache[key] = { data, fetchedAt: Date.now() }
    return data
  } catch {
    return []
  }
}

export function esFeriado(fecha: Date, feriados: Feriado[]): Feriado | null {
  const dia = fecha.getDate()
  const mes = fecha.getMonth() + 1
  return feriados.find(f => f.dia === dia && f.mes === mes) ?? null
}

export function getFeriadosDelMes(mes: number, feriados: Feriado[]): number[] {
  return feriados.filter(f => f.mes === mes).map(f => f.dia)
}
