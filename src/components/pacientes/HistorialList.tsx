'use client'

import './historial-list.css'
import './nota-drawer.css'
import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { NotaClinica, TurnoRow } from '@/types/database'
import SlideOver from '@/components/ui/SlideOver'
import NotaContenido, { isHtmlEmpty } from './NotaContenido'
import {
  calcular, medidasDesdeRegistro, fmt, sgn, resumenEvolucionSesion, registroMasRecientePorTurno, turnoIdsSoloMedicion,
  type MedicionBasica,
} from '@/lib/antropometria'

/** Subconjunto de columnas de registros_antropometricos que trae historial/page.tsx. */
interface RegistroAntropoResumen {
  id: string
  turno_id: string | null
  fecha: string
  created_at: string
  peso: number | null
  pliegue_tricipital: number | null
  pliegue_subescapular: number | null
  pliegue_biceps: number | null
  pliegue_cresta_iliaca: number | null
  pliegue_supraespinal: number | null
  pliegue_abdominal: number | null
  pliegue_muslo: number | null
  pliegue_pantorrilla: number | null
}

const DIRECCION_LABEL: Record<string, string> = { aumento: 'aumentó', disminuyo: 'disminuyó', se_mantuvo: 'se mantuvo' }

function stripHtmlAndMarkdown(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, ' ')   // strip HTML tags
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[completar\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function previewContenido(texto: string): string {
  return stripHtmlAndMarkdown(texto)
}

// Hora compartida por la lista y el detalle: la hora real de la nota si la
// tiene, si no la de inserción. Siempre en es-AR 24h, zona ART.
function formatHoraNota(nota: { hora_nota: string | null; created_at: string }): string {
  const iso = nota.hora_nota ?? nota.created_at
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
}

// Formato del bloque de antropometría: "18 abr 2026" (sin punto después del mes).
function formatFechaCorta(fechaIso: string): string {
  return format(parseISO(fechaIso), 'dd MMM yyyy', { locale: es }).replace('.', '')
}

function extraerTags(texto: string): string[] {
  const clean = stripHtmlAndMarkdown(texto)
  const matches = clean.match(/#[a-zA-Z0-9_-]+/g)
  if (!matches) return []
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase()))).slice(0, 4)
}

const MONTH_FULL: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
}

type Props = {
  notas: NotaClinica[]
  turnos: TurnoRow[]
  registrosAntropometricos: RegistroAntropoResumen[]
  pacienteId: string
  proximaSesion?: TurnoRow | null
}

