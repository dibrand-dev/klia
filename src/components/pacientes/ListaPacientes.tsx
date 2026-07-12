'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatNombreCompleto, getAvatarClasses } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Paciente, Profile } from '@/types/database'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type PacienteListado = Paciente & { ultima_cita: string | null }

function formatUltimaCita(fecha: string | null): string {
  if (!fecha) return 'Sin citas registradas'
  const d = parseISO(fecha)
  if (isToday(d)) return 'Última cita: Hoy'
  if (isYesterday(d)) return 'Última cita: Ayer'
  return `Última cita: ${format(d, "d MMM yyyy", { locale: es })}`
}

export default function ListaPacientes({
  pacientes,
  profile,
  totalCount = 0,
  currentPage = 1,
  pageSize = 12,
}: {
  pacientes: PacienteListado[]
  profile: Profile | null
  totalCount?: number
  currentPage?: number
  pageSize?: number
}) {
  const [busqueda, setBusqueda] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [ordenFilter, setOrdenFilter] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<PacienteListado[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const texto = busqueda.trim()
    if (!texto) {
      setResultadosBusqueda(null)
      setBuscando(false)
      return
    }

    let cancelado = false
    setBuscando(true)
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelado) return
      const { data } = await supabase
        .from('pacientes')
        .select('*')
        .eq('terapeuta_id', user.id)
        .or(`nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,dni.ilike.%${texto}%`)
        .order('apellido')
        .limit(50)
      if (cancelado) return
      const encontrados = data ?? []
      let ultimaCitaMap = new Map<string, string>()
      if (encontrados.length > 0) {
        const { data: turnos } = await supabase
          .from('turnos')
          .select('paciente_id, fecha_hora')
          .eq('terapeuta_id', user.id)
          .eq('estado', 'realizado')
          .in('paciente_id', encontrados.map((p) => p.id))
          .order('fecha_hora', { ascending: false })
        for (const t of turnos ?? []) {
          if (!ultimaCitaMap.has(t.paciente_id)) ultimaCitaMap.set(t.paciente_id, t.fecha_hora)
        }
      }
      if (cancelado) return
      setResultadosBusqueda(encontrados.map((p) => ({ ...p, ultima_cita: ultimaCitaMap.get(p.id) ?? null })) as PacienteListado[])
      setBuscando(false)
    }, 300)

    return () => { cancelado = true; clearTimeout(timer) }
  }, [busqueda])

  const baseList = resultadosBusqueda ?? pacientes
  const filtrados = baseList.filter((p) => {
    const matchEstado =
      estadoFilter === '' ||
      (estadoFilter === 'activo' && p.activo) ||
      (estadoFilter === 'inactivo' && !p.activo)
    return matchEstado
  })

  const initials = profile
    ? `${profile.nombre?.[0] ?? ''}${profile.apellido?.[0] ?? ''}`.toUpperCase()
    : 'U'

  return (
    <>
      {/* TopAppBar */}
      <header className="sticky top-0 w-full z-40 bg-[#f7f9fb]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,26,72,0.06)] flex items-center justify-between px-8 py-6">
        <div className="flex items-center">
          <h2 className="text-2xl font-bold tracking-tighter text-primary">
            Directorio de Pacientes
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/pacientes/nuevo"
            className="bg-primary text-on-primary py-2 px-4 rounded-xl font-medium text-sm flex items-center hover:bg-primary-container transition-colors shadow-[0_8px_24px_rgba(0,26,72,0.06)]"
          >
            <span className="material-symbols-outlined mr-2 text-[18px]">add</span>
            Nuevo Paciente
          </Link>
        </div>
      </header>

      {/* Divider */}
      <div className="w-full bg-[#f2f4f6] h-[1px]" />

      {/* Content Canvas */}
      <div className="p-8 max-w-7xl mx-auto w-full flex-1">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-surface-container-low p-4 rounded-xl shadow-[0_8px_24px_rgba(0,26,72,0.03)] border border-outline-variant/15">
          <div className="relative w-full md:w-96">
            <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant ${buscando ? 'animate-spin' : ''}`}>
              {buscando ? 'progress_activity' : 'search'}
            </span>
            <input
              type="text"
              placeholder="Buscar pacientes..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-2.5 pl-4 pr-10 text-sm text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
              >
                <option value="">Estado</option>
                <option value="activo">En Tratamiento</option>
                <option value="inactivo">Alta</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                arrow_drop_down
              </span>
            </div>
            <div className="relative flex-1 md:flex-none">
              <select
                value={ordenFilter}
                onChange={(e) => setOrdenFilter(e.target.value)}
                className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-2.5 pl-4 pr-10 text-sm text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
              >
                <option value="">Última Cita</option>
                <option value="esta_semana">Esta semana</option>
                <option value="este_mes">Este mes</option>
                <option value="antiguos">Más antiguos</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                arrow_drop_down
              </span>
            </div>
          </div>
        </div>

        {/* Patient Grid */}
        {filtrados.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-4 block opacity-40">
              group
            </span>
            <p className="font-semibold text-on-surface mb-1">
              {busqueda || estadoFilter
                ? 'No se encontraron pacientes'
                : 'Todavía no tenés pacientes cargados'}
            </p>
            {!busqueda && !estadoFilter && (
              <Link href="/pacientes/nuevo" className="btn-primary inline-flex mt-4">
                <span className="material-symbols-outlined text-sm">add</span>
                Agregar primer paciente
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtrados.map((paciente) => (
              <PacienteCard key={paciente.id} paciente={paciente} />
            ))}
          </div>
        )}

        {!resultadosBusqueda && totalCount > pageSize && (
          <Paginador
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / pageSize)}
          />
        )}
      </div>
    </>
  )
}

function Paginador({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const router = useRouter()

  function goTo(page: number) {
    router.push(`/pacientes?page=${page}`)
  }

  // Build page number list with ellipsis
  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (currentPage > 3) pages.push('…')
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
      pages.push(p)
    }
    if (currentPage < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 36, height: 36, borderRadius: 8, border: '1px solid var(--border, #E7E9EE)',
    background: 'var(--surface, #fff)', color: 'var(--ink-2, #1F2937)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    padding: '0 8px', transition: 'background 0.12s',
  }
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'var(--accent, #2563EB)', color: '#fff',
    border: '1px solid transparent', fontWeight: 700,
  }
  const btnDisabled: React.CSSProperties = {
    ...btnBase, opacity: 0.38, cursor: 'not-allowed',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32, paddingBottom: 8 }}>
      <button
        style={currentPage <= 1 ? btnDisabled : btnBase}
        disabled={currentPage <= 1}
        onClick={() => goTo(currentPage - 1)}
        aria-label="Página anterior"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
      </button>

      {pageNumbers().map((p, i) =>
        p === '…' ? (
          <span key={`ell-${i}`} style={{ ...btnBase, border: 'none', background: 'transparent', cursor: 'default', color: 'var(--muted, #5B6472)' }}>…</span>
        ) : (
          <button
            key={p}
            style={p === currentPage ? btnActive : btnBase}
            onClick={() => p !== currentPage && goTo(p as number)}
          >
            {p}
          </button>
        )
      )}

      <button
        style={currentPage >= totalPages ? btnDisabled : btnBase}
        disabled={currentPage >= totalPages}
        onClick={() => goTo(currentPage + 1)}
        aria-label="Página siguiente"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
      </button>
    </div>
  )
}

function PacienteCard({ paciente }: { paciente: PacienteListado }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const iniciales = `${paciente.nombre[0] ?? ''}${paciente.apellido[0] ?? ''}`.toUpperCase()
  const motivo = paciente.motivo_consulta?.trim() || paciente.notas?.split('\n')[0]?.trim() || null
  const ultimaCitaStr = formatUltimaCita(paciente.ultima_cita)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  async function doEliminar() {
    const supabase = createClient()
    const { error } = await supabase.from('pacientes').delete().eq('id', paciente.id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    router.refresh()
  }

  return (
    <>
    <Link
      href={`/pacientes/${paciente.id}`}
      className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_8px_24px_rgba(0,26,72,0.06)] hover:shadow-[0_12px_32px_rgba(0,26,72,0.08)] transition-all cursor-pointer border border-outline-variant/10 relative group block"
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${getAvatarClasses(paciente.genero)}`}>
            {iniciales}
          </div>
          <div>
            <h3 className="text-base font-semibold text-on-surface">
              {formatNombreCompleto(paciente.nombre, paciente.apellido)}
            </h3>
            <p className="text-xs text-on-surface-variant font-medium tracking-wide">
              PAC-{paciente.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* 3-dot menu */}
        <div ref={menuRef} className="relative">
          <button
            className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-container-low p-1.5 rounded-full"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v) }}
          >
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-outline-variant/20 overflow-hidden z-20">
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/pacientes/${paciente.id}?edit=1`) }}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Editar
              </button>
              <button
                className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left border-t border-outline-variant/10"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); setConfirmOpen(true) }}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card info */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center text-sm text-on-surface-variant">
          <span className="material-symbols-outlined mr-2 text-[16px]">calendar_month</span>
          <span>{ultimaCitaStr}</span>
        </div>
        {motivo && (
          <div className="flex items-center text-sm text-on-surface-variant">
            <span className="material-symbols-outlined mr-2 text-[16px]">stethoscope</span>
            <span className="truncate">{motivo}</span>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="pt-4 border-t border-surface-container-low flex justify-between items-center">
        {paciente.activo ? (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-tertiary-fixed text-on-tertiary-fixed-variant">
            EN TRATAMIENTO
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-surface-container text-on-surface-variant">
            ALTA
          </span>
        )}
        <span className="text-sm font-semibold text-primary group-hover:text-primary-container transition-colors">
          Ver Perfil
        </span>
      </div>
    </Link>

    <ConfirmDialog
      open={confirmOpen}
      title={`Eliminar a ${formatNombreCompleto(paciente.nombre, paciente.apellido)}`}
      message="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      variant="danger"
      onConfirm={() => { setConfirmOpen(false); doEliminar() }}
      onCancel={() => setConfirmOpen(false)}
    />
  </>
  )
}
