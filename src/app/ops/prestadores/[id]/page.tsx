import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import PrestadorActions from '@/components/ops/PrestadorActions'

export const metadata = { title: 'Detalle prestador — Klia Ops' }

export default async function PrestadorDetallePage({
  params,
}: {
  params: { id: string }
}) {
  await requireAdminUser()
  const supabase = createClient()

  const [
    { data: profile },
    { data: turnos, count: turnosCount },
    { count: pacientesCount },
    { data: lastSesion },
    { data: lastSignIn },
    { data: planes },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.id).single(),
    supabase
      .from('turnos')
      .select('id, fecha_hora, estado, paciente_id', { count: 'exact' })
      .eq('terapeuta_id', params.id)
      .order('fecha_hora', { ascending: false })
      .limit(10),
    supabase
      .from('pacientes')
      .select('*', { count: 'exact', head: true })
      .eq('terapeuta_id', params.id),
    supabase
      .from('turnos')
      .select('fecha_hora')
      .eq('terapeuta_id', params.id)
      .eq('estado', 'realizado')
      .order('fecha_hora', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc('admin_get_last_sign_in', { p_id: params.id }),
    supabase
      .from('planes')
      .select('id, nombre')
      .eq('activo', true)
      .order('precio_mensual', { ascending: true }),
  ])

  if (!profile) notFound()

  const lastSesionLabel = lastSesion?.fecha_hora
    ? format(parseISO(lastSesion.fecha_hora), "d MMM ''yy", { locale: es })
    : '—'

  const lastSignInLabel = lastSignIn
    ? format(parseISO(lastSignIn as string), 'dd/MM/yy HH:mm', { locale: es })
    : '—'

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[900px]">
      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl shrink-0">
          {profile.nombre[0]}{profile.apellido[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-on-surface">{profile.nombre} {profile.apellido}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{profile.especialidad ?? '—'} · {profile.email}</p>
          <div className="flex gap-2 mt-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              profile.estado_cuenta === 'activa' ? 'bg-green-50 text-green-700' :
              profile.estado_cuenta === 'trial'  ? 'bg-amber-50 text-amber-700' :
              profile.estado_cuenta === 'bloqueada' ? 'bg-red-50 text-red-700' :
              'bg-gray-100 text-gray-500'
            }`}>{profile.estado_cuenta}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-medium capitalize">Plan: {profile.plan}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Datos del perfil */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">Datos profesionales</h2>
          <dl className="kv">
            <dt>Email</dt><dd>{profile.email}</dd>
            <dt>Especialidad</dt><dd>{profile.especialidad ?? '—'}</dd>
            <dt>Matrícula</dt><dd>{profile.matricula ?? '—'}</dd>
            <dt>Teléfono</dt><dd>{profile.telefono ?? '—'}</dd>
            <dt>Registro</dt><dd>{format(parseISO(profile.created_at), "d 'de' MMMM yyyy", { locale: es })}</dd>
            <dt>Último acceso</dt><dd>{lastSignInLabel}</dd>
          </dl>
        </div>

        {/* Métricas de actividad */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">Actividad</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Pacientes', value: pacientesCount ?? 0, icon: 'group' },
              { label: 'Turnos totales', value: turnosCount ?? 0, icon: 'calendar_today' },
              { label: 'Plan actual', value: profile.plan ?? '—', icon: 'workspace_premium' },
              { label: 'Última sesión', value: lastSesionLabel, icon: 'schedule' },
            ].map((m) => (
              <div key={m.label} className="bg-surface-container-lowest rounded-xl p-4">
                <span className="material-symbols-outlined text-primary text-xl block mb-1">{m.icon}</span>
                <p className="text-xl font-bold text-on-surface leading-tight">{m.value}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <PrestadorActions
        profileId={params.id}
        profileName={`${profile.nombre} ${profile.apellido}`}
        estadoCuenta={profile.estado_cuenta}
        trialFin={profile.trial_fin ?? null}
        planes={planes ?? []}
      />

      {/* Últimos turnos */}
      <div className="mt-6 bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10">
          <h2 className="text-sm font-bold text-on-surface">Últimos 10 turnos creados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-lowest">
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Fecha y hora</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(turnos ?? []).map((t) => (
                <tr key={t.id} className="border-b border-outline-variant/5">
                  <td className="px-6 py-3 text-on-surface">
                    {format(parseISO(t.fecha_hora), "d MMM yyyy HH:mm", { locale: es })}
                  </td>
                  <td className="px-6 py-3 capitalize text-on-surface-variant">{t.estado}</td>
                </tr>
              ))}
              {(turnos ?? []).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-10 text-center text-on-surface-variant text-sm">
                    Sin turnos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
