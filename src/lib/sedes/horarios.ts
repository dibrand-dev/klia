// Lógica pura de sedes/horarios — sin dependencias de React ni Supabase.
// Puerto del algoritmo de detección de solapamiento y cruce de medianoche del
// diseño de referencia (mins/crosses/spans/overlapsOf), usado tanto client-side
// (feedback visual en vivo) como server-side (validación antes de guardar).

export const PALETTE: { c: string; n: string }[] = [
  { c: '#3F519E', n: 'Azul Klia' },
  { c: '#8C6ED8', n: 'Violeta' },
  { c: '#3D9C6B', n: 'Verde' },
  { c: '#41608A', n: 'Azul pizarra' },
  { c: '#C97A3F', n: 'Tierra' },
  { c: '#A8506B', n: 'Vino' },
]

export const SEDE_LIMITS: Record<string, number> = {
  esencial: 1,
  profesional: 3,
  premium: Infinity,
  bonificado: Infinity,
}

export function limiteSedes(plan: string | null | undefined): number {
  return SEDE_LIMITS[plan ?? 'esencial'] ?? 1
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// dia_semana en DB: 0=Lunes ... 6=Domingo (mismo orden que DIAS_SEMANA arriba)
export type Bloque = [string, string] // ["HH:MM", "HH:MM"]

export function mins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function crosses(b: Bloque): boolean {
  return mins(b[1]) <= mins(b[0])
}

export function dur(b: Bloque): string {
  let d = mins(b[1]) - mins(b[0])
  if (d <= 0) d += 1440
  const horas = d / 60
  return `${horas % 1 === 0 ? horas.toFixed(0) : horas.toFixed(1).replace('.', ',')} h`
}

// Expande un bloque que cruza la medianoche en sus dos sub-rangos reales, para
// que la detección de solapamiento sea correcta.
export function spans(b: Bloque): Array<[number, number]> {
  const s = mins(b[0])
  let e = mins(b[1])
  if (e <= s) return [[s, 1440], [0, e]]
  return [[s, e]]
}

// Devuelve los índices (dentro de `list`) de los bloques que se solapan entre sí.
export function overlapsOf(list: Bloque[]): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = spans(list[i])
      const B = spans(list[j])
      if (A.some(a => B.some(b => a[0] < b[1] && b[0] < a[1]))) {
        bad.add(i)
        bad.add(j)
      }
    }
  }
  return bad
}

export function horaFinValida(b: Bloque): boolean {
  // hora_fin distinta de hora_inicio (un bloque de duración 0 no tiene sentido,
  // aunque cruce-de-medianoche con fin === inicio tampoco se puede distinguir de "sin bloque")
  return b[0] !== b[1]
}