export default function HistorialList({ notas, turnos, registrosAntropometricos, pacienteId, proximaSesion = null }: Props) {
  const router = useRouter()
  const [localNotas, setLocalNotas] = useState<NotaClinica[]>(notas)
  const [selectedNota, setSelectedNota] = useState<NotaClinica | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [contenido, setContenido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardarError, setGuardarError] = useState<string | null>(null)

  useEffect(() => {
    setLocalNotas(notas)
  }, [notas])

  // Sync selectedNota when localNotas updates after router.refresh().
  // selectedNota omitted intentionally — adding it would cause an infinite loop.
  useEffect(() => {
    if (selectedNota) {
      const updated = localNotas.find((n) => n.id === selectedNota.id)
      if (updated) setSelectedNota(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localNotas])

  function abrirNota(nota: NotaClinica) {
    setSelectedNota(nota)
    setEditando(false)
    setContenido(nota.contenido)
    setGuardarError(null)
    setConfirmDeleteId(null)
  }

  function cerrarDrawer() {
    setSelectedNota(null)
    setEditando(false)
    setConfirmDeleteId(null)
  }

  async function handleGuardar() {
    if (!selectedNota || isHtmlEmpty(contenido)) return
    setGuardando(true)
    setGuardarError(null)
    const supabase = createClient()
    const { error } = await supabase.from('notas_clinicas').update({ contenido }).eq('id', selectedNota.id)
    if (error) { setGuardarError('Error al guardar. Intentá de nuevo.'); setGuardando(false); return }
    setEditando(false)
    setGuardando(false)
    router.refresh()
  }

  async function handleDelete(notaId: string) {
    setDeletingId(notaId)
    const supabase = createClient()
    const { error } = await supabase.from('notas_clinicas').delete().eq('id', notaId)
    if (error) {
      setDeletingId(null)
      setConfirmDeleteId(null)
      return
    }
    setLocalNotas((prev) => prev.filter((n) => n.id !== notaId))
    if (selectedNota?.id === notaId) cerrarDrawer()
    setConfirmDeleteId(null)
    setDeletingId(null)
    router.refresh()
  }

  const turnosById = new Map<string, TurnoRow>()
  for (const t of turnos) turnosById.set(t.id, t)

  const chronological = [...localNotas].sort((a, b) =>
    (a.fecha + a.created_at).localeCompare(b.fecha + b.created_at)
  )
  const sessionNoMap = new Map<string, number>()
  chronological.forEach((n, idx) => sessionNoMap.set(n.id, idx + 1))

  function metaDesdeTurno(turno: TurnoRow | null | undefined, sessionNo: number) {
    const modalidad = turno?.modalidad
    const modalidadLabel =
      modalidad === 'videollamada' ? 'Virtual'
      : modalidad === 'telefonica' ? 'Telefónica'
      : modalidad === 'presencial' ? 'Presencial'
      : null
    const modalidadChipClass = modalidad === 'videollamada' ? 'online' : modalidad === 'presencial' ? 'in-person' : 'neutral'
    const duracionLabel = turno?.duracion_min ? `${turno.duracion_min} min` : null
    const isCompletada = turno?.estado === 'realizado'
    const isCancelada = turno?.estado === 'cancelado'
    const isNoAsistio = turno?.estado === 'no_asistio'
    const statusLabel = isCompletada ? 'Completada' : isCancelada ? 'Cancelada' : isNoAsistio ? 'No asistió' : null
    const statusChipClass = isCompletada ? 'ok' : isCancelada ? 'danger' : isNoAsistio ? 'warn' : 'neutral'
    return { modalidadLabel, modalidadChipClass, duracionLabel, statusLabel, statusChipClass, sessionNo }
  }

  function sesionMeta(nota: NotaClinica) {
    const turno = nota.turno_id ? turnosById.get(nota.turno_id) : null
    return metaDesdeTurno(turno, sessionNoMap.get(nota.id) ?? 0)
  }

  // ── Antropometría por sesión ──────────────────────────────────────
  // Orden global ascendente por fecha+created_at — la "medición anterior" de un
  // registro es, sin excepción, el que está inmediatamente antes en este orden
  // (tenga turno o no), tal como se pidió.
  const registrosOrdenados = [...registrosAntropometricos].sort((a, b) =>
    (a.fecha + a.created_at).localeCompare(b.fecha + b.created_at)
  )
  const registroPorTurno = registroMasRecientePorTurno(registrosAntropometricos)

  function medicionAnteriorDe(registro: RegistroAntropoResumen): RegistroAntropoResumen | null {
    const idx = registrosOrdenados.findIndex((r) => r.id === registro.id)
    return idx > 0 ? registrosOrdenados[idx - 1] : null
  }

  function basicaDesdeRegistro(r: RegistroAntropoResumen): MedicionBasica {
    const resultado = calcular(medidasDesdeRegistro(r), { sexo: null, edad: null })
    return { peso: r.peso ?? null, s6: resultado.sumatorias.s6, s8: resultado.sumatorias.s8 }
  }

  function BloqueAntropometria({ registro, solo }: { registro: RegistroAntropoResumen; solo: boolean }) {
    const previo = medicionAnteriorDe(registro)
    const resumen = resumenEvolucionSesion(basicaDesdeRegistro(registro), previo ? basicaDesdeRegistro(previo) : null)
    if (!resumen) return null
    const primeraMedicion = previo === null
    const filas: { key: 'peso' | 's6' | 's8'; label: string; unidad: string; dec: number }[] = [
      { key: 'peso', label: 'Peso', unidad: 'kg', dec: 1 },
      { key: 's6', label: 'Suma de 6 pliegues', unidad: 'mm', dec: 0 },
      { key: 's8', label: 'Suma de 8 pliegues', unidad: 'mm', dec: 0 },
    ]
    return (
      <div className={`s-anthro${solo ? ' solo' : ''}`}>
        <div className="a-head">
          <span className="a-title">Antropometría</span>
          <span className="a-date">{formatFechaCorta(registro.fecha)}</span>
          {primeraMedicion && <span className="chip neutral">Primera medición</span>}
        </div>
        <div className="a-rows">
          {filas.map((f) => {
            const campo = resumen[f.key]
            if (!campo) return null
            return (
              <div className="a-row" key={f.key}>
                <span className="a-lbl">{f.label}</span>
                <span className="a-val">{fmt(campo.valor, f.dec)}<small>{f.unidad}</small></span>
                <span className="a-cd">
                  {campo.direccion && (
                    <>
                      <span className="chip neutral">{DIRECCION_LABEL[campo.direccion]}</span>
                      <span className="a-diff">{sgn(campo.diferencia, f.dec)} {f.unidad}</span>
                    </>
                  )}
                </span>
              </div>
            )
          })}
        </div>
        <div className="a-foot">
          <a
            className="a-link"
            href={`/pacientes/${pacienteId}/antropometria/informe?registro=${registro.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Ver medición
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={1.8} fill="none" /></svg>
          </a>
          {!primeraMedicion && previo && <span className="a-ref">Comparado con {formatFechaCorta(previo.fecha)}</span>}
        </div>
      </div>
    )
  }

  // Entradas "solo medición": turnos con registro antropométrico (por turno_id) que no
  // tienen ninguna nota propia. No consumen número de sesión ni alteran sessionNoMap.
  const turnoIdsConNota = new Set(localNotas.map((n) => n.turno_id).filter((id): id is string => !!id))
  type EntradaMedicionSola = { turno: TurnoRow; registro: RegistroAntropoResumen; fecha: string; ordenKey: string }
  const entradasMedicionSola: EntradaMedicionSola[] = []
  for (const turnoId of turnoIdsSoloMedicion(turnoIdsConNota, registroPorTurno)) {
    const turno = turnosById.get(turnoId)
    const registro = registroPorTurno.get(turnoId)
    if (!turno || !registro) continue
    entradasMedicionSola.push({ turno, registro, fecha: registro.fecha, ordenKey: registro.fecha + registro.created_at })
  }

  type Entrada =
    | { tipo: 'nota'; nota: NotaClinica; ordenKey: string }
    | { tipo: 'medicion'; turno: TurnoRow; registro: RegistroAntropoResumen; ordenKey: string }
  const entradas: Entrada[] = [
    ...localNotas.map((nota): Entrada => ({ tipo: 'nota', nota, ordenKey: nota.fecha + nota.created_at })),
    ...entradasMedicionSola.map((e): Entrada => ({ tipo: 'medicion', turno: e.turno, registro: e.registro, ordenKey: e.ordenKey })),
  ]

  const grouped: Record<string, Entrada[]> = {}
  for (const entrada of entradas) {
    const fecha = entrada.tipo === 'nota' ? entrada.nota.fecha : entrada.registro.fecha
    const key = format(parseISO(fecha), 'yyyy-MM')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(entrada)
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => b.ordenKey.localeCompare(a.ordenKey))
  }
  const sortedMonths = Object.keys(grouped).sort().reverse()

  const selMeta = selectedNota ? sesionMeta(selectedNota) : null
  const selFecha = selectedNota ? parseISO(selectedNota.fecha) : null
  const selDiaHoraStr = selectedNota
    ? `${format(selFecha!, "EEEE d MMM yyyy", { locale: es })} · ${formatHoraNota(selectedNota)}`
    : ''
  const selTitulo = selectedNota
    ? (selMeta!.sessionNo > 0 ? `Sesión Individual #${selMeta!.sessionNo}` : format(selFecha!, "d 'de' MMMM", { locale: es }))
    : ''
  const ultimaEdicionStr = selectedNota && selectedNota.updated_at !== selectedNota.created_at
    ? `Última edición: ${format(parseISO(selectedNota.updated_at), "d MMM, HH:mm", { locale: es })}`
    : null
  const proximaCitaStr = proximaSesion
    ? `${format(parseISO(proximaSesion.fecha_hora), "EEEE d MMM yyyy", { locale: es })} · ${format(parseISO(proximaSesion.fecha_hora), 'HH:mm')}`
    : 'No tiene sesión agendada'

  return (
    <>
      <div className="history">
        {sortedMonths.map((monthKey) => {
          const [year, mm] = monthKey.split('-')
          const monthLabel = `${MONTH_FULL[mm]} ${year}`
          const monthEntradas = grouped[monthKey]
          return (
            <div key={monthKey} className="month-group">
              <div className="month-hdr">
                <span className="m-name">{monthLabel}</span>
                <span className="m-count">{monthEntradas.length} {monthEntradas.length === 1 ? 'sesión' : 'sesiones'}</span>
                <span className="m-line" />
              </div>

              <div className="sessions">
                {monthEntradas.map((entrada) => {
                  if (entrada.tipo === 'medicion') {
                    const { turno, registro } = entrada
                    const fecha = parseISO(registro.fecha)
                    const day = format(fecha, 'd')
                    const monthShort = format(fecha, 'MMM', { locale: es }).toUpperCase().replace('.', '')
                    const yearShort = format(fecha, 'yy')
                    const time = turno.fecha_hora ? new Date(turno.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : null
                    const meta = metaDesdeTurno(turno, 0)

                    return (
                      <article key={`medicion-${registro.id}`} className="scard no-click">
                        <div className="s-date">
                          <div className="s-day">{day}</div>
                          <div className="s-month-year">{monthShort} · {yearShort}</div>
                          {time && <div className="s-time">{time} hs</div>}
                        </div>
                        <div className="s-body">
                          <div className="s-title-row">
                            <span className="s-title">Control antropométrico</span>
                            {meta.modalidadLabel && <span className={`chip ${meta.modalidadChipClass}`}>{meta.modalidadLabel}</span>}
                            {meta.duracionLabel && <span className="chip neutral">{meta.duracionLabel}</span>}
                            {meta.statusLabel && <span className={`chip ${meta.statusChipClass}`}>{meta.statusLabel}</span>}
                          </div>
                          <BloqueAntropometria registro={registro} solo />
                        </div>
                      </article>
                    )
                  }

                  const nota = entrada.nota
                  const fecha = parseISO(nota.fecha)
                  const day = format(fecha, 'd')
                  const monthShort = format(fecha, 'MMM', { locale: es }).toUpperCase().replace('.', '')
                  const yearShort = format(fecha, 'yy')
                  const time = formatHoraNota(nota)
                  const excerpt = previewContenido(nota.contenido)
                  const tags = extraerTags(nota.contenido)
                  const meta = sesionMeta(nota)
                  const registroDeLaNota = nota.turno_id ? registroPorTurno.get(nota.turno_id) : undefined

                  return (
                    <article
                      key={nota.id}
                      className="scard"
                      onClick={() => abrirNota(nota)}
                    >
                      <div className="s-date">
                        <div className="s-day">{day}</div>
                        <div className="s-month-year">{monthShort} · {yearShort}</div>
                        <div className="s-time">{time} hs</div>
                      </div>

                      <div className="s-body">
                        <div className="s-title-row">
                          <span className="s-title">
                            {meta.sessionNo > 0 ? `Sesión Individual #${meta.sessionNo}` : format(fecha, "d 'de' MMMM", { locale: es })}
                          </span>
                          {meta.sessionNo > 0 && <span className="s-session-no">#{meta.sessionNo.toString().padStart(3, '0')}</span>}
                          {meta.modalidadLabel && <span className={`chip ${meta.modalidadChipClass}`}>{meta.modalidadLabel}</span>}
                          {meta.duracionLabel && <span className="chip neutral">{meta.duracionLabel}</span>}
                          {meta.statusLabel && <span className={`chip ${meta.statusChipClass}`}>{meta.statusLabel}</span>}
                        </div>

                        <p className="s-excerpt">{isHtmlEmpty(nota.contenido) ? 'Sin texto · datos del examen registrados' : excerpt}</p>

                        {tags.length > 0 && (
                          <div className="s-tags">
                            {tags.map((t) => (
                              <span key={t} className="s-tag">{t}</span>
                            ))}
                          </div>
                        )}

                        {registroDeLaNota && <BloqueAntropometria registro={registroDeLaNota} solo={false} />}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="flex justify-center py-8">
          <button
            className="history-new-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('openNuevaNotaClinica', { detail: { pacienteId } }))}
          >
            + Nueva nota manual
          </button>
        </div>
      </div>

      <SlideOver
        open={selectedNota !== null}
        onClose={cerrarDrawer}
        title={selTitulo}
        width="lg"
        noPadding
        header={
          <div className="drawer-hdr">
            <span className="t">
              {selMeta && selMeta.sessionNo > 0 ? <>Sesión <b>#{selMeta.sessionNo}</b> · {selDiaHoraStr}</> : selDiaHoraStr}
            </span>
            <button className="d-close" title="Cerrar" onClick={cerrarDrawer}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6l-12 12" /></svg>
            </button>
          </div>
        }
        footer={
          selectedNota && (
            <div className="drawer-foot">
              {editando ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setContenido(selectedNota.contenido); setEditando(false); setGuardarError(null) }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleGuardar}
                    disabled={guardando || isHtmlEmpty(contenido)}
                  >
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => setEditando(true)}>
                    <svg viewBox="0 0 24 24"><path d="M12 20h9M16 3l5 5-11 11H5v-5z" /></svg>
                    Editar
                  </button>
                  {confirmDeleteId === selectedNota.id ? (
                    <>
                      <button
                        type="button"
                        className="btn df-danger"
                        onClick={() => handleDelete(selectedNota.id)}
                        disabled={deletingId === selectedNota.id}
                      >
                        {deletingId === selectedNota.id ? '...' : 'Confirmar eliminación'}
                      </button>
                      <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button type="button" className="btn df-danger" onClick={() => setConfirmDeleteId(selectedNota.id)}>
                      <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" /></svg>
                      Eliminar
                    </button>
                  )}
                  {ultimaEdicionStr && <span className="df-meta">{ultimaEdicionStr}</span>}
                </>
              )}
            </div>
          )
        }
      >
        {selectedNota && selMeta && (
          <div className="drawer-body">
            {(selMeta.modalidadLabel || selMeta.duracionLabel || selMeta.statusLabel) && (
              <div className="d-sub">
                {selMeta.modalidadLabel && <span className={`chip ${selMeta.modalidadChipClass}`}>{selMeta.modalidadLabel}</span>}
                {selMeta.duracionLabel && <span className="chip neutral">{selMeta.duracionLabel}</span>}
                {selMeta.statusLabel && <span className={cn('chip', selMeta.statusChipClass)}>{selMeta.statusLabel}</span>}
              </div>
            )}
            <NotaContenido
              nota={selectedNota}
              editando={editando}
              contenido={contenido}
              onContenidoChange={setContenido}
              error={guardarError}
            />
            <div className="drawer-sec">
              <h3>Próxima cita</h3>
              <p className="contenido">{proximaCitaStr}</p>
            </div>
          </div>
        )}
      </SlideOver>
    </>
  )
}
