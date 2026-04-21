import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import { format, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export const metadata = { title: 'Dashboard — Klia Ops' }

function MetricCard({
  label,
  value,
  sub,
  icon,
  color = 'text-primary',
}: {
  label: string
  value: string | number
  sub?: string
  icon: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-outline-variant/20 shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0">
        <span className={`material-symbols-outlined text-[22px] ${color}`}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-on-surface">{value}</p>
        {sub && <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default async function OpsDashboardPage() {
  await requireAdminUser()
  const supabase = createClient()

  const inicioMes = startOfMonth(new Date()).toISOString()

  const [
    { count: totalPrestadores },
    { count: nuevosEsteMes },
    { data: ultimosPrestadores },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('profiles').select('id, nombre, apellido, email, especialidad, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Dashboard</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard label="Prestadores activos" value={totalPrestadores ?? 0} icon="groups" color="text-primary" />
        <MetricCard label="En período de prueba" value="—" sub="Próximamente" icon="hourglass_empty" color="text-amber-500" />
        <MetricCard label="Acceso bloqueado" value="—" sub="Próximamente" icon="block" color="text-error" />
        <MetricCard label="Nuevos este mes" value={nuevosEsteMes ?? 0} icon="person_add" color="text-green-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard label="Ingresos del mes" value="—" sub="Integración MP pendiente" icon="payments" color="text-primary" />
        <MetricCard label="Débitos rechazados" value="—" sub="Integración MP pendiente" icon="money_off" color="text-error" />
        <MetricCard label="Pendientes de pago" value="—" sub="Integración MP pendiente" icon="pending" color="text-amber-500" />
      </div>

      {/* Tablas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Últimos prestadores registrados */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10">
            <h2 className="text-sm font-bold text-on-surface">Últimos prestadores registrados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Nombre</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Especialidad</th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Registro</th>
                </tr>
              </thead>
              <tbody>
                {(ultimosPrestadores ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-outline-variant/5 hover:bg-surface-container-lowest transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium text-on-surface">{p.nombre} {p.apellido}</p>
                      <p className="text-xs text-on-surface-variant">{p.email}</p>
                    </td>
                    <td className="px-6 py-3 text-on-surface-variant">{p.especialidad ?? '—'}</td>
                    <td className="px-6 py-3 text-on-surface-variant whitespace-nowrap">
                      {format(parseISO(p.created_at), 'd MMM yyyy', { locale: es })}
                    </td>
                  </tr>
                ))}
                {(ultimosPrestadores ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-on-surface-variant text-sm">
                      Sin prestadores registrados aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos pagos (mock) */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10">
            <h2 className="text-sm font-bold text-on-surface">Últimos pagos recibidos</h2>
          </div>
          <div className="px-6 py-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">payments</span>
            <p className="text-sm">Integración con Mercado Pago pendiente.</p>
            <p className="text-xs mt-1 opacity-60">Los pagos aparecerán aquí en una fase posterior.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
