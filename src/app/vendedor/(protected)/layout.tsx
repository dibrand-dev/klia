import { requireVendedor, getPerfil } from '@/lib/vendedor/auth'
import VendedorShell from '@/components/vendedor/VendedorShell'
import { ToastProvider } from '@/app/vendedor/Toast'

export default async function VendedorProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireVendedor()
  const perfil = await getPerfil()

  return (
    <ToastProvider>
      <VendedorShell nombre={perfil?.nombre ?? ''} apellido={perfil?.apellido ?? ''} email={perfil?.email ?? ''}>
        {children}
      </VendedorShell>
    </ToastProvider>
  )
}
