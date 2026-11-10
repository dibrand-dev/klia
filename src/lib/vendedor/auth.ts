import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type VendedorResumen = Database['public']['Functions']['vendedor_get_resumen']['Returns'][number]
type VendedorCliente = Database['public']['Functions']['vendedor_get_clientes']['Returns'][number]
type VendedorComision = Database['public']['Functions']['vendedor_get_comisiones']['Returns'][number]

export interface VendedorPerfil {
  nombre: string
  apellido: string
  email: string
  codigo: string | null
  diasColchon: number | null
  descuentoPct: number | null
}

// vendedor_get_resumen() es SECURITY DEFINER y lanza 'Unauthorized' si
// auth.uid() no corresponde a un vendedor activo — no hace falta validar
// nada del lado de la app además de tener sesión, la RPC es la fuente de
// verdad de la autorización.
export async function requireVendedor(): Promise<VendedorResumen> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/vendedor/login')

  const { data, error } = await supabase.rpc('vendedor_get_resumen')
  if (error || !data || data.length === 0) redirect('/vendedor/login')

  return data[0]
}

export async function getClientes(): Promise<VendedorCliente[]> {
  const supabase = createClient()
  const { data } = await supabase.rpc('vendedor_get_clientes')
  return data ?? []
}

export async function getComisiones(): Promise<VendedorComision[]> {
  const supabase = createClient()
  const { data } = await supabase.rpc('vendedor_get_comisiones')
  return data ?? []
}

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Datos propios del vendedor que ninguna RPC devuelve (código, días de
// colchón) — `vendedores` tiene RLS sin policies, así que se leen con el
// service client, igual que en los endpoints de OPS. El código nunca se
// guarda en `vendedores`: se deriva del código de descuento más antiguo de
// su colegio, mismo criterio que usa `ops_get_vendedores()` en la base.
export async function getPerfil(): Promise<VendedorPerfil | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = serviceClient()
  const { data: vendedor } = await db
    .from('vendedores')
    .select('colegio_id, dias_colchon')
    .eq('user_id', user.id)
    .single()

  let codigo: string | null = null
  let descuentoPct: number | null = null
  if (vendedor?.colegio_id) {
    const { data: cd } = await db
      .from('codigos_descuento')
      .select('codigo, porcentaje_descuento')
      .eq('colegio_id', vendedor.colegio_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    codigo = cd?.codigo ?? null
    descuentoPct = cd?.porcentaje_descuento ?? null
  }

  return {
    nombre: (user.user_metadata?.nombre as string | undefined) ?? '',
    apellido: (user.user_metadata?.apellido as string | undefined) ?? '',
    email: user.email ?? '',
    codigo,
    diasColchon: vendedor?.dias_colchon ?? null,
    descuentoPct,
  }
}
