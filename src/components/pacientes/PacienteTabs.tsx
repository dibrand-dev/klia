'use client'

import './paciente-tabs.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ESPECIALIDADES_SALUD_MENTAL } from '@/lib/especialidades'

export type PacienteTabKey = 'resumen' | 'datos' | 'historial' | 'informes' | 'facturacion' | 'interconsultas' | 'archivos' | 'admision' | 'composicion' | 'refraccion'

interface TabDef {
  key: PacienteTabKey
  label: string
  badge?: number
}

export default function PacienteTabs({
  pacienteId,
  active,
  historialCount,
  tieneDrive = false,
  especialidad,
}: {
  pacienteId: string
  active: PacienteTabKey
  historialCount?: number
  tieneDrive?: boolean
  especialidad?: string | null
}) {
  const router = useRouter()
  const showAdmision = ESPECIALIDADES_SALUD_MENTAL.includes(especialidad ?? '')
  const showComposicion = especialidad === 'Nutrición'
  const showRefraccion = especialidad === 'Oftalmología'

  const tabs: TabDef[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'datos', label: 'Datos personales' },
    { key: 'historial', label: 'Historial clínico', badge: historialCount },
    { key: 'informes', label: 'Informes' },
    ...(tieneDrive ? [{ key: 'archivos' as PacienteTabKey, label: 'Archivos' }] : []),
    ...(showAdmision ? [{ key: 'admision' as PacienteTabKey, label: 'Admisión' }] : []),
    ...(showComposicion ? [{ key: 'composicion' as PacienteTabKey, label: 'Antropometría' }] : []),
    ...(showRefraccion ? [{ key: 'refraccion' as PacienteTabKey, label: 'Refracción' }] : []),
    { key: 'facturacion', label: 'Facturación' },
    { key: 'interconsultas', label: 'Interconsultas' },
  ]

  return (
    <div className="tabs">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const href =
          tab.key === 'resumen' ? `/pacientes/${pacienteId}`
          : tab.key === 'datos' ? `/pacientes/${pacienteId}?tab=datos`
          : tab.key === 'historial' ? `/pacientes/${pacienteId}/historial`
          : tab.key === 'informes' ? `/pacientes/${pacienteId}?tab=informes`
          : tab.key === 'archivos' ? `/pacientes/${pacienteId}?tab=archivos`
          : tab.key === 'admision' ? `/pacientes/${pacienteId}?tab=admision`
          : tab.key === 'composicion' ? `/pacientes/${pacienteId}?tab=composicion`
          : tab.key === 'refraccion' ? `/pacientes/${pacienteId}?tab=refraccion`
          : tab.key === 'facturacion' ? `/pacientes/${pacienteId}?tab=facturacion`
          : `/pacientes/${pacienteId}?tab=interconsultas`

        return (
          <Link
            key={tab.key}
            href={href}
            onClick={() => router.refresh()}
            className={cn('tab', isActive && 'active')}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="badge">{tab.badge}</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
