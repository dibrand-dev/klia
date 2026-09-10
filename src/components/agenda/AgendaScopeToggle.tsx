'use client'

import { cn } from '@/lib/utils'
import type { AgendaScope } from '@/lib/agenda/sedeAgenda'

interface Props {
  scope: AgendaScope
  onChange: (scope: AgendaScope) => void
}

// Toggle "Todas"/"Por sede" — solo se renderiza cuando el profesional tiene
// 2+ sedes activas (el padre decide si montar este componente).
export default function AgendaScopeToggle({ scope, onChange }: Props) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs">
      <button
        onClick={() => onChange('todas')}
        className={cn(
          'px-3 py-1.5 font-medium border-r border-gray-200 transition-colors inline-flex items-center gap-1.5',
          scope === 'todas' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.8} />
          <path d="M3 9h18" strokeWidth={1.8} />
        </svg>
        Todas
      </button>
      <button
        onClick={() => onChange('sede')}
        className={cn(
          'px-3 py-1.5 font-medium transition-colors inline-flex items-center gap-1.5',
          scope === 'sede' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M4 4v16M12 4v16M20 4v16" strokeWidth={1.8} />
        </svg>
        Por sede
      </button>
    </div>
  )
}
