import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import ModulosClient from './ModulosClient'

export const metadata = { title: 'Módulos — Klia Ops' }

export default async function ModulosPage() {
  await requireAdminUser()
  const supabase = createClient()

  const { data: modulos } = await supabase
    .from('modulos_config')
    .select('*')
    .order('modulo_id')

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[900px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Módulos por Plan</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Configurá qué módulos están disponibles para cada plan de suscripción.
        </p>
      </div>
      <ModulosClient modulos={modulos ?? []} />
    </div>
  )
}
