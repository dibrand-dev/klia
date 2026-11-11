'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PeriodoPreset } from '@/lib/dashboard/periodo'
import type { DashboardResumen, SerieMensualMes } from '@/types/dashboard'
import DbIcon from './icons'
import DashboardDrilldownSlide, { type DrilldownRow, type DrilldownSection } from './DashboardDrilldownSlide'
import './dashboard.css'

interface TurnoHoy { id: string; pacienteId: string; fecha_hora: string; estado: string; paciente: { nombre: string; apellido: string } | null }
interface EntrevistaHoy { id: string; nombre: string; apellido: string; hora: string; estado: string }
interface PeriodoTurno {
  id: string; pacienteId: string; fecha_hora: string; estado: string
  monto: number | null; moneda: string; pagado: boolean; montoPagado: number
  origen: string; paciente: { nombre: string; apellido: string } | null
}
interface PacienteSinVenir { id: string; nombre: string; apellido: string; ultimaCita: string | null; telefono: string | null }
interface DeudaTop { pacienteId: string; nombre: string; apellido: string; saldo: number; moneda: string; n: number; masAntigua: string }
interface Deuda { porMoneda: Record<string, { total: number; count: number }>; totalCount: number; top: DeudaTop[] }
interface OsFila { osNombre: string; n: number; monto: number; moneda: string }
interface OsMes { mesKey: string; filas: OsFila[] }
interface OsSinLiquidar { totalCount: number; porMoneda: Record<string, number>; meses: OsMes[] }
interface SerieVence { id: string; pacienteId: string; fecha_fin: string; paciente: { nombre: string; apellido: string } | null }
interface PresetInfo { key: PeriodoPreset; label: string; desde: string; hasta: string }
interface Periodo { preset: PeriodoPreset; desde: string; hasta: string; cmpTipo: 'prev' | 'yoy'; cmpLabel: string; cmpDesde: string; cmpHasta: string }

interface Props {
  nombreTerapeuta: string
  plan: string
  veCobros: boolean
  periodo: Periodo
  presetsInfo: PresetInfo[]
  resumen: DashboardResumen | null
  serieMensual: SerieMensualMes[]
  hoyArgStr: string
  hoy: { turnos: TurnoHoy[]; entrevistas: EntrevistaHoy[] }
  periodoTurnos: PeriodoTurno[]
  pacientesSinVenir: PacienteSinVenir[]
  deuda: Deuda
  osSinLiquidar: OsSinLiquidar
  seriesVencen: SerieVence[]
}

type DrilldownKind = 'sesiones' | 'cobrado' | 'porcobrar' | 'atendidos' | 'sinvenir' | 'deuda' | 'os' | 'series' | null

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function nf(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function money(n: number, moneda = 'ARS'): string {
  const sym = moneda === 'ARS' ? '$' : moneda === 'USD' ? 'U$S' : '€'
  return `${sym} ${nf(n)}`
}
function niceMax(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const m = v / exp
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 4 ? 4 : m <= 8 ? 8 : 10
  return nice * exp
}
function axisLabel(n: number, moneda: string): string {
  const sym = moneda === 'ARS' ? '$' : moneda === 'USD' ? 'U$S' : '€'
  if (n === 0) return `${sym} 0`
  if (n >= 1e6) return `${sym} ${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (n >= 1e3) return `${sym} ${(n / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil`
  return `${sym} ${Math.round(n).toLocaleString('es-AR')}`
}
function fechaCorta(iso: string): string {
  return format(parseISO(iso), 'd MMM', { locale: es })
}
function horaDesde(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}
function diasDesde(iso: string): number {
  const ahoraArg = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const fechaArg = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return Math.floor((ahoraArg.getTime() - fechaArg.getTime()) / 86400000)
}
function waHref(telefono: string): string {
  return `https://wa.me/${telefono.replace(/\D/g, '')}`
}
function iniciales(nombre: string, apellido: string): string {
  return `${(nombre[0] ?? '').toUpperCase()}${(apellido[0] ?? '').toUpperCase()}`
}
function avatarVariant(nombre: string): 1 | 2 | 3 | 4 | 5 {
  const suma = Array.from(nombre).reduce((a, c) => a + c.charCodeAt(0), 0)
  return ((suma % 5) + 1) as 1 | 2 | 3 | 4 | 5
}
function rangoLabel(desde: string, hasta: string): string {
  if (desde === hasta) return format(parseISO(desde), 'd MMM yyyy', { locale: es })
  const d = parseISO(desde), h = parseISO(hasta)
  const mismoMes = d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear()
  const izq = format(d, mismoMes ? 'd' : 'd MMM', { locale: es })
  return `${izq} – ${format(h, 'd MMM yyyy', { locale: es })}`
}
function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type DeltaCls = 'good' | 'bad' | 'flat'
function calcDelta(cur: number, prev: number | null | undefined, goodUp: boolean, neutral = false): { dir: 'up' | 'down' | 'flat'; texto: string; cls: DeltaCls } {
  if (prev == null) return { dir: 'flat', texto: 'Sin datos previos', cls: 'flat' }
  let dir: 'up' | 'down' | 'flat' = 'flat'
  let texto = 'Igual'
  if (prev === 0 && cur > 0) { dir = 'up'; texto = 'Nuevo' }
  else if (prev > 0) {
    const pc = Math.round(((cur - prev) / prev) * 100)
    if (pc > 0) { dir = 'up'; texto = `+${pc}%` }
    else if (pc < 0) { dir = 'down'; texto = `−${Math.abs(pc)}%` }
  }
  const cls: DeltaCls = neutral || dir === 'flat' ? 'flat' : ((dir === 'up') === goodUp ? 'good' : 'bad')
  return { dir, texto, cls }
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const w = 60, h = 20
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1
  const pts = data.map((v, i) => [i * (w / (data.length - 1)), h - 2 - ((v - mn) / r) * (h - 4)])
  const last = pts[pts.length - 1]
  return (
    <span className="db-spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-hidden="true">
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--muted-2)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--ink)" />
      </svg>
    </span>
  )
}

function DeltaBadge({ d }: { d: { dir: 'up' | 'down' | 'flat'; texto: string; cls: DeltaCls } }) {
  return (
    <span className={`db-delta ${d.cls}`}>
      <b><DbIcon name={d.dir} />{d.texto}</b>
    </span>
  )
}

function estadoInfo(estado: string) {
  if (estado === 'realizado') return { label: 'Realizado', icon: 'checkC' as const }
  if (estado === 'confirmado') return { label: 'Confirmado', icon: 'check' as const }
  if (estado === 'no_asistio') return { label: 'No asistió', icon: 'userX' as const }
  if (estado === 'cancelado') return { label: 'Cancelado', icon: 'xC' as const }
  return { label: 'Pendiente', icon: 'clock' as const }
}

function WaButton({ telefono }: { telefono: string | null }) {
  if (!telefono) return null
  return (
    <button type="button" className="db-ib" title="WhatsApp" aria-label="WhatsApp"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(waHref(telefono), '_blank', 'noopener,noreferrer') }}>
      <DbIcon name="wa" />
    </button>
  )
}

