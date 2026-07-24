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
  pacienteId: string
  proximaSesion?: TurnoRow | null
}

export default function HistorialList({ notas, turnos, pacienteId, proximaSesion = null }: Props) {
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

  function sesionMeta(nota: NotaClinica) {
    const turno = nota.turno_id ? turnosById.get(nota.turno_id) : null
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
    const sessionNo = sessionNoMap.get(nota.id) ?? 0
    return { modalidadLabel, modalidadChipClass, duracionLabel, statusLabel, statusChipClass, sessionNo }
  }

  const grouped: Record<string, NotaClinica[]> = {}
  for (const nota of localNotas) {
    const key = format(parseISO(nota.fecha), 'yyyy-MM')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(nota)
  }
  const sortedMonths = Object.keys(grouped).sort().reverse()

  const selMeta = selectedNota ? sesionMeta(selectedNota) : null
  const selFecha = selectedNota ? parseISO(selectedNota.fecha) : null
  const selDiaHoraStr = selectedNota
    ? `${format(selFecha!, "EEEE d MMM yyyy", { locale: es })} · ${format(parseISO(selectedNota.created_at), 'HH:mm')}`
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
          const monthNotas = grouped[monthKey]
          return (
            <div key={monthKey} className="month-group">
              <div className="month-hdr">
                <span className="m-name">{monthLabel}</span>
                <span className="m-count">{monthNotas.length} sesión{monthNotas.length !== 1 ? 'es' : ''}</span>
                <span className="m-line" />
              </div>

              <div className="sessions">
                {monthNotas.map((nota) => {
                  const fecha = parseISO(nota.fecha)
                  const day = format(fecha, 'd')
                  const monthShort = format(fecha, 'MMM', { locale: es }).toUpperCase().replace('.', '')
                  const yearShort = format(fecha, 'yy')
                  const time = format(parseISO(nota.created_at), 'HH:mm')
                  const excerpt = previewContenido(nota.contenido)
                  const tags = extraerTags(nota.contenido)
                  const meta = sesionMeta(nota)

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

                        <p className="s-excerpt">{excerpt}</p>

                        {tags.length > 0 && (
                          <div className="s-tags">
                            {tags.map((t) => (
                              <span key={t} className="s-tag">{t}</span>
                            ))}
                          </div>
                        )}
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
            <div className="d-sub">
              {selMeta.modalidadLabel && <span className={`chip ${selMeta.modalidadChipClass}`}>{selMeta.modalidadLabel}</span>}
              {selMeta.duracionLabel && <span className="chip neutral">{selMeta.duracionLabel}</span>}
              {selMeta.statusLabel && <span className={cn('chip', selMeta.statusChipClass)}>{selMeta.statusLabel}</span>}
            </div>
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
