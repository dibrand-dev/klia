import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import VendedoresClient from '@/components/ops/VendedoresClient'
import type { Colegio, Database } from '@/types/database'

export const metadata = { title: 'Vendedores — Klia Ops' }

type VendedorOps = Database['public']['Functions']['ops_get_vendedores']['Returns'][number]

export default async function VendedoresPage() {
  await requireAdminUser()
  const supabase = createClient()

  const [{ data: vendedores }, { data: colegios }, { data: codigos }] = await Promise.all([
    supabase.rpc('ops_get_vendedores') as unknown as Promise<{ data: VendedorOps[] | null }>,
    supabase.from('colegios').select('*').eq('activo', true).order('nombre'),
    supabase.from('codigos_descuento').select('colegio_id, codigo'),
  ])

  // ops_get_vendedores() no devuelve colegio_id directo (la tabla vendedores
  // tiene RLS sin policies, solo se lee a través de las RPC) — para saber
  // qué colegios ya tienen vendedor, matcheamos por el "codigo" que la RPC
  // ya resuelve (el código más antiguo de codigos_descuento para ese
  // colegio_id) contra la lista de códigos que sí podemos leer directo.
  const codigosDeVendedores = new Set((vendedores ?? []).map((v) => v.codigo).filter((c): c is string => !!c))
  const colegioIdsConVendedor = new Set(
    (codigos ?? []).filter((cd) => codigosDeVendedores.has(cd.codigo)).map((cd) => cd.colegio_id)
  )
  const colegiosDisponibles = (colegios ?? []).filter((c) => !colegioIdsConVendedor.has(c.id)) as Colegio[]

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Vendedores</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Alta y liquidación de comisiones de vendedores por colegio.
        </p>
      </div>

      <VendedoresClient vendedoresIniciales={vendedores ?? []} colegiosDisponibles={colegiosDisponibles} />
    </div>
  )
}
