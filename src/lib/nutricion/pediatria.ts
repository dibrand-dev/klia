// Clasificación pediátrica de IMC-para-la-edad y talla-para-la-edad según las
// tablas OMS (Child Growth Standards 0-5 años + WHO Reference 2007 5-19 años).
// Librería pura: sin dependencias de React/Supabase. El archivo de datos
// (oms/oms-lms.json) se carga con import() dinámico desde clasificarPediatrico
// — recién cuando ya se sabe que el paciente es menor de 18 — para no inflar
// el bundle de adultos.

export type Sexo = 'M' | 'F'
export type Tabla = 'dias' | 'meses'
export type LMS = [number, number, number]
export type CategoriaIMC = 'bajo_peso' | 'adecuado' | 'sobrepeso' | 'obesidad'
export type CategoriaTalla = 'adecuada' | 'baja_talla'
type Banda = 'A' | 'B'

export interface TablaOMSIndicador {
  dias: LMS[]
  meses: LMS[]
}

export interface TablaOMS {
  fuente: string
  uso: string
  dias: { desde: number; hasta: number }
  meses: { desde: number; hasta: number }
  bmi: { M: TablaOMSIndicador; F: TablaOMSIndicador }
  talla: { M: TablaOMSIndicador; F: TablaOMSIndicador }
}

export interface ResultadoPediatrico {
  imc: number
  imcZ: number
  imcCategoria: CategoriaIMC
  tallaZ: number
  tallaCategoria: CategoriaTalla
  edadMeses: number
}

// yyyy-mm-dd → UTC, sin depender del huso horario del proceso.
function parseFechaUTC(fecha: string): { y: number; m: number; d: number; utc: number } {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  return { y, m, d, utc: Date.UTC(y, m - 1, d) }
}

export function edad(fechaNacimiento: string, fechaReferencia: string): { dias: number; mesesCompletos: number } {
  const nac = parseFechaUTC(fechaNacimiento)
  const ref = parseFechaUTC(fechaReferencia)
  const dias = Math.round((ref.utc - nac.utc) / 86400000)
  let mesesCompletos = (ref.y - nac.y) * 12 + (ref.m - nac.m)
  if (ref.d < nac.d) mesesCompletos -= 1
  return { dias, mesesCompletos }
}

/** Z-score LMS: ((valor/M)^L − 1)/(L·S) si L≠0; ln(valor/M)/S si L=0. */
export function z(valor: number, L: number, M: number, S: number): number {
  return L === 0 ? Math.log(valor / M) / S : (Math.pow(valor / M, L) - 1) / (L * S)
}

/** Inversa de z(): valor correspondiente a un z-score dado. Se usa para
 * convertir los cortes (-2, +1, +2, +3) a unidades reales y comparar por
 * valor — nunca por z — así los bordes no dependen de redondeos del lado z. */
function x(zScore: number, L: number, M: number, S: number): number {
  return L === 0 ? M * Math.exp(S * zScore) : M * Math.pow(1 + L * S * zScore, 1 / L)
}

function categoriaIMC(valor: number, [L, M, S]: LMS, banda: Banda): CategoriaIMC {
  const corteBajo = x(-2, L, M, S)
  const corteAdecuado = banda === 'A' ? x(2, L, M, S) : x(1, L, M, S)
  const corteSobrepeso = banda === 'A' ? x(3, L, M, S) : x(2, L, M, S)
  if (valor < corteBajo) return 'bajo_peso'
  if (valor <= corteAdecuado) return 'adecuado'
  if (valor <= corteSobrepeso) return 'sobrepeso'
  return 'obesidad'
}

function categoriaTalla(valor: number, [L, M, S]: LMS): CategoriaTalla {
  const corte = x(-2, L, M, S)
  return valor < corte ? 'baja_talla' : 'adecuada'
}

function indiceEnSerie(tabla: Tabla, edadIndice: number, mesesDesde: number): number {
  return tabla === 'dias' ? edadIndice : edadIndice - mesesDesde
}

/** Clasifica un único indicador (bmi o talla) contra la tabla OMS ya cargada.
 * `edadIndice` es días si tabla==='dias', meses completos (ya clampeados a
 * ≥61) si tabla==='meses'. Expuesta para los tests de oro, que dan directo
 * ind/sexo/tabla/edad/valor sin pasar por fechas. */
export function clasificarIndicador(
  oms: TablaOMS,
  ind: 'bmi' | 'talla',
  sexo: Sexo,
  tabla: Tabla,
  edadIndice: number,
  valor: number,
): { z: number; categoria: CategoriaIMC | CategoriaTalla } | null {
  const serie = oms[ind][sexo][tabla]
  const idx = indiceEnSerie(tabla, edadIndice, oms.meses.desde)
  const lms = serie[idx]
  if (!lms) return null
  const zScore = z(valor, lms[0], lms[1], lms[2])
  // Banda A solo es posible en la tabla "dias" (dias<1826 < 1856 = tope de esa
  // tabla) — en "meses" siempre es B.
  const banda: Banda = tabla === 'meses' ? 'B' : edadIndice < 1826 ? 'A' : 'B'
  const categoria = ind === 'bmi' ? categoriaIMC(valor, lms, banda) : categoriaTalla(valor, lms)
  return { z: zScore, categoria }
}

export async function clasificarPediatrico(input: {
  sexo: Sexo | null
  fechaNacimiento: string | null
  fechaReferencia: string
  pesoKg: number | null
  tallaCm: number | null
}): Promise<ResultadoPediatrico | null> {
  const { sexo, fechaNacimiento, fechaReferencia, pesoKg, tallaCm } = input
  if (!sexo || !fechaNacimiento) return null
  if (pesoKg == null || tallaCm == null || pesoKg <= 0 || tallaCm <= 0) return null

  const { dias, mesesCompletos } = edad(fechaNacimiento, fechaReferencia)
  if (mesesCompletos < 12 || mesesCompletos >= 216) return null

  const tabla: Tabla = dias <= 1856 ? 'dias' : 'meses'
  const edadIndice = tabla === 'dias' ? dias : Math.max(61, mesesCompletos)
  const imc = pesoKg / (tallaCm / 100) ** 2

  const { default: oms } = (await import('./oms/oms-lms.json')) as unknown as { default: TablaOMS }

  const resBmi = clasificarIndicador(oms, 'bmi', sexo, tabla, edadIndice, imc)
  const resTalla = clasificarIndicador(oms, 'talla', sexo, tabla, edadIndice, tallaCm)
  if (!resBmi || !resTalla) return null
  if (Math.abs(resBmi.z) > 5 || Math.abs(resTalla.z) > 6) return null

  return {
    imc,
    imcZ: resBmi.z,
    imcCategoria: resBmi.categoria as CategoriaIMC,
    tallaZ: resTalla.z,
    tallaCategoria: resTalla.categoria as CategoriaTalla,
    edadMeses: mesesCompletos,
  }
}
