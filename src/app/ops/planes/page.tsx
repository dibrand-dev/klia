import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Plan } from '@/types/database'

export const metadata = { title: 'Planes — Klia Ops' }

type ModuloRow = { modulo_id: string; nombre: string; planes: string[] }

export default async function PlanesPage() {
  await requireAdminUser()
  const supabase = createClient()

  const [{ data: planesData }, { data: modulosData }] = await Promise.all([
    supabase.from('planes').select('*').order('precio_mensual', { ascending: true }),
    supabase.from('modulos_config').select('modulo_id, nombre, planes').eq('activo', true).order('modulo_id'),
  ])

  const list = (planesData ?? []) as Plan[]
  const modulos = (modulosData ?? []) as ModuloRow[]

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1100px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Planes</h1>
          <p className="text-sm text-on-surface-variant mt-1">{list.length} planes configurados</p>
        </div>
        <Link href="/ops/planes/nuevo" className="btn-primary px-5 py-2.5 flex items-center gap-2">
          <span className="material-symbols-outlined text-xl">add</span>
          Nuevo plan
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-16 text-center">
          <span className="material-symbols-outlined text-5xl opacity-20 mb-3 block">workspace_premium</span>
          <p className="text-on-surface-variant">No hay planes configurados.</p>
          <Link href="/ops/planes/nuevo" className="btn-primary px-5 py-2 mt-4 inline-flex">
            Crear primer plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {list.map((plan) => {
            const planKey = plan.nombre.toLowerCase()
            const includedCount = modulos.filter(m => m.planes.includes(planKey)).length

            return (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="p-5 border-b border-outline-variant/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-on-surface">{plan.nombre}</h2>
                      {plan.descripcion && (
                        <p className="text-xs text-on-surface-variant mt-0.5">{plan.descripcion}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-primary">
                        {plan.precio_mensual === 0 ? 'Gratis' : `$${plan.precio_mensual.toLocaleString('es-AR')}`}
                      </p>
                      {plan.precio_mensual > 0 && (
                        <p className="text-[10px] text-on-surface-variant">/mes</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    {!plan.es_publico && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-medium">
                        <span className="material-symbols-outlined text-sm">lock</span>
                        Privado
                      </span>
                    )}
                    {plan.es_ilimitado && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
                        <span className="material-symbols-outlined text-sm">all_inclusive</span>
                        Nunca vence
                      </span>
                    )}
                    {!plan.activo && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium">Inactivo</span>
                    )}
                  </div>
                </div>

                {/* Modules */}
                <div className="p-5 flex-1">
                  {modulos.length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic">Sin módulos configurados</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {modulos.map((m) => {
                        const incluido = m.planes.includes(planKey)
                        return (
                          <li key={m.modulo_id} className="flex items-center gap-2 text-sm">
                            <span
                              className="material-symbols-outlined text-base shrink-0"
                              style={{
                                fontVariationSettings: "'FILL' 1",
                                color: incluido ? '#16a34a' : '#d1d5db',
                              }}
                            >
                              {incluido ? 'check_circle' : 'cancel'}
                            </span>
                            <span style={{ color: incluido ? 'inherit' : '#9ca3af' }}>
                              {m.nombre}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {modulos.length > 0 && (
                    <p className="text-xs text-on-surface-variant mt-3">
                      {includedCount} de {modulos.length} módulos incluidos
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-outline-variant/10 flex justify-end">
                  <Link
                    href={`/ops/planes/${plan.id}`}
                    className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    Editar plan
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
