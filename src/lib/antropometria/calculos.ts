// Cálculos antropométricos ISAK. Librería pura: sin dependencias, sin I/O.
// Corre igual en cliente y servidor. Todo se calcula al leer, nada se persiste.
// Si falta un dato, el indicador dependiente es null y `faltan` dice qué falta.

import {
  CATEGORIAS_MUSCULO_OSEO, CORTES_SALUD, EDAD_ADULTO, PHANTOM, RANGOS_MUSCULO_OSEO, TALLA_PHANTOM,
  type CategoriaMusculoOseo, type Sexo, type VariablePhantom,
} from './constantes'

type N = number | null | undefined

export interface Medidas {
  masa?: N; talla?: N; tallaSentado?: N; envergadura?: N
  // pliegues (mm)
  triceps?: N; subescapular?: N; biceps?: N; crestaIliaca?: N
  supraespinal?: N; abdominal?: N; muslo?: N; pantorrilla?: N
  // perímetros (cm)
  brazoRelajado?: N; brazoContraido?: N; cintura?: N; cadera?: N; musloMedio?: N; pierna?: N
  // diámetros (cm)
  humero?: N; biestiloideo?: N; femur?: N
}

export interface Paciente { sexo: Sexo | null; edad: number }

export interface Tejidos {
  adiposo: number | null; muscular: number | null; oseo: number | null; residual: number | null
}

export interface Resultado {
  esAdulto: boolean
  sumatorias: { s6: number | null; s8: number | null }
  corregidos: { brazo: number | null; muslo: number | null; pierna: number | null }
  tejidos: Tejidos | null // null en menores
  indices: {
    adiposoMuscular: number | null
    musculoOseo: number | null
    musculoOseoCategoria: CategoriaMusculoOseo | null
    cormico: number | null
    manouvrier: number | null
    envergaduraRelativa: number | null
  }
  somatotipo: {
    endo: number | null; meso: number | null; ecto: number | null
    x: number | null; y: number | null
  }
  salud: {
    imc: number | null
    imcClasificacion: 'bajo' | 'normal' | 'sobrepeso' | 'obesidad' | null // null en menores
    cinturaCadera: number | null
    cinturaTalla: number | null
    conicidad: number | null
  }
  /** Mapa indicador → medidas que faltan para calcularlo. Solo incluye indicadores no calculables. */
  faltan: Record<string, string[]>
}

const num = (v: N): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const todos = (...v: (number | null)[]): boolean => v.every((x) => x !== null)
export const redondear = (v: number | null, dec = 2): number | null =>
  v === null ? null : Math.round((v + Number.EPSILON) * 10 ** dec) / 10 ** dec

/** Z-score Phantom. null si falta el valor o la talla. */
export function zPhantom(variable: VariablePhantom, valor: N, talla: N): number | null {
  const v = num(valor), h = num(talla)
  if (v === null || h === null || h <= 0) return null
  const [p, s, d] = PHANTOM[variable]
  return (v * (TALLA_PHANTOM / h) ** d - p) / s
}

export function categoriaMusculoOseo(
  valor: number, sexo: Sexo, rangos = RANGOS_MUSCULO_OSEO,
): CategoriaMusculoOseo {
  const r = rangos[sexo]
  const i = valor < r[0] ? 0 : valor < r[1] ? 1 : valor < r[2] ? 2 : valor < r[3] ? 3 : 4
  return CATEGORIAS_MUSCULO_OSEO[i]
}

export const categoriaCormico = (v: number) =>
  v < 0.51 ? 'braquicórmico' : v <= 0.53 ? 'metricórmico' : 'macrocórmico'

/** Zona intermedia (85–89): límites de la literatura, sin casos observados. */
export const categoriaManouvrier = (v: number) =>
  v < 85 ? 'miembros inferiores cortos' : v > 89 ? 'miembros inferiores largos' : 'miembros inferiores medios'

export const categoriaEnvergadura = (v: number) =>
  v < 1 ? 'menor a la talla' : v > 1 ? 'mayor a la talla' : 'igual a la talla'

