import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import OpsGuard from '@/components/ops/OpsGuard'
import ConfiguracionForm from '@/components/ops/ConfiguracionForm'

export const metadata = { title: 'Configuración — Klia Ops' }

export default async function ConfiguracionPage() {
  const adminUser = await requireAdminUser()
  const supabase = createClient()

  const { data: configs } = await supabase
    .from('configuracion')
    .select('*')
    .order('clave')

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[860px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Configuración</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Parámetros globales del sistema.
        </p>
      </div>

      <OpsGuard adminUser={adminUser} requiredRol="total">
        <ConfiguracionForm configs={configs ?? []} />
      </OpsGuard>
    </div>
  )
}
