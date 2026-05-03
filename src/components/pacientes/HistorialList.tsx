'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { NotaClinica, TurnoRow } from '@/types/database'
import SlideOver from '@/components/ui/SlideOver'
import NotaDetalleEditor from './NotaDetalleEditor'

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

type Props = {
  notas: NotaClinica[]
  turnos: TurnoRow[]
  pacienteId: string
}

export default function HistorialList({ notas, turnos, pacienteId }: Props) {
  const router = useRouter()
  const [localNotas, setLocalNotas] = useState<NotaClinica[]>(notas)
  const [selectedNota, setSelectedNota] = useState<NotaClinica | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    if (selectedNota?.id === notaId) setSelectedNota(null)
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

  const grouped: Record<string, NotaClinica[]> = {}
  for (const nota of localNotas) {
    const key = format(parseISO(nota.fecha), 'yyyy-MM')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(nota)
  }
  const sortedMonths = Object.keys(grouped).sort().reverse()

  const slTitle = selectedNota
    ? format(parseISO(selectedNota.fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    : ''
  const slSubtitle = selectedNota
    ? `${format(parseISO(selectedNota.created_at), 'HH:mm')} hs`
    : undefined

  return (
    <>
      <div className="space-y-12 pt-5">
        {sortedMonths.map((monthKey) => {
          const [year, mm] = monthKey.split('-')
          const monthLabel = `${MONTH_FULL[mm]} ${year}`
          const monthNotas = grouped[monthKey]
          return (
            <div key={monthKey}>
              <h2 className="text-[11px] font-extrabold text-slate-300 tracking-[0.2em] uppercase mb-6 flex items-center gap-4">
                {monthLabel}
                <span className="h-[1px] flex-1 bg-outline-variant/20" />
              </h2>

              {monthNotas.map((nota) => {
                const fecha = parseISO(nota.fecha)
                const day = format(fecha, 'd')
                const monthShort = format(fecha, 'MMM', { locale: es }).toUpperCase().replace('.', '')
                const yearShort = format(fecha, 'yy')
                const time = format(parseISO(nota.created_at), 'HH:mm')
                const excerpt = previewContenido(nota.contenido)
                const tags = extraerTags(nota.contenido)
                const sessionNo = sessionNoMap.get(nota.id) ?? 0

                const turno = nota.turno_id ? turnosById.get(nota.turno_id) : null
                const modalidad = turno?.modalidad
                const modalidadLabel =
                  modalidad === 'videollamada' ? 'Virtual'
                  : modalidad === 'telefonica' ? 'Telefónica'
                  : modalidad === 'presencial' ? 'Presencial'
                  : null
                const duracionLabel = turno?.duracion_min ? `${turno.duracion_min} min` : null
                const isCompletada = turno?.estado === 'realizado'
                const isCancelada = turno?.estado === 'cancelado'
                const isNoAsistio = turno?.estado === 'no_asistio'

                return (
                  <div
                    key={nota.id}
                    className="block group mb-6 w-full"
                  >
                    <article
                      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10 flex flex-col md:flex-row group-hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedNota(nota)}
                    >
                      {/* Date column */}
                      <div className="md:w-32 bg-surface-container-low/30 p-6 flex md:flex-col items-center justify-between md:justify-center border-b md:border-b-0 md:border-r border-outline-variant/10">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{monthShort} / {yearShort}</span>
                          <span className="text-4xl font-extrabold text-primary my-1">{day}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500">{time} HS</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                              <h3 className="text-lg font-extrabold text-primary">
                                {sessionNo > 0 ? `Sesión Individual #${sessionNo}` : format(fecha, "d 'de' MMMM", { locale: es })}
                              </h3>
                              <div className="flex gap-2">
                                {modalidadLabel && (
                                  <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded uppercase">
                                    {modalidadLabel}
                                  </span>
                                )}
                                {duracionLabel && (
                                  <span className="px-2 py-0.5 bg-primary-fixed text-primary text-[10px] font-bold rounded uppercase">
                                    {duracionLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isCompletada && (
                            <div className="hidden sm:flex items-center gap-2 flex-none ml-4">
                              <span className="material-symbols-outlined text-on-tertiary-container">check_circle</span>
                              <span className="text-[10px] font-bold text-on-tertiary-container uppercase tracking-wider">Completada</span>
                            </div>
                          )}
                          {isCancelada && (
                            <div className="hidden sm:flex items-center gap-2 flex-none ml-4">
                              <span className="material-symbols-outlined text-error">cancel</span>
                              <span className="text-[10px] font-bold text-error uppercase tracking-wider">Cancelada</span>
                            </div>
                          )}
                          {isNoAsistio && (
                            <div className="hidden sm:flex items-center gap-2 flex-none ml-4">
                              <span className="material-symbols-outlined text-on-surface-variant">person_off</span>
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">No asistió</span>
                            </div>
                          )}
                        </div>

                        <div className="bg-surface-container-low/40 p-4 rounded-xl border-l-4 border-primary/20 mb-4">
                          <p
                            className="text-sm text-on-surface-variant leading-relaxed overflow-hidden"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                            } as React.CSSProperties}
                          >
                            {excerpt}
                          </p>
                        </div>

                        {tags.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {tags.map((t) => (
                              <span key={t} className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right panel — stopPropagation so clicks here don't open the SlideOver */}
                      <div
                        className="md:w-48 p-6 bg-surface-container-lowest flex flex-col justify-end gap-2 border-t md:border-t-0 md:border-l border-outline-variant/10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="flex items-center justify-center gap-2 w-full py-2.5 md:py-2 bg-primary-fixed/30 group-hover:bg-primary-fixed text-primary font-bold text-[11px] rounded-lg transition-colors uppercase tracking-wider">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          Ver nota completa
                        </span>

                        {confirmDeleteId === nota.id ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDelete(nota.id)}
                              disabled={deletingId === nota.id}
                              className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[11px] rounded-lg transition-colors uppercase disabled:opacity-50"
                            >
                              {deletingId === nota.id ? '...' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-[11px] rounded-lg transition-colors uppercase"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(nota.id)}
                            className="flex items-center justify-center gap-2 w-full py-2.5 md:py-2 bg-red-50 hover:bg-red-100 text-red-500 font-bold text-[11px] rounded-lg transition-colors uppercase tracking-wider"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Eliminar
                          </button>
                        )}
                      </div>

                    </article>
                  </div>
                )
              })}
            </div>
          )
        })}

        <div className="flex justify-center py-8">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openNuevaNotaClinica', { detail: { pacienteId } }))}
            className="px-6 py-2 border border-outline-variant text-slate-500 font-bold text-xs rounded-full hover:bg-white hover:text-primary transition-all"
          >
            + Nueva nota manual
          </button>
        </div>
      </div>

      <SlideOver
        open={selectedNota !== null}
        onClose={() => setSelectedNota(null)}
        title={slTitle}
        subtitle={slSubtitle}
        width="lg"
      >
        {selectedNota && (
          <NotaDetalleEditor
            nota={selectedNota}
            pacienteId={pacienteId}
            onSaved={() => setSelectedNota(null)}
            onDeleted={() => {
              setLocalNotas((prev) => prev.filter((n) => n.id !== selectedNota.id))
              setSelectedNota(null)
              router.refresh()
            }}
          />
        )}
      </SlideOver>
    </>
  )
}