/** Lectura de un componente del somatotipo (Carter y Heath). */
export function lecturaSomatotipo(v: number): 'bajo' | 'moderado' | 'alto' | 'muy alto' {
  return v < 3 ? 'bajo' : v < 5.5 ? 'moderado' : v < 7.5 ? 'alto' : 'muy alto'
}

export function calcular(m: Medidas, pac: Paciente, rangos = RANGOS_MUSCULO_OSEO): Resultado {
  const h = num(m.talla), masa = num(m.masa), sent = num(m.tallaSentado), env = num(m.envergadura)
  const tri = num(m.triceps), sub = num(m.subescapular), bic = num(m.biceps), cre = num(m.crestaIliaca)
  const sup = num(m.supraespinal), abd = num(m.abdominal), mus = num(m.muslo), pan = num(m.pantorrilla)
  const bR = num(m.brazoRelajado), bC = num(m.brazoContraido), cin = num(m.cintura), cad = num(m.cadera)
  const mM = num(m.musloMedio), pie = num(m.pierna)
  const hum = num(m.humero), bie = num(m.biestiloideo), fem = num(m.femur)
  const esAdulto = pac.edad >= EDAD_ADULTO
  const faltan: Record<string, string[]> = {}
  const req = (clave: string, pares: [string, number | null][]) => {
    const f = pares.filter(([, v]) => v === null).map(([n]) => n)
    if (f.length) faltan[clave] = f
  }

  const k = h !== null ? TALLA_PHANTOM / h : null

  // Sumatorias
  const s6 = todos(tri, sub, sup, abd, mus, pan) ? tri! + sub! + sup! + abd! + mus! + pan! : null
  const s8 = s6 !== null && bic !== null && cre !== null ? s6 + bic + cre : null
  req('s6', [['tríceps', tri], ['subescapular', sub], ['supraespinal', sup], ['abdominal', abd], ['muslo', mus], ['pantorrilla', pan]])
  req('s8', [['bíceps', bic], ['cresta ilíaca', cre], ...(s6 === null ? ([['Σ6', null]] as [string, number | null][]) : [])])

  // Perímetros corregidos (resta simple de π · pliegue/10)
  const cBrazo = bR !== null && tri !== null ? bR - (Math.PI * tri) / 10 : null
  const cMuslo = mM !== null && mus !== null ? mM - (Math.PI * mus) / 10 : null
  const cPierna = pie !== null && pan !== null ? pie - (Math.PI * pan) / 10 : null

  // Composición tisular: solo adultos
  let tejidos: Tejidos | null = null
  if (esAdulto) {
    let adiposo: number | null = null, muscular: number | null = null, oseo: number | null = null
    if (s6 !== null && h !== null && k !== null) {
      const z6 = (s6 * k - 116.41) / 34.79
      adiposo = (z6 * 5.85 + 25.6) * (h / TALLA_PHANTOM) ** 3
    }
    if (cBrazo !== null && cMuslo !== null && cPierna !== null && h !== null && pac.sexo !== null) {
      const sexo = pac.sexo === 'M' ? 1 : 0
      muscular =
        (h / 100) * (0.00744 * cBrazo ** 2 + 0.00088 * cMuslo ** 2 + 0.00441 * cPierna ** 2) +
        2.4 * sexo - 0.048 * pac.edad + 7.8
    }
    if (h !== null && bie !== null && fem !== null) {
      oseo = 3.02 * ((h / 100) ** 2 * (bie / 100) * (fem / 100) * 400) ** 0.712
    }
    const residual = masa !== null && adiposo !== null && muscular !== null && oseo !== null ? masa - (adiposo + muscular + oseo) : null
    tejidos = { adiposo, muscular, oseo, residual }
    req('adiposo', [['talla', h], ...(s6 === null ? ([['Σ6 pliegues', null]] as [string, number | null][]) : [])])
    req('muscular', [['talla', h], ['perímetro brazo relajado', bR], ['tríceps', tri], ['perímetro muslo medio', mM], ['muslo (pliegue)', mus], ['perímetro pierna', pie], ['pantorrilla (pliegue)', pan], ['sexo', pac.sexo === null ? null : 1]])
    req('oseo', [['talla', h], ['diámetro biestiloideo', bie], ['diámetro fémur', fem]])
    req('residual', [['masa', masa]])
  }

  // Somatotipo Heath-Carter
  let endo: number | null = null, meso: number | null = null, ecto: number | null = null
  if (tri !== null && sub !== null && sup !== null && k !== null) {
    const X = (tri + sub + sup) * k
    endo = Math.max(0.1, -0.7182 + 0.1451 * X - 0.00068 * X ** 2 + 0.0000014 * X ** 3)
  }
  if (hum !== null && fem !== null && bC !== null && tri !== null && pie !== null && pan !== null && h !== null) {
    meso = Math.max(0.1, 0.858 * hum + 0.601 * fem + 0.188 * (bC - tri / 10) + 0.161 * (pie - pan / 10) - 0.131 * h + 4.5)
  }
  if (h !== null && masa !== null && masa > 0) {
    const hwr = h / Math.cbrt(masa)
    ecto = hwr >= 40.75 ? 0.732 * hwr - 28.58 : hwr > 38.25 ? 0.463 * hwr - 17.63 : 0.1
    ecto = Math.max(0.1, ecto)
  }
  req('endo', [['talla', h], ['tríceps', tri], ['subescapular', sub], ['supraespinal', sup]])
  req('meso', [['talla', h], ['diámetro húmero', hum], ['diámetro fémur', fem], ['perímetro brazo contraído', bC], ['tríceps', tri], ['perímetro pierna', pie], ['pantorrilla (pliegue)', pan]])
  req('ecto', [['talla', h], ['masa', masa]])
  const sx = ecto !== null && endo !== null ? ecto - endo : null
  const sy = endo !== null && meso !== null && ecto !== null ? 2 * meso - (endo + ecto) : null

  // Índices de tejidos
  const adiMus = tejidos && tejidos.adiposo !== null && tejidos.muscular ? tejidos.adiposo / tejidos.muscular : null
  const musOseo = tejidos && tejidos.muscular !== null && tejidos.oseo ? tejidos.muscular / tejidos.oseo : null

  // Proporciones (se calculan con el valor redondeado a 2 decimales, como ISAKMetry)
  const cormico = sent !== null && h ? sent / h : null
  const manouvrier = sent && h !== null ? ((h - sent) / sent) * 100 : null
  const envRel = env !== null && h ? redondear(env / h, 2) : null
  req('cormico', [['talla', h], ['talla sentado', sent]])
  req('manouvrier', [['talla', h], ['talla sentado', sent]])
  req('envergaduraRelativa', [['talla', h], ['envergadura', env]])

  // Salud
  const imc = masa !== null && h ? masa / (h / 100) ** 2 : null
  const imcClasificacion = !esAdulto || imc === null ? null : imc < 18.5 ? 'bajo' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad'
  const icc = cin !== null && cad ? cin / cad : null
  const ict = cin !== null && h ? cin / h : null
  const con = cin !== null && masa !== null && h ? cin / 100 / (0.109 * Math.sqrt(masa / (h / 100))) : null
  req('imc', [['masa', masa], ['talla', h]])
  req('cinturaCadera', [['cintura', cin], ['cadera', cad]])
  req('cinturaTalla', [['cintura', cin], ['talla', h]])
  req('conicidad', [['cintura', cin], ['masa', masa], ['talla', h]])

  const mo = redondear(musOseo, 2)
  return {
    esAdulto,
    sumatorias: { s6, s8 },
    corregidos: { brazo: cBrazo, muslo: cMuslo, pierna: cPierna },
    tejidos,
    indices: {
      adiposoMuscular: adiMus,
      musculoOseo: musOseo,
      musculoOseoCategoria: mo !== null && pac.sexo !== null ? categoriaMusculoOseo(mo, pac.sexo, rangos) : null,
      cormico: redondear(cormico, 2),
      manouvrier,
      envergaduraRelativa: envRel,
    },
    somatotipo: { endo, meso, ecto, x: sx, y: sy },
    salud: { imc, imcClasificacion, cinturaCadera: icc, cinturaTalla: ict, conicidad: con },
    faltan,
  }
}

export { CORTES_SALUD }
