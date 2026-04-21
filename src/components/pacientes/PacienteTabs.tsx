'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export type PacienteTabKey = 'resumen' | 'datos' | 'historial' | 'informes' | 'documentos' | 'facturacion' | 'interconsultas'

interface TabDef {
  key: PacienteTabKey
  label: string
  badge?: number
}

export default function PacienteTabs({
  pacienteId,
  active,
  historialCount,
}: {
  pacienteId: string
  active: PacienteTabKey
  historialCount?: number
}) {
  const tabs: TabDef[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'datos', label: 'Datos personales' },
    { key: 'historial', label: 'Historial clínico', badge: historialCount },
    { key: 'informes', label: 'Informes' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'facturacion', label: 'Facturación' },
    { key: 'interconsultas', label: 'Interconsultas' },
  ]

  return (
    <div className="flex items-center gap-6 md:gap-8 mb-8 border-b border-outline-variant/30 overflow-x-auto whitespace-nowrap">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const href =
          tab.key === 'resumen' ? `/pacientes/${pacienteId}`
          : tab.key === 'datos' ? `/pacientes/${pacienteId}?tab=datos`
          : tab.key === 'historial' ? `/pacientes/${pacienteId}/historial`
          : tab.key === 'informes' ? `/pacientes/${pacienteId}?tab=informes`
          : tab.key === 'documentos' ? `/pacientes/${pacienteId}?tab=documentos`
          : tab.key === 'facturacion' ? `/pacientes/${pacienteId}?tab=facturacion`
          : `/pacientes/${pacienteId}?tab=interconsultas`

        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              'pb-4 font-bold text-sm transition-colors flex items-center gap-2 flex-shrink-0',
              isActive
                ? 'text-primary border-b-2 border-primary'
                : 'text-slate-400 hover:text-slate-600',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-bold',
                  isActive
                    ? 'bg-primary-container text-white'
                    : 'bg-surface-container text-on-surface-variant',
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
