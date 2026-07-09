import { requireAdminUser } from '@/lib/ops/auth'
import Link from 'next/link'
import PlanForm from '@/components/ops/PlanForm'

export const metadata = { title: 'Nuevo plan — Klia Ops' }

export default async function NuevoPlanPage() {
  await requireAdminUser()

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[800px]">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/ops/planes" className="text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Nuevo plan</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Configurá el nombre, precio y funcionalidades incluidas</p>
        </div>
      </div>

      <PlanForm />
    </div>
  )
}
