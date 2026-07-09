import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = { title: 'Plantillas de planillas — Klia Ops' }

export default async function PlanillasPage() {
  await requireAdminUser()
  const supabase = createClient()
  const { data: templates } = await supabase
    .from('planilla_templates')
    .select('*')
    .order('nombre_os')

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[900px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Plantillas de planillas</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Configurá las plantillas de planillas de asistencia por obra social.
          </p>
        </div>
        <Link
          href="/ops/planillas/nueva"
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Nueva plantilla
        </Link>
      </div>

      <div className="space-y-3">
        {(templates ?? []).map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-surface-container rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl text-primary">description</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">{t.nombre_os}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-on-surface-variant font-mono">{t.slug}</span>
                {t.requiere_firma_olografa && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                    Firma ológrafa
                  </span>
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${t.activa ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                  {t.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>
            <Link
              href={`/ops/planillas/${t.slug}`}
              className="text-xs font-medium text-primary hover:underline px-3 py-1.5 border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Editar
            </Link>
          </div>
        ))}

        {(templates ?? []).length === 0 && (
          <div className="text-center py-12 text-sm text-on-surface-variant">
            No hay plantillas configuradas.
          </div>
        )}
      </div>
    </div>
  )
}
