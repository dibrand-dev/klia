import { requireVendedor, getComisiones } from '@/lib/vendedor/auth'
import ComisionesClient from '@/components/vendedor/ComisionesClient'

export const dynamic = 'force-dynamic'

export default async function VendedorComisionesPage() {
  const [resumen, comisiones] = await Promise.all([
    requireVendedor(),
    getComisiones(),
  ])

  return <ComisionesClient resumen={resumen} comisiones={comisiones} />
}
