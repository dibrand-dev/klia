import { requireAdminUser } from '@/lib/ops/auth'
import OpsSidebar from '@/components/ops/OpsSidebar'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await requireAdminUser()

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <OpsSidebar adminUser={adminUser} />
      <main className="md:ml-[260px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
