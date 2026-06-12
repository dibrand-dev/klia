import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PlanForm from '@/components/ops/PlanForm'
import PlanFeaturesEditor from '@/components/ops/PlanFeaturesEditor'
import type { PlanConFuncionalidades } from '@/types/database'

export const metadata = { title: 'Editar plan — Klia Ops' }

export default async function EditarPlanPage({
  params,
}: {
  params: { id: string }
}) {
  await requireAdminUser()
  const supabase = createClient()

  const { data: plan } = await supabase
    .from('planes')
    .select('*, plan_funcionalidades(funcionalidad)')
    .eq('id', params.id)
    .single()

  if (!plan) notFound()

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[800px]">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/ops/planes" className="text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Editar plan</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{plan.nombre}</p>
        </div>
      </div>

      <PlanForm plan={plan as PlanConFuncionalidades} />

      <div className="mt-8">
        <PlanFeaturesEditor planId={plan.nombre.toLowerCase()} />
      </div>
    </div>
  )
}
