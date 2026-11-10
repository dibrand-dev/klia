import { requireVendedor, getClientes, getPerfil } from '@/lib/vendedor/auth'
import ClientesClient from '@/components/vendedor/ClientesClient'

export const dynamic = 'force-dynamic'

export default async function VendedorClientesPage({ searchParams }: { searchParams: { f?: string } }) {
  const [resumen, clientes, perfil] = await Promise.all([
    requireVendedor(),
    getClientes(),
    getPerfil(),
  ])

  return <ClientesClient clientes={clientes} perfil={perfil} resumen={resumen} filtroInicial={searchParams.f} />
}
