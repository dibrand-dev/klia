'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SlideOver from '@/components/ui/SlideOver'

export interface DrilldownRow {
  id: string
  primary: string
  secondary?: string
  meta?: React.ReactNode
  href?: string
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  rows: DrilldownRow[]
  emptyMessage?: string
  loading?: boolean
  // Paginación externa (ej. "Pacientes activos" del profesional, con fetch
  // real .range() en Supabase): cuando se pasa hasMore/onLoadMore, el botón
  // "Mostrar más" dispara eso en vez de la paginación interna por slice —
  // rows ya viene completo (todo lo cargado hasta ahora) en ese caso.
  hasMore?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
}

const PAGINA = 50

// SlideOver genérico de drill-down del Dashboard — una sola lista de filas
// (paciente/turno/serie/lo que sea), reusando el estilo ya usado en las
// listas del propio DashboardClient (divide-y gray-50, px-5 py-3, texto
// gray-800/gray-500) en vez de inventar un patrón visual nuevo.
export default function DashboardDrilldownSlide({ open, onClose, title, subtitle, rows, emptyMessage, loading, hasMore, onLoadMore, loadingMore }: Props) {
  const [visibles, setVisibles] = useState(PAGINA)
  const paginacionExterna = onLoadMore !== undefined

  // Vuelve a 50 cada vez que se abre un drill-down distinto (otro título) o
  // se reabre el mismo — nunca arrastra la paginación de la card anterior.
  useEffect(() => {
    if (open) setVisibles(PAGINA)
  }, [open, title])

  const filasVisibles = paginacionExterna ? rows : rows.slice(0, visibles)
  const quedanMas = paginacionExterna ? !!hasMore : rows.length > visibles

  return (
    <SlideOver open={open} onClose={onClose} title={title} subtitle={subtitle} width="md">
      <div className="-mx-6 -my-6">
        {loading && (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">Cargando...</p>
        )}

        {!loading && rows.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">{emptyMessage ?? 'No hay nada para mostrar.'}</p>
        )}

        {!loading && rows.length > 0 && (
          <div className="divide-y divide-gray-50">
            {filasVisibles.map((row) => {
              const contenido = (
                <div className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{row.primary}</p>
                    {row.secondary && <p className="text-xs text-gray-500 mt-0.5 truncate">{row.secondary}</p>}
                  </div>
                  {row.meta && <div className="shrink-0">{row.meta}</div>}
                </div>
              )
              return row.href ? (
                <Link key={row.id} href={row.href} className="block hover:bg-gray-50 transition-colors">
                  {contenido}
                </Link>
              ) : (
                <div key={row.id}>{contenido}</div>
              )
            })}
          </div>
        )}

        {quedanMas && (
          <div className="px-5 py-4 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => (paginacionExterna ? onLoadMore?.() : setVisibles((v) => v + PAGINA))}
              className="text-xs font-medium text-primary-600 hover:underline disabled:opacity-50 disabled:cursor-wait"
            >
              {paginacionExterna
                ? (loadingMore ? 'Cargando...' : 'Mostrar más')
                : `Mostrar más (${rows.length - visibles} más)`}
            </button>
          </div>
        )}
      </div>
    </SlideOver>
  )
}
