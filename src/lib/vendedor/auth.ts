import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type VendedorResumen = Database['public']['Functions']['vendedor_get_resumen']['Returns'][number]
type VendedorCliente = Database['public']['Functions']['vendedor_get_clientes']['Returns'][number]
type VendedorComision = Database['public']['Functions']['vendedor_get_comisiones']['Returns'][number]

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
