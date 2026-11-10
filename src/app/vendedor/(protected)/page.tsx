import { requireVendedor, getClientes, getPerfil } from '@/lib/vendedor/auth'
import ResumenClient from '@/components/vendedor/ResumenClient'

export const dynamic = 'force-dynamic'

export default async function VendedorResumenPage() {
  const [resumen, clientes, perfil] = await Promise.all([
    requireVendedor(),
    getClientes(),
    getPerfil(),
  ])

  return <ResumenClient resumen={resumen} clientes={clientes} perfil={perfil} />
}
