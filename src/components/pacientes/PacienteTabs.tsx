'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export type PacienteTabKey = 'resumen' | 'datos' | 'historial' | 'turnos' | 'documentos' | 'notas'

interface TabDef {
  key: PacienteTabKey
  label: string
  badge?: number
}

export default function PacienteTabs({
  pacienteId,
  active,
  historialCount,
  turnosCount,
  documentosCount,
}: {
  pacienteId: string
  active: PacienteTabKey
  historialCount?: number
  turnosCount?: number
  documentosCount?: number
}) {
  const tabs: TabDef[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'datos', label: 'Datos personales' },
    { key: 'historial', label: 'Historial clínico', badge: historialCount },
    { key: 'turnos', label: 'Turnos', badge: turnosCount },
    { key: 'documentos', label: 'Documentos', badge: documentosCount },
    { key: 'notas', label: 'Notas privadas' },
  ]

  return (
    <div className="flex items-center gap-0.5 border-b border-line mt-7 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap whitespace-nowrap">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const href =
          tab.key === 'datos' ? `/pacientes/${pacienteId}`
          : tab.key === 'historial' ? `/pacientes/${pacienteId}/historial`
          : tab.key === 'resumen' ? `/pacientes/${pacienteId}?tab=resumen`
          : tab.key === 'turnos' ? `/pacientes/${pacienteId}?tab=turnos`
          : tab.key === 'documentos' ? `/pacientes/${pacienteId}?tab=documentos`
          : `/pacientes/${pacienteId}?tab=notas`

        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              'inline-flex items-center gap-[7px] px-3.5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors select-none flex-shrink-0',
              isActive
                ? 'text-ink border-ink'
                : 'text-muted border-transparent hover:text-ink-2',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'text-[11px] px-1.5 py-[1px] rounded-full font-medium',
                  isActive ? 'bg-ink text-white' : 'bg-surface-3 text-muted',
                )}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
