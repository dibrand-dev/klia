import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

const PLAN_LABELS: Record<string, string> = {
  esencial: 'Esencial',
  profesional: 'Profesional',
  premium: 'Premium',
}

const MODALIDAD_LABELS: Record<string, string> = {
  mensual: 'Mensual',
  anual: 'Anual',
}

function formatMonto(monto: number): string {
  return `$${monto.toLocaleString('es-AR')}`
}

export default async function OpsDashboardPage() {
  await requireAdminUser()
  const supabase = createClient()
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const inicioMes = startOfMonth(new Date()).toISOString()

  const [
    { count: totalPrestadores },
    { count: nuevosEsteMes },
    { count: enTrial },
    { count: accesoBloqueado },
    { data: ultimosPrestadores },
    { data: suscrAutorizadasMes },
    { count: debitosRechazados },
    { count: pendientesDePago },
    { data: ultimasSuscripciones },
    { count: totalPacientes },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('estado_cuenta', 'trial'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('estado_cuenta', 'bloqueada'),
    supabase.from('profiles').select('id, nombre, apellido, email, especialidad, created_at').order('created_at', { ascending: false }).limit(10),
    // Autorizadas este mes para calcular ingresos
    supabase.from('suscripciones').select('monto').eq('estado', 'authorized').gte('suscripcion_inicio', inicioMes),
    // Pausadas este mes (débitos rechazados)
    supabase.from('suscripciones').select('*', { count: 'exact', head: true }).eq('estado', 'paused').gte('updated_at', inicioMes),
    // Pendientes totales
    supabase.from('suscripciones').select('*', { count: 'exact', head: true }).eq('estado', 'pending'),
    // Últimas suscripciones autorizadas
    supabase.from('suscripciones').select('id, terapeuta_id, plan, modalidad, monto, suscripcion_inicio').eq('estado', 'authorized').order('suscripcion_inicio', { ascending: false }).limit(8),
    // Total pacientes (service role para bypass RLS)
    serviceSupabase.from('pacientes').select('*', { count: 'exact', head: true }),
  ])

  const ingresosMes = (suscrAutorizadasMes ?? []).reduce((acc, s) => acc + (s.monto ?? 0), 0)

  // Fetch profiles for the last subscriptions
  const terapeutaIds = (ultimasSuscripciones ?? []).map((s) => s.terapeuta_id).filter(Boolean)
  const perfilesMap: Record<string, { nombre: string; apellido: string }> = {}
  if (terapeutaIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, apellido')
      .in('id', terapeutaIds)
    for (const p of perfiles ?? []) {
      perfilesMap[p.id] = { nombre: p.nombre, apellido: p.apellido }
    }
  }

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
        <MetricCard label="En período de prueba" value={enTrial ?? 0} sub="Estado trial activo" icon="hourglass_empty" color="text-amber-500" />
        <MetricCard label="Acceso bloqueado" value={accesoBloqueado ?? 0} sub="Pago fallido o cancelado" icon="block" color="text-error" />
        <MetricCard label="Nuevos este mes" value={nuevosEsteMes ?? 0} icon="person_add" color="text-green-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Ingresos del mes"
          value={ingresosMes > 0 ? formatMonto(ingresosMes) : '—'}
          sub={ingresosMes > 0 ? `${(suscrAutorizadasMes ?? []).length} pagos recibidos` : 'Sin cobros este mes'}
          icon="payments"
          color="text-primary"
        />
        <MetricCard
          label="Débitos rechazados"
          value={debitosRechazados ?? 0}
          sub="Este mes"
          icon="money_off"
          color="text-error"
        />
        <MetricCard
          label="Pendientes de pago"
          value={pendientesDePago ?? 0}
          sub="Suscripciones sin confirmar"
          icon="pending"
          color="text-amber-500"
        />
        <MetricCard
          label="Total pacientes activos"
          value={totalPacientes ?? 0}
          sub="En todas las cuentas"
          icon="person_heart"
          color="text-green-600"
        />
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

        {/* Últimos pagos recibidos */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10">
            <h2 className="text-sm font-bold text-on-surface">Últimos pagos recibidos</h2>
          </div>
          {(ultimasSuscripciones ?? []).length === 0 ? (
            <div className="px-6 py-10 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">payments</span>
              <p className="text-sm">Sin pagos registrados aún.</p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/10">
              {(ultimasSuscripciones ?? []).map((s) => {
                const perfil = perfilesMap[s.terapeuta_id]
                return (
                  <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">
                        {perfil ? `${perfil.nombre} ${perfil.apellido}` : '—'}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {PLAN_LABELS[s.plan] ?? s.plan} · {MODALIDAD_LABELS[s.modalidad] ?? s.modalidad}
                      </p>
                      {s.suscripcion_inicio && (
                        <p className="text-[11px] text-on-surface-variant opacity-60 mt-0.5">
                          {format(parseISO(s.suscripcion_inicio), "d MMM yyyy", { locale: es })}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-bold text-green-600">
                      {formatMonto(s.monto)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