export default function DashboardClient({
  nombreTerapeuta, plan, veCobros, periodo, presetsInfo, resumen, serieMensual, hoyArgStr,
  hoy, periodoTurnos, pacientesSinVenir, deuda, osSinLiquidar, seriesVencen,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [greeting, setGreeting] = useState('')
  const [proximoTurnoId, setProximoTurnoId] = useState<string | null>(null)
  useEffect(() => {
    setGreeting(saludo())
    const ahora = new Date()
    const next = hoy.turnos.find((t) => (t.estado === 'pendiente' || t.estado === 'confirmado') && new Date(t.fecha_hora) >= ahora)
    setProximoTurnoId(next?.id ?? null)
  }, [hoy.turnos])

  const fechaHoy = capitalizar(format(parseISO(hoyArgStr), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }))

  function navegar(params: { p: string; cmp: string; desde?: string; hasta?: string }) {
    const sp = new URLSearchParams()
    sp.set('p', params.p)
    sp.set('cmp', params.cmp)
    if (params.p === 'custom' && params.desde && params.hasta) {
      sp.set('desde', params.desde)
      sp.set('hasta', params.hasta)
    }
    setPop(null)
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  const [pop, setPop] = useState<'per' | 'cmp' | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customDesde, setCustomDesde] = useState(periodo.desde)
  const [customHasta, setCustomHasta] = useState(periodo.hasta)

  const [drilldown, setDrilldown] = useState<DrilldownKind>(null)
  const [filtroSesiones, setFiltroSesiones] = useState<'all' | 'real' | 'pend'>('all')

  const actual = resumen?.actual
  const comparado = resumen?.comparado
  const spark = resumen?.spark ?? []
  const esEsencial = !veCobros

  const arsActual = actual?.montos?.ARS
  const arsComparado = comparado?.montos?.ARS

  // ---------- drilldowns ----------
  const turnosRealizados = periodoTurnos.filter((t) => t.estado === 'realizado')
  const turnosPendientes = periodoTurnos.filter((t) => t.estado === 'pendiente' || t.estado === 'confirmado')

  function filaTurno(t: PeriodoTurno, kv?: React.ReactNode): DrilldownRow {
    const st = estadoInfo(t.estado)
    return {
      id: t.id,
      primary: t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : '—',
      secondaryNode: <span className="db-mono">{fechaCorta(t.fecha_hora)} · {horaDesde(t.fecha_hora)}</span>,
      kvNode: kv ?? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><DbIcon name={st.icon} />{st.label}</span>,
      href: `/pacientes/${t.pacienteId}`,
      filterKey: t.estado === 'realizado' ? 'real' : 'pend',
    }
  }

  const seccionesSesiones: DrilldownSection[] = [{
    groups: [
      { heading: `Realizadas · ${turnosRealizados.length}`, rows: turnosRealizados.map((t) => filaTurno(t)) },
      { heading: `Pendientes · ${turnosPendientes.length}`, rows: turnosPendientes.map((t) => filaTurno(t)) },
    ],
  }]

  const atendidosMap = new Map<string, { pacienteId: string; nombre: string; apellido: string; n: number; ultima: string }>()
  for (const t of turnosRealizados) {
    const prev = atendidosMap.get(t.pacienteId)
    const nombre = t.paciente?.nombre ?? '', apellido = t.paciente?.apellido ?? ''
    if (!prev) atendidosMap.set(t.pacienteId, { pacienteId: t.pacienteId, nombre, apellido, n: 1, ultima: t.fecha_hora })
    else { prev.n++; if (t.fecha_hora > prev.ultima) prev.ultima = t.fecha_hora }
  }
  const seccionesAtendidos: DrilldownSection[] = [{
    groups: [{ rows: Array.from(atendidosMap.values()).sort((a, b) => b.ultima.localeCompare(a.ultima)).map((p) => ({
      id: p.pacienteId,
      avatarText: iniciales(p.nombre, p.apellido),
      avatarVariant: avatarVariant(p.nombre + p.apellido),
      primary: `${p.apellido}, ${p.nombre}`,
      secondaryNode: `Última sesión: ${fechaCorta(p.ultima)}`,
      kvNode: `${p.n} sesión${p.n !== 1 ? 'es' : ''}`,
      href: `/pacientes/${p.pacienteId}`,
    })) }],
  }]

  const seccionesCobrado: DrilldownSection[] = useMemo(() => {
    const monedas = new Set(periodoTurnos.map((t) => t.moneda))
    return Array.from(monedas).map((moneda) => {
      const rows = periodoTurnos
        .filter((t) => t.estado === 'realizado' && t.moneda === moneda && t.montoPagado > 0)
        .sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora))
      const total = rows.reduce((a, t) => a + t.montoPagado, 0)
      return {
        heading: '',
        groups: [{
          heading: `${moneda === 'ARS' ? 'Pesos' : moneda === 'USD' ? 'Dólares' : moneda} · ${rows.length}`,
          totalNode: money(total, moneda),
          rows: rows.map((t) => ({
            id: t.id,
            primary: t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : '—',
            secondaryNode: <>{fechaCorta(t.fecha_hora)} <span className={`db-tag ${t.origen === 'Particular' ? 'part' : 'os'}`}>{t.origen === 'Particular' ? 'Particular' : `Obra social · ${t.origen}`}</span></>,
            kvNode: money(t.montoPagado, moneda),
            kvClass: 'ok' as const,
            kvSmall: t.montoPagado < (t.monto ?? 0) ? `de ${money(t.monto ?? 0, moneda)}` : undefined,
            href: `/pacientes/${t.pacienteId}`,
          })),
        }],
      }
    })
  }, [periodoTurnos])

  const seccionesPorCobrar: DrilldownSection[] = useMemo(() => {
    const conSaldo = periodoTurnos.filter((t) => t.estado === 'realizado' && (t.monto ?? 0) - t.montoPagado > 0)
    const mk = (particular: boolean) => {
      const monedas = Array.from(new Set(conSaldo.filter((t) => (t.origen === 'Particular') === particular).map((t) => t.moneda)))
      return monedas.map((moneda) => {
        const rows = conSaldo.filter((t) => (t.origen === 'Particular') === particular && t.moneda === moneda).sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
        if (!rows.length) return null
        const total = rows.reduce((a, t) => a + ((t.monto ?? 0) - t.montoPagado), 0)
        return {
          heading: moneda === 'ARS' ? 'Pesos' : moneda === 'USD' ? 'Dólares' : moneda,
          totalNode: money(total, moneda),
          totalSub: `${rows.length} sesiones`,
          rows: rows.map((t) => ({
            id: t.id,
            primary: t.paciente ? `${t.paciente.apellido}, ${t.paciente.nombre}` : '—',
            secondaryNode: <>{fechaCorta(t.fecha_hora)} <span className={`db-tag ${particular ? 'part' : 'os'}`}>{particular ? 'Particular' : `Obra social · ${t.origen}`}</span></>,
            kvNode: money((t.monto ?? 0) - t.montoPagado, moneda),
            kvClass: particular ? 'danger' as const : '' as const,
            kvSmall: t.montoPagado > 0 ? `pagó ${money(t.montoPagado, moneda)}` : undefined,
            href: `/pacientes/${t.pacienteId}`,
          })),
        }
      }).filter((g): g is NonNullable<typeof g> => g !== null)
    }
    return [
      { heading: 'Deuda de pacientes', description: 'Particulares con saldo pendiente', groups: mk(true) },
      { heading: 'Sin liquidar (obra social)', description: 'Se cobran al liquidar con cada obra social', groups: mk(false) },
    ]
  }, [periodoTurnos])

  const seccionesSinVenir: DrilldownSection[] = [{
    groups: [{ rows: [...pacientesSinVenir].sort((a, b) => diasDesde(b.ultimaCita ?? hoyArgStr) - diasDesde(a.ultimaCita ?? hoyArgStr)).map((p) => ({
      id: p.id,
      avatarText: iniciales(p.nombre, p.apellido),
      avatarVariant: avatarVariant(p.nombre + p.apellido),
      primary: `${p.nombre} ${p.apellido}`,
      secondaryNode: p.ultimaCita ? `Última: ${fechaCorta(p.ultimaCita)}` : 'Sin sesión registrada',
      kvNode: p.ultimaCita ? `${diasDesde(p.ultimaCita)} días` : '—',
      href: `/pacientes/${p.id}`,
      actionsNode: <WaButton telefono={p.telefono} />,
    })) }],
  }]

  const seccionesDeuda: DrilldownSection[] = useMemo(() => {
    const monedas = Object.keys(deuda.porMoneda)
    return monedas.map((moneda) => ({
      heading: '',
      groups: [{
        heading: moneda === 'ARS' ? 'Pesos' : moneda === 'USD' ? 'Dólares' : moneda,
        totalNode: money(deuda.porMoneda[moneda].total, moneda),
        rows: deuda.top.filter((d) => d.moneda === moneda).map((d) => ({
          id: `${d.pacienteId}-${d.moneda}`,
          avatarText: iniciales(d.nombre, d.apellido),
          avatarVariant: avatarVariant(d.nombre + d.apellido),
          primary: `${d.nombre} ${d.apellido}`,
          tagsNode: <span className="db-tag part">Particular</span>,
          secondaryNode: `${d.n} sesión${d.n !== 1 ? 'es' : ''} · desde ${fechaCorta(d.masAntigua)}`,
          kvNode: money(d.saldo, moneda),
          kvClass: 'danger' as const,
          href: `/pacientes/${d.pacienteId}`,
        })),
      }],
    }))
  }, [deuda])

  const seccionesOs: DrilldownSection[] = useMemo(() => osSinLiquidar.meses.map((m) => ({
    heading: capitalizar(format(parseISO(`${m.mesKey}-01`), 'MMMM yyyy', { locale: es })),
    groups: [{
      rows: m.filas.map((f, i) => ({
        id: `${m.mesKey}-${i}`,
        avatarText: f.osNombre.slice(0, 2).toUpperCase(),
        avatarVariant: 'os' as const,
        primary: f.osNombre,
        secondaryNode: `${f.n} sesión${f.n !== 1 ? 'es' : ''}`,
        kvNode: money(f.monto, f.moneda),
      })),
    }],
  })), [osSinLiquidar])

  const seccionesSeries: DrilldownSection[] = [{
    groups: [{ rows: [...seriesVencen].sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin)).map((s) => ({
      id: s.id,
      avatarText: s.paciente ? iniciales(s.paciente.nombre, s.paciente.apellido) : '—',
      avatarVariant: s.paciente ? avatarVariant(s.paciente.nombre + s.paciente.apellido) : undefined,
      primary: s.paciente ? `${s.paciente.nombre} ${s.paciente.apellido}` : '—',
      kvNode: fechaCorta(s.fecha_fin),
      href: `/pacientes/${s.pacienteId}`,
    })) }],
  }]

  const DRILLDOWN: Record<Exclude<DrilldownKind, null>, { title: string; subtitle?: string; sections: DrilldownSection[]; emptyMessage: string; filtro?: boolean; footActions?: { label: string; href: string; primary?: boolean }[] }> = {
    sesiones: { title: 'Sesiones del período', subtitle: `${periodoTurnos.length} sesiones · ${rangoLabel(periodo.desde, periodo.hasta)}`, sections: seccionesSesiones, emptyMessage: 'No hay sesiones en este período.', filtro: true, footActions: [{ label: 'Ver agenda', href: '/agenda' }] },
    cobrado: { title: 'Cobrado', subtitle: `${turnosRealizados.filter((t) => t.montoPagado > 0).length} sesiones · ${rangoLabel(periodo.desde, periodo.hasta)}`, sections: seccionesCobrado, emptyMessage: 'Todavía no cobraste nada en este período.', footActions: [{ label: 'Ir a Cobros', href: '/cobros', primary: true }] },
    porcobrar: { title: 'Por cobrar', subtitle: rangoLabel(periodo.desde, periodo.hasta), sections: seccionesPorCobrar, emptyMessage: 'No hay saldo pendiente en este período.', footActions: [{ label: 'Ir a Cobros', href: '/cobros', primary: true }] },
    atendidos: { title: 'Pacientes atendidos', subtitle: `${atendidosMap.size} pacientes · ${rangoLabel(periodo.desde, periodo.hasta)}`, sections: seccionesAtendidos, emptyMessage: 'No atendiste pacientes en este período.', footActions: [{ label: 'Ver pacientes', href: '/pacientes' }] },
    sinvenir: { title: 'Sin venir hace 2+ semanas', subtitle: `${pacientesSinVenir.length} pacientes`, sections: seccionesSinVenir, emptyMessage: 'Todos tus pacientes vinieron en las últimas 2 semanas.', footActions: [{ label: 'Ver pacientes', href: '/pacientes' }] },
    deuda: { title: 'Deuda total de pacientes', subtitle: `${deuda.totalCount} pacientes particulares`, sections: seccionesDeuda, emptyMessage: 'No hay deuda de pacientes particulares.', footActions: [{ label: 'Ir a Cobros', href: '/cobros', primary: true }] },
    os: { title: 'Obras sociales sin liquidar', subtitle: `${osSinLiquidar.totalCount} sesiones`, sections: seccionesOs, emptyMessage: 'No hay sesiones de obra social sin liquidar.', footActions: [{ label: 'Ir a liquidación', href: '/facturacion/liquidacion', primary: true }] },
    series: { title: 'Series recurrentes por vencer', subtitle: `${seriesVencen.length} series · próximos 30 días`, sections: seccionesSeries, emptyMessage: 'No hay series por vencer.', footActions: [{ label: 'Ver agenda', href: '/agenda' }] },
  }
  const activo = drilldown ? DRILLDOWN[drilldown] : null

  // ---------- chart ----------
  const monedasChart = useMemo(() => {
    const set = new Set<string>()
    for (const m of serieMensual) for (const mon of Object.keys(m.montos)) set.add(mon)
    return Array.from(set)
  }, [serieMensual])
  const mesActualKey = periodo.hasta.slice(0, 7)

  const [tabla, setTabla] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; full: string; cobrado: number; porCobrar: number; moneda: string } | null>(null)

  function mostrarTip(e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>, full: string, cobrado: number, porCobrar: number, moneda: string) {
    const contRect = chartRef.current?.getBoundingClientRect()
    const br = e.currentTarget.getBoundingClientRect()
    if (!contRect) return
    setTip({ x: br.left - contRect.left + br.width / 2, y: br.top - contRect.top, full, cobrado, porCobrar, moneda })
  }

  // ---------- atención ----------
  const alertaCount = seriesVencen.length + pacientesSinVenir.length + (veCobros ? (deuda.totalCount > 0 ? 1 : 0) + (osSinLiquidar.totalCount > 0 ? 1 : 0) : 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="db">
        <header className="db-hdr">
          <div>
            <h1 className="db-h1" suppressHydrationWarning>{greeting ? `${greeting}, ${nombreTerapeuta}` : `Hola, ${nombreTerapeuta}`} 👋</h1>
            <p className="db-sub">{fechaHoy}</p>
          </div>
          <div className="db-ctrls">
            <span className="db-reload" aria-live="polite">{isPending && <><span className="db-spin" />Actualizando…</>}</span>

            <div style={{ position: 'relative' }}>
              <button className="db-pick" onClick={() => setPop(pop === 'per' ? null : 'per')} aria-haspopup="true" aria-expanded={pop === 'per'}>
                <DbIcon name="cal" /><b>{presetsInfo.find((p) => p.key === periodo.preset)?.label ?? 'Personalizado'}</b>
                <span className="db-rg">{rangoLabel(periodo.desde, periodo.hasta)}</span>
                <DbIcon name="chevD" className="db-chev" />
              </button>
              {pop === 'per' && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => { setPop(null); setCustomOpen(false) }} />
                  <div className="db-pop" role="menu">
                    {presetsInfo.map((p) => (
                      <button key={p.key} className="db-opt" role="menuitemradio" aria-checked={periodo.preset === p.key} onClick={() => navegar({ p: p.key, cmp: periodo.cmpTipo })}>
                        <DbIcon name="check" className="db-ck" />{p.label}<span className="db-rg">{rangoLabel(p.desde, p.hasta)}</span>
                      </button>
                    ))}
                    <div className="db-pop-sep" />
                    <button className="db-opt" role="menuitemradio" aria-checked={periodo.preset === 'custom'} onClick={() => setCustomOpen(true)}>
                      <DbIcon name="check" className="db-ck" />Personalizado…
                    </button>
                    {customOpen && (
                      <div className="db-custom">
                        <label>Desde<input className="db-af" type="date" value={customDesde} onChange={(e) => setCustomDesde(e.target.value)} /></label>
                        <label>Hasta<input className="db-af" type="date" value={customHasta} onChange={(e) => setCustomHasta(e.target.value)} /></label>
                        <button type="button" className="btn primary" onClick={() => navegar({ p: 'custom', cmp: periodo.cmpTipo, desde: customDesde, hasta: customHasta })}>Aplicar</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button className="db-pick" onClick={() => setPop(pop === 'cmp' ? null : 'cmp')} aria-haspopup="true" aria-expanded={pop === 'cmp'}>
                <DbIcon name="cmp" /><span className="db-rg" style={{ color: 'var(--muted)' }}>Comparar con</span><b>{periodo.cmpLabel}</b>
                <DbIcon name="chevD" className="db-chev" />
              </button>
              {pop === 'cmp' && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setPop(null)} />
                  <div className="db-pop" role="menu">
                    <button className="db-opt" role="menuitemradio" aria-checked={periodo.cmpTipo === 'prev'} onClick={() => navegar({ p: periodo.preset, cmp: 'prev', desde: periodo.desde, hasta: periodo.hasta })}>
                      <DbIcon name="check" className="db-ck" />Período anterior
                    </button>
                    <button className="db-opt" role="menuitemradio" aria-checked={periodo.cmpTipo === 'yoy'} onClick={() => navegar({ p: periodo.preset, cmp: 'yoy', desde: periodo.desde, hasta: periodo.hasta })}>
                      <DbIcon name="check" className="db-ck" />Mismo período del año anterior
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section className={`db-kpis ${veCobros ? '' : 'n2'}`} aria-label="Indicadores del período">
          <button className="db-kpi" onClick={() => setDrilldown('sesiones')}>
            <span className="db-k-lbl">Sesiones<DbIcon name="chevR" /></span>
            <span className="db-k-val">{actual ? actual.sesiones.realizadas + actual.sesiones.pendientes : 0}</span>
            <span className="db-k-sub"><b>{actual?.sesiones.realizadas ?? 0}</b> realizadas · <b>{actual?.sesiones.pendientes ?? 0}</b> pendientes</span>
            <div className="db-k-foot">
              <DeltaBadge d={calcDelta(actual?.sesiones.realizadas ?? 0, comparado?.sesiones.realizadas, true)} />
              <Sparkline data={spark.map((s) => s.realizadas)} />
            </div>
          </button>

          {veCobros && (
            <>
              <button className="db-kpi" onClick={() => setDrilldown('cobrado')}>
                <span className="db-k-lbl">Cobrado<DbIcon name="chevR" /></span>
                <span className="db-k-val">{money(arsActual?.cobrado ?? 0)}</span>
                {actual?.montos && Object.entries(actual.montos).filter(([m]) => m !== 'ARS').map(([m, v]) => (
                  <span key={m} className="db-k-val2">{money(v.cobrado, m)}</span>
                ))}
                <span className="db-k-bar" role="img" aria-label="porcentaje cobrado">
                  <i style={{ width: `${arsActual && arsActual.valor ? Math.round((arsActual.cobrado / arsActual.valor) * 100) : 0}%` }} />
                </span>
                <span className="db-k-sub"><b>{arsActual && arsActual.valor ? Math.round((arsActual.cobrado / arsActual.valor) * 100) : 0}%</b> de {money(arsActual?.valor ?? 0)} en sesiones realizadas</span>
                <div className="db-k-foot">
                  <DeltaBadge d={calcDelta(arsActual?.cobrado ?? 0, arsComparado?.cobrado, true, true)} />
                  <Sparkline data={spark.map((s) => s.cobrado?.ARS ?? 0)} />
                </div>
              </button>

              <button className="db-kpi" onClick={() => setDrilldown('porcobrar')}>
                <span className="db-k-lbl">Por cobrar<DbIcon name="chevR" /></span>
                <span className="db-k-val">{money(arsActual?.por_cobrar ?? 0)}</span>
                {actual?.montos && Object.entries(actual.montos).filter(([m]) => m !== 'ARS' && v_pc(actual.montos![m])).map(([m, v]) => (
                  <span key={m} className="db-k-val2">{money(v.por_cobrar, m)}</span>
                ))}
                <span className="db-k-sub">Pacientes <b>{money(arsActual?.por_cobrar_particular ?? 0)}</b> · Obras sociales <b>{money(arsActual?.por_cobrar_os ?? 0)}</b></span>
                <div className="db-k-foot">
                  <DeltaBadge d={calcDelta(arsActual?.por_cobrar ?? 0, arsComparado?.por_cobrar, false, true)} />
                  <Sparkline data={spark.map((s) => s.por_cobrar?.ARS ?? 0)} />
                </div>
              </button>
            </>
          )}

          <button className="db-kpi" onClick={() => setDrilldown('atendidos')}>
            <span className="db-k-lbl">Pacientes atendidos<DbIcon name="chevR" /></span>
            <span className="db-k-val">{actual?.atendidos ?? 0}</span>
            <span className="db-k-sub"><b>+{actual?.nuevos ?? 0}</b> nuevos en el período</span>
            <div className="db-k-foot">
              <DeltaBadge d={calcDelta(actual?.atendidos ?? 0, comparado?.atendidos, true)} />
              <Sparkline data={spark.map((s) => s.atendidos)} />
            </div>
          </button>
        </section>

        {esEsencial && (
          <div className="db-ess">
            <DbIcon name="lock" />
            <span>Cobrado, Por cobrar e Ingresos están disponibles con el módulo Cobros.</span>
            <Link href="/planes" style={{ marginLeft: 'auto' }}>Ver planes</Link>
          </div>
        )}

        <div className={`db-main-grid ${veCobros ? 'has-chart' : ''}`}>
          {/* Hoy */}
          <div className="db-card db-area-hoy" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="db-card-h">
              <h2 className="db-card-t">Hoy</h2>
              <span className="db-card-m">{format(parseISO(hoyArgStr), "EEEE d 'de' MMMM", { locale: es })}</span>
              <span className="db-r"><Link href="/agenda" className="db-lnk">Ver agenda <DbIcon name="arrowR" /></Link></span>
            </div>

            {hoy.turnos.length === 0 && hoy.entrevistas.length === 0 && (
              <div className="db-empty"><b>No tenés turnos hoy</b>Cuando tengas turnos agendados, vas a ver tu día acá.</div>
            )}

            {(hoy.turnos.length > 0 || hoy.entrevistas.length > 0) && (
              <ol className="db-ag">
                {hoy.turnos.map((t) => {
                  const st = estadoInfo(t.estado)
                  return (
                    <li key={t.id} className={t.id === proximoTurnoId ? 'is-next' : ''}>
                      <span className="db-tm">{horaDesde(t.fecha_hora)}</span>
                      <span className="db-nm">{t.paciente ? <Link href={`/pacientes/${t.pacienteId}`} className="db-nm-lnk">{`${t.paciente.apellido}, ${t.paciente.nombre}`}</Link> : '—'}</span>
                      <span className={`db-st ${t.estado}`}><DbIcon name={st.icon} />{st.label}</span>
                    </li>
                  )
                })}
                {hoy.entrevistas.map((e) => (
                  <li key={e.id}>
                    <span className="db-tm">{e.hora.slice(0, 5)}</span>
                    <span className="db-nm">{e.apellido}, {e.nombre}<span className="db-tag ent">Entrevista</span></span>
                    <span className="db-st pendiente"><DbIcon name="clock" />Pendiente</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Chart */}
          {veCobros && (
            <div className="db-card db-area-chart" ref={chartRef} style={{ position: 'relative' }}>
              <div className="db-card-h">
                <h2 className="db-card-t">Ingresos</h2>
                <span className="db-card-m">Cobrado + Por cobrar, por mes</span>
                <span className="db-r">
                  <button className="btn" onClick={() => setTabla((v) => !v)}>
                    <DbIcon name={tabla ? 'chart' : 'table'} />{tabla ? 'Ver como gráfico' : 'Ver como tabla'}
                  </button>
                </span>
              </div>

              {!tabla && (
                <div className="db-ch-legend">
                  <span><i className="db-sw c" />Cobrado</span>
                  <span><i className="db-sw pc" />Por cobrar</span>
                  <span><i className="db-sw sel" />Mes actual</span>
                </div>
              )}

              {monedasChart.map((moneda) => {
                const bars = serieMensual.map((m) => ({
                  mesKey: m.mes.slice(0, 7),
                  full: capitalizar(format(parseISO(m.mes), 'MMMM yyyy', { locale: es })),
                  label: format(parseISO(m.mes), 'MMM', { locale: es }),
                  cobrado: m.montos[moneda]?.cobrado ?? 0,
                  porCobrar: m.montos[moneda]?.por_cobrar ?? 0,
                }))
                if (!bars.some((b) => b.cobrado + b.porCobrar > 0)) return null
                const mx = niceMax(Math.max(1, ...bars.map((b) => b.cobrado + b.porCobrar)) * 1.05)

                if (tabla) {
                  return (
                    <div key={moneda} className="db-ch">
                      <div className="db-ch-h"><b>{moneda === 'ARS' ? 'Pesos' : moneda}</b></div>
                      <div className="db-tbl-wrap">
                        <table className="db-tbl">
                          <thead><tr><th>Mes</th><th className="db-n">Cobrado</th><th className="db-n">Por cobrar</th><th className="db-n">Total</th></tr></thead>
                          <tbody>
                            {bars.map((b) => (
                              <tr key={b.mesKey}><td>{b.full}</td><td className="db-n">{money(b.cobrado, moneda)}</td><td className="db-n">{money(b.porCobrar, moneda)}</td><td className="db-n">{money(b.cobrado + b.porCobrar, moneda)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={moneda} className="db-ch">
                    <div className="db-ch-h"><b>{moneda === 'ARS' ? 'Pesos' : moneda === 'USD' ? 'Dólares' : moneda}</b><span>por mes</span></div>
                    <div className="db-ch-plot">
                      <div className="db-ch-grid">
                        {[0, .25, .5, .75, 1].map((f) => (
                          <div key={f} className={f === 0 ? 'z' : ''} style={{ bottom: `${f * 100}%` }}><span>{axisLabel(mx * f, moneda)}</span></div>
                        ))}
                      </div>
                      <div className="db-ch-bars">
                        {bars.map((b) => {
                          const sel = b.mesKey === mesActualKey
                          const total = b.cobrado + b.porCobrar
                          if (total === 0) return <div key={b.mesKey} className="db-ch-col"><span className={`db-bar zero ${sel ? 'sel' : ''}`} /></div>
                          const hp = (total / mx) * 100, cp = (b.cobrado / total) * 100
                          return (
                            <div key={b.mesKey} className="db-ch-col">
                              <button type="button" className={`db-bar ${sel ? 'sel' : ''}`} style={{ height: `${hp}%` }}
                                onMouseEnter={(e) => mostrarTip(e, b.full, b.cobrado, b.porCobrar, moneda)}
                                onFocus={(e) => mostrarTip(e, b.full, b.cobrado, b.porCobrar, moneda)}
                                onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
                                aria-label={`${b.full}: cobrado ${money(b.cobrado, moneda)}, por cobrar ${money(b.porCobrar, moneda)}`}
                              >
                                {b.porCobrar > 0 && <span className="db-pc" style={{ height: `${100 - cp}%` }} />}
                                <span className="db-c" style={{ height: `${cp}%` }} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="db-ch-x">
                      {bars.map((b) => <div key={b.mesKey} className={b.mesKey === mesActualKey ? 'sel' : ''}>{b.label}</div>)}
                    </div>
                  </div>
                )
              })}

              {tip && (
                <div className="db-ch-tip" style={{ left: Math.max(8, tip.x - 90), top: Math.max(8, tip.y - 90) }}>
                  <b>{tip.full}</b>
                  <div className="db-r"><span>Cobrado</span><span>{money(tip.cobrado, tip.moneda)}</span></div>
                  <div className="db-r"><span>Por cobrar</span><span>{money(tip.porCobrar, tip.moneda)}</span></div>
                </div>
              )}
            </div>
          )}

          {/* Requiere tu atención */}
          <section className="db-area-att" aria-labelledby="db-att-h">
            <div className="db-att-h"><h2 id="db-att-h">Requiere tu atención</h2><span>Estado actual · no depende del período</span></div>
            <div className="db-att">
              {veCobros && deuda.totalCount > 0 && (
                <article className="db-att-c">
                  <div className="db-att-ch">
                    <span className="db-att-ic danger"><DbIcon name="wallet" /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="db-att-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Deuda total de pacientes<span className="db-cnt">{deuda.totalCount}</span></span>
                      <span className="db-att-d">Particulares · {Object.entries(deuda.porMoneda).map(([m, v]) => money(v.total, m)).join(' · ')}</span>
                    </span>
                  </div>
                  <ul className="db-att-l">
                    {deuda.top.slice(0, 3).map((d) => (
                      <li key={`${d.pacienteId}-${d.moneda}`}>
                        <span className={`db-av a${avatarVariant(d.nombre + d.apellido)}`} aria-hidden="true">{iniciales(d.nombre, d.apellido)}</span>
                        <span style={{ minWidth: 0 }}><span className="db-nm" style={{ display: 'block' }}><Link href={`/pacientes/${d.pacienteId}`} className="db-nm-lnk">{d.nombre} {d.apellido}</Link></span><span className="db-sc">{d.n} sesión{d.n !== 1 ? 'es' : ''} · desde {fechaCorta(d.masAntigua)}</span></span>
                        <span className="db-kv danger">{money(d.saldo, d.moneda)}</span>
                        <span className="db-acts"><Link href={`/pacientes/${d.pacienteId}`} className="db-ib" title="Abrir ficha"><DbIcon name="file" /></Link></span>
                      </li>
                    ))}
                  </ul>
                  <div className="db-att-f"><button className="db-lnk" onClick={() => setDrilldown('deuda')}>Ver los {deuda.totalCount} <DbIcon name="chevR" /></button></div>
                </article>
              )}

              {veCobros && osSinLiquidar.totalCount > 0 && (
                <article className="db-att-c">
                  <div className="db-att-ch">
                    <span className="db-att-ic acc"><DbIcon name="shield" /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="db-att-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Obras sociales sin liquidar<span className="db-cnt">{osSinLiquidar.totalCount}</span></span>
                      <span className="db-att-d">{Object.entries(osSinLiquidar.porMoneda).map(([m, v]) => money(v, m)).join(' · ')}</span>
                    </span>
                  </div>
                  <ul className="db-att-l">
                    {osSinLiquidar.meses[0]?.filas.slice(0, 3).map((f, i) => (
                      <li key={i}>
                        <span className="db-av os" aria-hidden="true">{f.osNombre.slice(0, 2).toUpperCase()}</span>
                        <span style={{ minWidth: 0 }}><span className="db-nm" style={{ display: 'block' }}>{f.osNombre}</span><span className="db-sc">{f.n} sesión{f.n !== 1 ? 'es' : ''} · {capitalizar(format(parseISO(`${osSinLiquidar.meses[0].mesKey}-01`), 'MMMM', { locale: es }))}</span></span>
                        <span className="db-kv">{money(f.monto, f.moneda)}</span>
                        <span />
                      </li>
                    ))}
                  </ul>
                  <div className="db-att-f">
                    <button className="db-lnk" onClick={() => setDrilldown('os')}>Ver los {osSinLiquidar.totalCount} <DbIcon name="chevR" /></button>
                    <span className="db-r"><Link href="/facturacion/liquidacion" className="btn primary">Ir a liquidación <DbIcon name="arrowR" /></Link></span>
                  </div>
                </article>
              )}

              {seriesVencen.length > 0 && (
                <article className="db-att-c">
                  <div className="db-att-ch">
                    <span className="db-att-ic"><DbIcon name="repeat" /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="db-att-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Series recurrentes por vencer<span className="db-cnt">{seriesVencen.length}</span></span>
                      <span className="db-att-d">Próximos 30 días</span>
                    </span>
                  </div>
                  <ul className="db-att-l">
                    {[...seriesVencen].sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin)).slice(0, 3).map((s) => (
                      <li key={s.id}>
                        <span className={`db-av a${s.paciente ? avatarVariant(s.paciente.nombre + s.paciente.apellido) : 1}`} aria-hidden="true">{s.paciente ? iniciales(s.paciente.nombre, s.paciente.apellido) : '—'}</span>
                        <span style={{ minWidth: 0 }}><span className="db-nm" style={{ display: 'block' }}>{s.paciente ? <Link href={`/pacientes/${s.pacienteId}`} className="db-nm-lnk">{`${s.paciente.nombre} ${s.paciente.apellido}`}</Link> : '—'}</span></span>
                        <span className="db-kv">{fechaCorta(s.fecha_fin)}</span>
                        <span />
                      </li>
                    ))}
                  </ul>
                  <div className="db-att-f"><button className="db-lnk" onClick={() => setDrilldown('series')}>Ver las {seriesVencen.length} <DbIcon name="chevR" /></button></div>
                </article>
              )}

              {pacientesSinVenir.length > 0 && (
                <article className="db-att-c">
                  <div className="db-att-ch">
                    <span className="db-att-ic warn"><DbIcon name="users" /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="db-att-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Sin venir hace 2+ semanas<span className="db-cnt">{pacientesSinVenir.length}</span></span>
                      <span className="db-att-d">Más días primero</span>
                    </span>
                  </div>
                  <ul className="db-att-l">
                    {[...pacientesSinVenir].sort((a, b) => diasDesde(b.ultimaCita ?? hoyArgStr) - diasDesde(a.ultimaCita ?? hoyArgStr)).slice(0, 3).map((p) => (
                      <li key={p.id}>
                        <span className={`db-av a${avatarVariant(p.nombre + p.apellido)}`} aria-hidden="true">{iniciales(p.nombre, p.apellido)}</span>
                        <span style={{ minWidth: 0 }}><span className="db-nm" style={{ display: 'block' }}><Link href={`/pacientes/${p.id}`} className="db-nm-lnk">{p.nombre} {p.apellido}</Link></span><span className="db-sc">{p.ultimaCita ? `Última: ${fechaCorta(p.ultimaCita)}` : 'Sin sesión'}</span></span>
                        <span className="db-kv">{p.ultimaCita ? `${diasDesde(p.ultimaCita)} días` : '—'}</span>
                        <span className="db-acts"><WaButton telefono={p.telefono} /><Link href={`/pacientes/${p.id}`} className="db-ib" title="Abrir ficha"><DbIcon name="file" /></Link></span>
                      </li>
                    ))}
                  </ul>
                  <div className="db-att-f"><button className="db-lnk" onClick={() => setDrilldown('sinvenir')}>Ver los {pacientesSinVenir.length} <DbIcon name="chevR" /></button></div>
                </article>
              )}

              {alertaCount === 0 && (
                <div className="db-att-c ok" style={{ gridColumn: '1/-1' }}>
                  <span className="db-att-ic"><DbIcon name="checkC" /></span>
                  <span>Todo en orden — no hay nada pendiente ahora mismo.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {activo && (
        <DashboardDrilldownSlide
          open={drilldown !== null}
          onClose={() => setDrilldown(null)}
          title={activo.title}
          subtitle={activo.subtitle}
          sections={activo.sections}
          emptyMessage={activo.emptyMessage}
          footActions={activo.footActions}
          filtro={activo.filtro ? {
            value: filtroSesiones,
            onChange: (v) => setFiltroSesiones(v as 'all' | 'real' | 'pend'),
            options: [
              { key: 'all', label: 'Todas', count: periodoTurnos.length },
              { key: 'real', label: 'Realizadas', count: turnosRealizados.length },
              { key: 'pend', label: 'Pendientes', count: turnosPendientes.length },
            ],
          } : undefined}
        />
      )}
    </div>
  )
}

function v_pc(m: { por_cobrar: number }): boolean {
  return m.por_cobrar > 0
}
