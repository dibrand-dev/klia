import { requireVendedor } from '@/lib/vendedor/auth'

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  await requireVendedor()
  return <>{children}</>
}
