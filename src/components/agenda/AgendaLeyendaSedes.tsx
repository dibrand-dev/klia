'use client'

import type { Sucursal } from '@/types/database'
import { abreviaturasUnicas } from '@/lib/agenda/sedeAgenda'

interface Props {
  sedes: Sucursal[]
  conteos: Record<string, number>
}

// Fila de leyenda debajo de la toolbar — un chip por sede (dot + nombre +
// abreviatura + cantidad de turnos del período visible). Solo se monta cuando
// hay 2+ sedes activas.
export default function AgendaLeyendaSedes({ sedes, conteos }: Props) {
  const abrevs = abreviaturasUnicas(sedes)
  return (
    <div className="flex items-center gap-3.5 flex-wrap py-2 text-xs text-gray-600">
      {sedes.map(s => (
        <span key={s.id} className="inline-flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-[3px] inline-block flex-shrink-0" style={{ background: s.color }} />
          {s.nombre}
          <span
            className="font-mono text-[10px] tracking-wide text-gray-400"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {abrevs[s.id]}
          </span>
          <span className="text-gray-400 tabular-nums">{conteos[s.id] ?? 0}</span>
        </span>
      ))}
      <span className="ml-auto text-gray-400 text-[11px] hidden md:inline">
        El color de cada sede es el mismo que en Ajustes
      </span>
    </div>
  )
}
