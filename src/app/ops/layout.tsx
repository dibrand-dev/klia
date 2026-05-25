import { requireAdminUser } from '@/lib/ops/auth'
import OpsShell from '@/components/ops/OpsShell'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await requireAdminUser()

  return (
    <OpsShell adminUser={adminUser}>
      {children}
    </OpsShell>
  )
}
