'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ConflictoDetallado } from '@/lib/recurrentes'

type Props = {
  conflictos: ConflictoDetallado[]
  onOmitir: () => void
  onCancelar: () => void
  loading?: boolean
}

export default function ConflictosPanel({ conflictos, onOmitir, onCancelar, loading }: Props) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-800 mb-2">
          ⚠️ Se detectaron conflictos en estas fechas:
        </p>
        <ul className="space-y-1">
          {conflictos.map((c, i) => (
            <li key={i} className="text-xs text-amber-700 capitalize">
              · {format(c.fecha, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })} — ya tiene un turno a las {c.horaConflicto}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-amber-700 font-medium">¿Qué querés hacer con esas fechas?</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          disabled={loading}
          className="btn-secondary flex-1 py-2 text-sm"
        >
          Cancelar y revisar
        </button>
        <button
          type="button"
          onClick={onOmitir}
          disabled={loading}
          className="btn-primary flex-1 py-2 text-sm"
        >
          {loading ? 'Creando...' : 'Crear serie omitiendo conflictos'}
        </button>
      </div>
    </div>
  )
}
