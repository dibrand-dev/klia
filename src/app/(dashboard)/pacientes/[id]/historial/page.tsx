import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import PacienteHeader, { type SummaryData } from '@/components/pacientes/PacienteHeader'
import PacienteTabs from '@/components/pacientes/PacienteTabs'
import type { NotaClinica, TurnoRow } from '@/types/database'

export const metadata = { title: 'Historial clínico — ConsultorioApp' }

function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[completar\]/g, '')
    .trim()
}

function previewContenido(texto: string): string {
  return limpiarMarkdown(texto.split('\n').filter((l) => l.trim()).join(' '))
}

function primeraLinea(texto: string): string {
  const clean = limpiarMarkdown(texto)
  const firstLine = clean.split('\n').find((l) => l.trim()) || clean
  return firstLine.trim()
}

function extraerTags(texto: string): string[] {
  const clean = limpiarMarkdown(texto)
  const matches = clean.match(/#[a-zA-Z0-9_-]+/g)
  if (!matches) return []
  return Array.from(new Set(matches.map((t) => t.slice(1).toLowerCase()))).slice(0, 4)
}

const MONTH_FULL: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
}

const MONTH_SHORT: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

export default async function HistorialPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: paciente }, { data: notas }, { data: turnos }] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*')
      .eq('id', params.id)
      .eq('terapeuta_id', user.id)
      .single(),
    supabase
      .from('notas_clinicas')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', user.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('turnos')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', user.id)
      .order('fecha_hora', { ascending: true }),
  ])

  if (!paciente) notFound()

  const turnosList = turnos || []
  const now = new Date()
  const sesionesRealizadas = turnosList.filter((t) => t.estado === 'realizado').length
  const proximaSesion = turnosList.find((t) => new Date(t.fecha_hora) >= now && t.estado !== 'cancelado' && t.estado !== 'no_asistio') || null
  const tratamientoDesde = turnosList[0]?.fecha_hora ?? paciente.created_at
  const impagosTurnos = turnosList.filter((t) => t.estado === 'realizado' && !t.pagado)
  const impagos = impagosTurnos.length
  const montoImpago = impagosTurnos.reduce((sum, t) => sum + (t.monto ?? 0), 0)

  const summary: SummaryData = {
    sesionesRealizadas,
    proximaSesion,
    tratamientoDesde,
    impagos,
    montoImpago,
  }

  // Map turnos by fecha_hora prefix for matching with notas
  const turnosById = new Map<string, TurnoRow>()
  for (const t of turnosList) turnosById.set(t.id, t)

  const notasList = notas || []
  const totalNotas = notasList.length
  const turnosCount = turnosList.filter((t) => t.estado !== 'cancelado').length

  // Group by month 'yyyy-MM'
  const grouped: Record<string, NotaClinica[]> = {}
  for (const nota of notasList) {
    const key = format(parseISO(nota.fecha), 'yyyy-MM')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(nota)
  }
  const sortedMonths = Object.keys(grouped).sort().reverse()

  // Compute session number per nota (chronological index across all notas)
  const chronological = [...notasList].sort((a, b) => (a.fecha + a.created_at).localeCompare(b.fecha + b.created_at))
  const sessionNoMap = new Map<string, number>()
  chronological.forEach((n, idx) => sessionNoMap.set(n.id, idx + 1))

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 md:px-7 pb-20">
      <PacienteHeader paciente={paciente} summary={summary} />
      <PacienteTabs
        pacienteId={paciente.id}
        active="historial"
        historialCount={totalNotas}
        turnosCount={turnosCount}
      />

      {totalNotas === 0 ? (
        <div className="mt-6 border border-dashed border-line rounded-klin-lg bg-white p-10 text-center">
          <div className="w-14 h-14 rounded-klin-lg bg-surface-2 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-muted-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-[15px] font-medium text-ink mb-1">Todavía no hay notas para este paciente</h3>
          <p className="text-[13px] text-muted mb-5">Las notas aparecen al marcar un turno como realizado o podés crearlas manualmente.</p>
          <Link
            href={`/pacientes/${params.id}/historial/nueva`}
            className="klin-btn-primary inline-flex"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Crear primera nota
          </Link>
        </div>
      ) : (
        <div className="pt-5 flex flex-col gap-7">
          {sortedMonths.map((monthKey) => {
            const [year, mm] = monthKey.split('-')
            const monthLabel = `${MONTH_FULL[mm]} ${year}`
            const monthNotas = grouped[monthKey]
            return (
              <div key={monthKey}>
                {/* Sticky month header */}
                <div className="sticky top-0 z-[5] -mx-4 md:-mx-7 px-4 md:px-7 py-2 mb-1.5 flex items-baseline gap-2.5 bg-bgc/90 backdrop-blur-sm border-b border-dashed border-line">
                  <span className="text-[11.5px] font-semibold uppercase text-ink-2" style={{ letterSpacing: '0.08em' }}>
                    {monthLabel}
                  </span>
                  <span className="text-[11.5px] text-muted-2">
                    {monthNotas.length} {monthNotas.length === 1 ? 'sesión' : 'sesiones'}
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-line to-transparent" />
                </div>

                <div className="flex flex-col gap-2.5">
                  {monthNotas.map((nota) => {
                    const fecha = parseISO(nota.fecha)
                    const day = format(fecha, 'd').padStart(2, '0')
                    const monthShort = MONTH_SHORT[format(fecha, 'MM')]
                    const yearShort = format(fecha, 'yyyy')
                    const time = format(parseISO(nota.created_at), 'HH:mm')
                    const dow = format(fecha, 'EEEE', { locale: es })
                    const title = primeraLinea(nota.contenido)
                    const excerpt = previewContenido(nota.contenido)
                    const tags = extraerTags(nota.contenido)
                    const sessionNo = sessionNoMap.get(nota.id) ?? 0

                    // Derive chips from linked turno if exists
                    const turno = nota.turno_id ? turnosById.get(nota.turno_id) : null
                    const modalidad = turno?.modalidad
                    const modalidadChip = modalidad === 'videollamada'
                      ? { label: 'Virtual', cls: 'klin-chip klin-chip-online' }
                      : modalidad === 'telefonica'
                      ? { label: 'Telefónica', cls: 'klin-chip klin-chip-online' }
                      : modalidad === 'presencial'
                      ? { label: 'Presencial', cls: 'klin-chip klin-chip-in-person' }
                      : null
                    const duracionChip = turno?.duracion_min ? `${turno.duracion_min} min` : null
                    const estadoChip =
                      turno?.estado === 'realizado' ? { label: 'Realizada', cls: 'klin-chip klin-chip-ok' }
                      : turno?.estado === 'cancelado' ? { label: 'Cancelada', cls: 'klin-chip klin-chip-danger' }
                      : turno?.estado === 'no_asistio' ? { label: 'No asistió', cls: 'klin-chip klin-chip-warn' }
                      : null

                    return (
                      <Link
                        key={nota.id}
                        href={`/pacientes/${params.id}/historial/${nota.id}`}
                        className="block group"
                      >
                        <article className="bg-white border border-line rounded-klin-lg px-4 sm:px-[18px] py-4 sm:py-[22px] grid gap-5 items-start transition-[border-color,box-shadow,transform] duration-150 group-hover:border-line-strong group-hover:shadow-klin-sm"
                          style={{ gridTemplateColumns: '78px 1fr' }}
                        >
                          {/* Date column */}
                          <div className="text-left pt-0.5">
                            <div className="text-ink font-semibold text-[26px] leading-none" style={{ letterSpacing: '-0.025em' }}>
                              {day}
                            </div>
                            <div className="text-[11px] text-muted uppercase font-medium mt-1" style={{ letterSpacing: '0.06em' }}>
                              {monthShort} · {yearShort}
                            </div>
                            <div className="font-mono text-[12px] text-muted-2 mt-[3px] tabular-nums">
                              {time}
                            </div>
                          </div>

                          {/* Body */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[14px] font-semibold text-ink truncate" style={{ letterSpacing: '-0.005em' }}>
                                {title}
                              </span>
                              {sessionNo > 0 && (
                                <span className="font-mono text-[11.5px] text-muted-2">
                                  #{String(sessionNo).padStart(3, '0')}
                                </span>
                              )}
                              {modalidadChip && <span className={modalidadChip.cls}>{modalidadChip.label}</span>}
                              {duracionChip && <span className="klin-chip">{duracionChip}</span>}
                              {estadoChip && <span className={estadoChip.cls}>{estadoChip.label}</span>}
                              <span className="ml-auto capitalize text-[11.5px] text-muted-2 hidden sm:inline">{dow}</span>
                            </div>

                            <p
                              className="text-muted text-[13px] leading-[1.55] mb-2 overflow-hidden"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                textWrap: 'pretty',
                              } as React.CSSProperties}
                            >
                              {excerpt}
                            </p>

                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-[5px]">
                                {tags.map((t) => (
                                  <span
                                    key={t}
                                    className="text-[11px] text-muted px-[7px] py-[1px] rounded-[4px] border border-line bg-white font-medium before:content-['#'] before:text-muted-3 before:mr-0.5"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </article>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
