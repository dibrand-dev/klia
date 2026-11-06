import { parseISO, differenceInYears } from 'date-fns'
import type { NotaClinica, TurnoRow, Paciente, RegistroAntropometrico, RegistroPIO, RegistroRefraccion, RegistroEspecialidad } from '@/types/database'
import { calcularIMC, clasificarIMC, calcularGEB } from '@/lib/nutricion/calculos'
import { calcularPIOCorregida, calcularEquivalenteEsferico } from '@/lib/oftalmologia/calculos'
import { clasificarTA } from '@/lib/clinica-medica/calculos'
import { severidadPHQ9, severidadGAD7 } from '@/lib/psicologia/calculos'
import { descripcionCie10 } from '@/lib/cie10/server'

// ─── Formato numérico es-AR (coma decimal, signo "−" tipográfico) ──────────
function fmt(n: number, decimales: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}
function fmtDioptria(n: number): string {
  const signo = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${signo}${fmt(Math.abs(n), 2)}`
}
function cie10Chips(codigos: string[]): { codigo: string; descripcion: string }[] {
  return codigos.map((c) => ({ codigo: c, descripcion: descripcionCie10(c) ?? '' }))
}

// ─── Bloques de módulo por especialidad (ya formateados para render) ──────
export type BloqueModulo =
  | { tipo: 'Nutrición'; antro: BloqueNutricion }
  | { tipo: 'Oftalmología'; oftalmologia: BloqueOftalmologia }
  | { tipo: 'Kinesiología'; kinesiologia: BloqueKinesiologia }
  | { tipo: 'Odontología'; odontologia: BloqueOdontologia }
  | { tipo: 'Psicología'; psicologia: BloquePsicologia }
  | { tipo: 'Clínica Médica'; clinicaMedica: BloqueClinicaMedica }

export interface BloqueNutricion {
  peso: number | null
  altura: number | null
  cintura: number | null
  cadera: number | null
  porcentajeGrasa: number | null
  porcentajeMusculo: number | null
  pliegueTricipital: number | null
  pliegueSubescapular: number | null
  pliegueSuprailiaco: number | null
  pliegueAbdominal: number | null
  perimetroBrazo: number | null
  perimetroPierna: number | null
  imc: { valor: number; label: string } | null
  geb: number | null
  indiceCinturaCadera: number | null
}

export interface BloqueOftalmologia {
  pio: {
    od: { avSc: string | null; avCc: string | null; pioMedida: number | null; paquimetria: number | null; pioCorregida: number | null }
    oi: { avSc: string | null; avCc: string | null; pioMedida: number | null; paquimetria: number | null; pioCorregida: number | null }
  } | null
  refraccion: {
    od: { sph: number | null; cyl: number | null; axis: number | null; add: number | null; equivEsferico: number | null }
    oi: { sph: number | null; cyl: number | null; axis: number | null; add: number | null; equivEsferico: number | null }
  } | null
  biomicroscopia: string | null
  fondoDeOjo: string | null
  cie10: { codigo: string; descripcion: string }[]
}

export interface BloqueKinesiologia {
  eva: number | null
  zona: string | null
  lado: string | null
  movimiento: string | null
  rom: number | null
  daniels: string | null
  sesionActual: number | null
  sesionesTotal: number | null
}

export interface BloqueOdontologia {
  filas: { pieza: string; caras: string; prestacion: string }[]
  cie10: { codigo: string; descripcion: string }[]
}

export interface BloquePsicologia {
  phq: number | null
  phqSeveridad: string | null
  gad: number | null
  gadSeveridad: string | null
  riesgo: string | null
}

export interface BloqueClinicaMedica {
  tas: number | null
  tad: number | null
  taAlerta: boolean
  taClasificacion: string | null
  fc: number | null
  fr: number | null
  temp: number | null
  sat: number | null
  imc: { valor: number; label: string } | null
  cie10: { codigo: string; descripcion: string }[]
}

export interface NotaParaImprimir {
  id: string
  fecha: string
  horaLabel: string
  tipoTurnoLabel: string | null
  modalidadLabel: string | null
  contenidoHtml: string
  modulo: BloqueModulo | null
}

export interface RegistroSueltoParaImprimir {
  id: string
  fecha: string
  horaLabel: string | null
  tituloModulo: string
  modulo: BloqueModulo
}

export interface HistorialParaImprimir {
  notas: NotaParaImprimir[]
  registrosSueltos: RegistroSueltoParaImprimir[]
  rangoFechas: { desde: string; hasta: string } | null
}

const MODALIDAD_LABEL: Record<string, string> = {
  videollamada: 'Virtual',
  telefonica: 'Telefónica',
  presencial: 'Presencial',
}

function horaDeNota(nota: { hora_nota: string | null; created_at: string }): string {
  const iso = nota.hora_nota ?? nota.created_at
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
}

function edadA(fechaReferenciaISO: string, fechaNacimientoISO: string | null): number | null {
  if (!fechaNacimientoISO) return null
  return differenceInYears(parseISO(fechaReferenciaISO), parseISO(fechaNacimientoISO))
}

function sexoParaGEB(genero: string | null): 'M' | 'F' | null {
  return genero === 'M' || genero === 'F' ? genero : null
}

function armarBloqueNutricion(r: RegistroAntropometrico, paciente: Paciente): BloqueNutricion {
  const imcValor = calcularIMC(r.peso, r.altura)
  const sexo = sexoParaGEB(paciente.genero)
  const edad = edadA(r.fecha, paciente.fecha_nacimiento)
  const geb = sexo != null && edad != null ? calcularGEB(r.peso, r.altura, edad, sexo, 'mifflin') : null
  const indiceCC = r.cintura && r.cadera ? r.cintura / r.cadera : null
  return {
    peso: r.peso, altura: r.altura, cintura: r.cintura, cadera: r.cadera,
    porcentajeGrasa: r.porcentaje_grasa, porcentajeMusculo: r.porcentaje_musculo,
    pliegueTricipital: r.pliegue_tricipital, pliegueSubescapular: r.pliegue_subescapular,
    pliegueSuprailiaco: r.pliegue_suprailiaco, pliegueAbdominal: r.pliegue_abdominal,
    perimetroBrazo: r.perimetro_brazo, perimetroPierna: r.perimetro_pierna,
    imc: imcValor != null ? { valor: imcValor, label: clasificarIMC(imcValor).label } : null,
    geb,
    indiceCinturaCadera: indiceCC,
  }
}

function avDesdeEspecialidad(datos: Record<string, unknown> | null, campo: 'av_sc' | 'av_cc', ojo: 'od' | 'oi'): string | null {
  const grupo = datos?.[campo] as { od?: string | null; oi?: string | null } | undefined
  return grupo?.[ojo] ?? null
}

function armarBloqueOftalmologia(
  pio: RegistroPIO | null,
  refraccion: RegistroRefraccion | null,
  especialidad: RegistroEspecialidad | null,
): BloqueOftalmologia {
  const datos = (especialidad?.datos as Record<string, unknown> | undefined) ?? null
  const hayPio = !!pio && (pio.pio_medida_od != null || pio.pio_medida_oi != null)
  const hayAv = !!datos && (avDesdeEspecialidad(datos, 'av_sc', 'od') || avDesdeEspecialidad(datos, 'av_sc', 'oi') || avDesdeEspecialidad(datos, 'av_cc', 'od') || avDesdeEspecialidad(datos, 'av_cc', 'oi'))
  const hayRefraccion = !!refraccion && (refraccion.sph_od != null || refraccion.sph_oi != null)

  const pioBloque = (hayPio || hayAv) ? {
    od: {
      avSc: avDesdeEspecialidad(datos, 'av_sc', 'od'),
      avCc: avDesdeEspecialidad(datos, 'av_cc', 'od'),
      pioMedida: pio?.pio_medida_od ?? null,
      paquimetria: pio?.paquimetria_od ?? null,
      pioCorregida: calcularPIOCorregida(pio?.pio_medida_od ?? null, pio?.paquimetria_od ?? null),
    },
    oi: {
      avSc: avDesdeEspecialidad(datos, 'av_sc', 'oi'),
      avCc: avDesdeEspecialidad(datos, 'av_cc', 'oi'),
      pioMedida: pio?.pio_medida_oi ?? null,
      paquimetria: pio?.paquimetria_oi ?? null,
      pioCorregida: calcularPIOCorregida(pio?.pio_medida_oi ?? null, pio?.paquimetria_oi ?? null),
    },
  } : null

  const refraccionBloque = hayRefraccion ? {
    od: {
      sph: refraccion!.sph_od, cyl: refraccion!.cyl_od, axis: refraccion!.axis_od, add: refraccion!.add_od,
      equivEsferico: refraccion!.sph_od != null ? calcularEquivalenteEsferico(refraccion!.sph_od, refraccion!.cyl_od ?? 0) : null,
    },
    oi: {
      sph: refraccion!.sph_oi, cyl: refraccion!.cyl_oi, axis: refraccion!.axis_oi, add: refraccion!.add_oi,
      equivEsferico: refraccion!.sph_oi != null ? calcularEquivalenteEsferico(refraccion!.sph_oi, refraccion!.cyl_oi ?? 0) : null,
    },
  } : null

  return {
    pio: pioBloque,
    refraccion: refraccionBloque,
    biomicroscopia: (datos?.biomicroscopia as string | null) ?? null,
    fondoDeOjo: (datos?.fondo_de_ojo as string | null) ?? null,
    cie10: cie10Chips((datos?.cie10 as string[]) ?? []),
  }
}

function armarBloqueKinesiologia(datos: Record<string, unknown>): BloqueKinesiologia {
  const n = (k: string) => { const v = Number(datos[k]); return Number.isFinite(v) ? v : null }
  return {
    eva: n('eva'), zona: (datos.zona as string) || null, lado: (datos.lado as string) || null,
    movimiento: (datos.mov as string) || null, rom: n('rom'), daniels: (datos.daniels as string) || null,
    sesionActual: n('ses'), sesionesTotal: n('sest'),
  }
}

function armarBloqueOdontologia(datos: Record<string, unknown>): BloqueOdontologia {
  const piezas = (datos.piezas as string[]) ?? []
  const caras = ((datos.caras as string[]) ?? []).join(' · ')
  const prestacion = (datos.prestacion as string) || '—'
  // `caras` y `prestacion` son valores ÚNICOS para toda la prestación (no hay
  // un desglose por pieza en el modelo de datos real — ver ModuloOdontologia.tsx,
  // Odontograma selecciona piezas y "Caras"/"Prestación" son un único campo
  // compartido), así que se repiten en cada fila para que la tabla tenga una
  // fila por pieza sin inventar un dato por-pieza que no existe.
  return {
    filas: piezas.map((p) => ({ pieza: p, caras: caras || '—', prestacion })),
    cie10: cie10Chips((datos.cie10 as string[]) ?? []),
  }
}

function armarBloquePsicologia(datos: Record<string, unknown>): BloquePsicologia {
  const phq = Number.isFinite(Number(datos.phq)) ? Number(datos.phq) : null
  const gad = Number.isFinite(Number(datos.gad)) ? Number(datos.gad) : null
  return {
    phq, phqSeveridad: phq != null ? severidadPHQ9(phq) : null,
    gad, gadSeveridad: gad != null ? severidadGAD7(gad) : null,
    riesgo: (datos.riesgo as string) || null,
  }
}

function armarBloqueClinicaMedica(datos: Record<string, unknown>): BloqueClinicaMedica {
  const n = (k: string) => { const v = Number(datos[k]); return Number.isFinite(v) ? v : null }
  const tas = n('tas'); const tad = n('tad')
  const clasificacion = tas != null && tad != null ? clasificarTA(tas, tad) : null
  const peso = n('peso'); const alt = n('alt')
  const imcValor = calcularIMC(peso, alt)
  return {
    tas, tad, taAlerta: clasificacion != null && clasificacion !== 'Normal', taClasificacion: clasificacion,
    fc: n('fc'), fr: n('fr'), temp: n('temp'), sat: n('sat'),
    imc: imcValor != null ? { valor: imcValor, label: clasificarIMC(imcValor).label } : null,
    cie10: cie10Chips((datos.cie10 as string[]) ?? []),
  }
}

export const TITULO_MODULO: Record<string, string> = {
  'Nutrición': 'Datos antropométricos',
  'Oftalmología': 'Examen oftalmológico',
  'Kinesiología': 'Evaluación kinésica',
  'Odontología': 'Prestación odontológica',
  'Psicología': 'Escalas y riesgo',
  'Clínica Médica': 'Signos vitales',
}

interface Params {
  especialidadProfesional: string | null
  paciente: Paciente
  notas: NotaClinica[]
  turnos: TurnoRow[]
  registrosAntropometricos: RegistroAntropometrico[]
  registrosPio: RegistroPIO[]
  registrosRefraccion: RegistroRefraccion[]
  registrosEspecialidad: RegistroEspecialidad[]
}

// Pura — sin I/O. El caller (la page) hace los fetch y le pasa todo ya
// traído; esta función solo resuelve el join mixto nota_id/turno_id entre
// notas_clinicas y las 4 tablas de módulo, y arma el view-model ya
// formateado para el render (KL1-T40).
export function armarHistorialParaImprimir(params: Params): HistorialParaImprimir {
  const { especialidadProfesional, paciente, notas, turnos, registrosAntropometricos, registrosPio, registrosRefraccion, registrosEspecialidad } = params

  const notasOrdenadas = [...notas]
    .filter((n) => !n.borrador)
    .sort((a, b) => (a.fecha + a.created_at).localeCompare(b.fecha + b.created_at))

  const turnosById = new Map(turnos.map((t) => [t.id, t]))
  const especialidadByNotaId = new Map(registrosEspecialidad.filter((r) => r.nota_id).map((r) => [r.nota_id as string, r]))

  const consumidoAntro = new Set<string>()
  const consumidoPio = new Set<string>()
  const consumidoRefraccion = new Set<string>()
  const consumidoEspecialidadIds = new Set<string>()

  function tomarPorTurno<T extends { turno_id: string | null }>(lista: T[], consumidos: Set<string>, turnoId: string | null): T | null {
    if (!turnoId || consumidos.has(turnoId)) return null
    const fila = lista.find((r) => r.turno_id === turnoId)
    if (fila) consumidos.add(turnoId)
    return fila ?? null
  }

  const notasParaImprimir: NotaParaImprimir[] = notasOrdenadas.map((nota) => {
    const turno = nota.turno_id ? turnosById.get(nota.turno_id) ?? null : null

    let modulo: BloqueModulo | null = null
    if (especialidadProfesional === 'Nutrición') {
      const r = tomarPorTurno(registrosAntropometricos, consumidoAntro, nota.turno_id)
      if (r) modulo = { tipo: 'Nutrición', antro: armarBloqueNutricion(r, paciente) }
    } else if (especialidadProfesional === 'Oftalmología') {
      const pio = tomarPorTurno(registrosPio, consumidoPio, nota.turno_id)
      const refraccion = tomarPorTurno(registrosRefraccion, consumidoRefraccion, nota.turno_id)
      const especialidad = especialidadByNotaId.get(nota.id) ?? null
      if (especialidad) consumidoEspecialidadIds.add(especialidad.id)
      if (pio || refraccion || especialidad) {
        modulo = { tipo: 'Oftalmología', oftalmologia: armarBloqueOftalmologia(pio, refraccion, especialidad) }
      }
    } else if (['Kinesiología', 'Odontología', 'Psicología', 'Clínica Médica'].includes(especialidadProfesional ?? '')) {
      const especialidad = especialidadByNotaId.get(nota.id) ?? null
      if (especialidad) {
        consumidoEspecialidadIds.add(especialidad.id)
        const datos = especialidad.datos as Record<string, unknown>
        if (especialidadProfesional === 'Kinesiología') modulo = { tipo: 'Kinesiología', kinesiologia: armarBloqueKinesiologia(datos) }
        else if (especialidadProfesional === 'Odontología') modulo = { tipo: 'Odontología', odontologia: armarBloqueOdontologia(datos) }
        else if (especialidadProfesional === 'Psicología') modulo = { tipo: 'Psicología', psicologia: armarBloquePsicologia(datos) }
        else if (especialidadProfesional === 'Clínica Médica') modulo = { tipo: 'Clínica Médica', clinicaMedica: armarBloqueClinicaMedica(datos) }
      }
    }

    return {
      id: nota.id,
      fecha: nota.fecha,
      horaLabel: horaDeNota(nota),
      tipoTurnoLabel: turno?.tipo_turno ?? null,
      modalidadLabel: turno ? MODALIDAD_LABEL[turno.modalidad] ?? null : null,
      contenidoHtml: nota.contenido,
      modulo,
    }
  })

  // ─── Registros sin nota asociada ──────────────────────────────────────
  const sueltos: RegistroSueltoParaImprimir[] = []

  for (const r of registrosAntropometricos) {
    if (r.turno_id && consumidoAntro.has(r.turno_id)) continue
    sueltos.push({
      id: r.id, fecha: r.fecha, horaLabel: null,
      tituloModulo: TITULO_MODULO['Nutrición'],
      modulo: { tipo: 'Nutrición', antro: armarBloqueNutricion(r, paciente) },
    })
  }

  const refraccionSueltasPorTurno = new Set<string | null>()
  for (const r of registrosPio) {
    if (r.turno_id && consumidoPio.has(r.turno_id)) continue
    const refraccionMismoTurno = r.turno_id ? registrosRefraccion.find((x) => x.turno_id === r.turno_id && !consumidoRefraccion.has(r.turno_id!)) : undefined
    if (refraccionMismoTurno) { consumidoRefraccion.add(r.turno_id!); refraccionSueltasPorTurno.add(r.turno_id) }
    const turno = r.turno_id ? turnosById.get(r.turno_id) ?? null : null
    sueltos.push({
      id: r.id, fecha: r.fecha, horaLabel: turno ? horaDeNota({ hora_nota: null, created_at: turno.fecha_hora }) : null,
      tituloModulo: TITULO_MODULO['Oftalmología'],
      modulo: { tipo: 'Oftalmología', oftalmologia: armarBloqueOftalmologia(r, refraccionMismoTurno ?? null, null) },
    })
  }
  for (const r of registrosRefraccion) {
    if (r.turno_id && (consumidoRefraccion.has(r.turno_id) || refraccionSueltasPorTurno.has(r.turno_id))) continue
    const turno = r.turno_id ? turnosById.get(r.turno_id) ?? null : null
    const fecha = turno ? turno.fecha_hora.slice(0, 10) : new Date(new Date(r.created_at).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
    sueltos.push({
      id: r.id, fecha, horaLabel: turno ? horaDeNota({ hora_nota: null, created_at: turno.fecha_hora }) : null,
      tituloModulo: TITULO_MODULO['Oftalmología'],
      modulo: { tipo: 'Oftalmología', oftalmologia: armarBloqueOftalmologia(null, r, null) },
    })
  }

  for (const r of registrosEspecialidad) {
    if (consumidoEspecialidadIds.has(r.id)) continue
    const titulo = TITULO_MODULO[r.especialidad] ?? r.especialidad
    const datos = r.datos as Record<string, unknown>
    let modulo: BloqueModulo | null = null
    if (r.especialidad === 'Oftalmología') modulo = { tipo: 'Oftalmología', oftalmologia: armarBloqueOftalmologia(null, null, r) }
    else if (r.especialidad === 'Kinesiología') modulo = { tipo: 'Kinesiología', kinesiologia: armarBloqueKinesiologia(datos) }
    else if (r.especialidad === 'Odontología') modulo = { tipo: 'Odontología', odontologia: armarBloqueOdontologia(datos) }
    else if (r.especialidad === 'Psicología') modulo = { tipo: 'Psicología', psicologia: armarBloquePsicologia(datos) }
    else if (r.especialidad === 'Clínica Médica') modulo = { tipo: 'Clínica Médica', clinicaMedica: armarBloqueClinicaMedica(datos) }
    if (!modulo) continue
    sueltos.push({ id: r.id, fecha: r.fecha, horaLabel: null, tituloModulo: titulo, modulo })
  }

  sueltos.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const todasFechas = [...notasParaImprimir.map((n) => n.fecha), ...sueltos.map((s) => s.fecha)].sort()
  const rangoFechas = todasFechas.length > 0 ? { desde: todasFechas[0], hasta: todasFechas[todasFechas.length - 1] } : null

  return { notas: notasParaImprimir, registrosSueltos: sueltos, rangoFechas }
}

export { fmt, fmtDioptria }
