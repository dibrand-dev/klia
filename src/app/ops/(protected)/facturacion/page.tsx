import { requireAdminUser } from '@/lib/ops/auth'

export const metadata = { title: 'Facturación — Klia Ops' }

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
    <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className={`material-symbols-outlined text-2xl ${color}`}>{icon}</span>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">{label}</p>
      </div>
      <p className="text-3xl font-bold text-on-surface">{value}</p>
      {sub && <p className="text-xs text-on-surface-variant mt-1">{sub}</p>}
    </div>
  )
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant/10">
        <h2 className="text-sm font-bold text-on-surface">{label}</h2>
      </div>
      <div className="px-6 py-14 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">payments</span>
        <p className="text-sm">Sin datos disponibles aún.</p>
        <p className="text-xs mt-1 opacity-60">La integración con Mercado Pago y ARCA se completa en una fase posterior.</p>
      </div>
    </div>
  )
}

export default async function FacturacionPage() {
  await requireAdminUser()

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Facturación</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Ingresos, suscripciones y estado de pagos.
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Ingresos del mes"
          value="—"
          sub="Integración MP pendiente"
          icon="trending_up"
          color="text-green-600"
        />
        <MetricCard
          label="Pendientes de pago"
          value="—"
          sub="Integración MP pendiente"
          icon="pending"
          color="text-amber-500"
        />
        <MetricCard
          label="Débitos rechazados"
          value="—"
          sub="Integración MP pendiente"
          icon="money_off"
          color="text-error"
        />
      </div>

      {/* Tablas de detalle */}
      <div className="space-y-6">
        <EmptySection label="Prestadores que pagaron este mes" />
        <EmptySection label="Próximos vencimientos" />
        <EmptySection label="Pagos fallidos" />
      </div>
    </div>
  )
}
