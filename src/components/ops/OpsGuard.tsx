import type { AdminUser } from '@/types/database'

export default function OpsGuard({
  adminUser,
  requiredRol,
  children,
}: {
  adminUser: AdminUser
  requiredRol: 'total'
  children: React.ReactNode
}) {
  if (adminUser.rol !== requiredRol) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-4">lock</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">Acceso restringido</h2>
        <p className="text-sm text-on-surface-variant">
          Esta sección solo está disponible para administradores con rol <strong>total</strong>.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
