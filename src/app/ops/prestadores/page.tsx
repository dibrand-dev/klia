import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

export const metadata = { title: 'Prestadores — Klia Ops' }

export default async function PrestadoresPage({
  searchParams,
}: {
  searchParams: { q?: string; plan?: string; estado?: string }
}) {
  await requireAdminUser()
  const supabase = createClient()

  let query = supabase
    .from('profiles')
    .select('id, nombre, apellido, email, especialidad, created_at')
    .order('created_at', { ascending: false })

  if (searchParams.q) {
    query = query.or(
      `nombre.ilike.%${searchParams.q}%,apellido.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`
    )
  }

  const { data: prestadores } = await query

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Prestadores</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {prestadores?.length ?? 0} profesionales registrados
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-center">
        <form method="GET" className="flex flex-wrap gap-3 w-full">
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Buscar por nombre o email..."
            className="input-field flex-1 min-w-[200px] max-w-sm"
          />
          <select name="plan" defaultValue={searchParams.plan ?? ''} className="input-field w-40">
            <option value="">Todos los planes</option>
            <option value="esencial">Esencial</option>
            <option value="profesional">Profesional</option>
            <option value="premium">Premium</option>
          </select>
          <select name="estado" defaultValue={searchParams.estado ?? ''} className="input-field w-40">
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="prueba">En prueba</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
          <button type="submit" className="btn-primary px-5 py-2">
            Buscar
          </button>
          {(searchParams.q || searchParams.plan || searchParams.estado) && (
            <Link href="/ops/prestadores" className="btn-secondary px-5 py-2">
              Limpiar
            </Link>
          )}
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-lowest">
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Profesional</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Especialidad</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Plan</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Estado</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Registro</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(prestadores ?? []).map((p) => (
                <tr key={p.id} className="border-b border-outline-variant/5 hover:bg-surface-container-lowest transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-on-surface">{p.nombre} {p.apellido}</p>
                    <p className="text-xs text-on-surface-variant">{p.email}</p>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{p.especialidad ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container font-medium text-on-surface-variant">
                      —
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">
                      Activo
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                    {format(parseISO(p.created_at), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/ops/prestadores/${p.id}`}
                      className="text-sm text-primary font-medium hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {(prestadores ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">search_off</span>
                    <p>No se encontraron prestadores.</p>
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
