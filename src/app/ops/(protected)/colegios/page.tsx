import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import ColegiosClient from '@/components/ops/ColegiosClient'
import type { Colegio, CodigoDescuento } from '@/types/database'

export const metadata = { title: 'Códigos de descuento — Klia Ops' }

export default async function ColegiosPage() {
  await requireAdminUser()
  const supabase = createClient()

  const [{ data: colegiosData }, { data: codigosData }] = await Promise.all([
    supabase.from('colegios').select('*').order('created_at', { ascending: false }),
    supabase.from('codigos_descuento').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Códigos de descuento</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Convenios institucionales con colegios profesionales y sus códigos de descuento.
        </p>
      </div>

      <ColegiosClient
        colegiosIniciales={(colegiosData ?? []) as Colegio[]}
        codigosIniciales={(codigosData ?? []) as CodigoDescuento[]}
      />
    </div>
  )
}
