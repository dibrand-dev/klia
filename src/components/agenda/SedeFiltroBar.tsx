'use client'

import type { Sucursal } from '@/types/database'

interface Props {
  sedes: Sucursal[]
  sedeSeleccionadaId: string
  onCambiar: (sedeId: string) => void
  total: number
  totalSinFiltrar: number
  onVerTodas: () => void
  etiquetaPeriodo: string // "de la semana" | "del día"
}

// Selector de sede (dot + <select>) + banner "Mostrando solo turnos de X".
// Se usa en Semana siempre que scope==='sede', y en Día cuando hay 5+ sedes
// activas (ahí "Por sede" cae a este mismo patrón de filtro, sin columnas).
export default function SedeFiltroBar({ sedes, sedeSeleccionadaId, onCambiar, total, totalSinFiltrar, onVerTodas, etiquetaPeriodo }: Props) {
  const cur = sedes.find(s => s.id === sedeSeleccionadaId) ?? sedes[0]
  if (!cur) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label
        className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg h-8 pl-2.5 pr-2 text-xs font-medium shadow-sm"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cur.color }} />
        <select
          value={cur.id}
          onChange={e => onCambiar(e.target.value)}
          className="bg-transparent outline-none cursor-pointer text-gray-900"
        >
          {sedes.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-md px-3 py-1.5 text-xs text-blue-900 flex-wrap">
        <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />
        </svg>
        <span>
          Mostrando solo turnos de <b>{cur.nombre}</b> — {total} de {totalSinFiltrar} turnos {etiquetaPeriodo}.
        </span>
        <button
          onClick={onVerTodas}
          className="ml-auto text-blue-700 font-medium underline underline-offset-2 hover:text-blue-900"
        >
          Ver todas las sedes
        </button>
      </div>
    </div>
  )
}
