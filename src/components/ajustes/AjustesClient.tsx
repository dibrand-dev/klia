'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FirmaUploader from '@/components/ui/FirmaUploader'
import MontoInput from '@/components/ui/MontoInput'
import SlideOver from '@/components/ui/SlideOver'
import ObraSocialesConfig from '@/components/ajustes/ObraSocialesConfig'
import ColaboradorasConfig from '@/components/ajustes/ColaboradorasConfig'
import SuscripcionPortal from '@/components/ajustes/SuscripcionPortal'
import IntegracionesClient from '@/components/ajustes/IntegracionesClient'
import SedesHorariosSection from '@/components/ajustes/sedes/SedesHorariosSection'
import RedesSocialesField, { type RedesSociales } from '@/components/ajustes/RedesSocialesField'
import TiposTurnoSection from '@/components/tipos-turno/TiposTurnoSection'
import MatriculasSection from '@/components/ajustes/MatriculasSection'
import { contarTiposDisponibles } from '@/lib/booking/contar-tipos-disponibles'
import { ESPECIALIDADES } from '@/lib/especialidades'
import { PAISES, PAISES_PROVINCIAS } from '@/lib/geografica'
import { normalizarCuit, validarCuit, formatearCuit } from '@/lib/facturacion/cuit'
import { CONDICIONES_IVA } from '@/lib/facturacion/constantes'
import type { Profile, ProfesionalObraSocial, TipoTurno, Database } from '@/types/database'
import type { TipoTurnoConSedes, SedeTipoTurno } from '@/components/tipos-turno/TiposTurnoSection'

type ProfesionalMatricula = Database['public']['Tables']['profesional_matriculas']['Row']

type Suscripcion = {
  estado: string
  plan: string
  modalidad: 'mensual' | 'anual'
  suscripcion_fin: string | null
  mp_preapproval_id: string | null
  monto: number
} | null

interface Props {
  profile: Profile
  obrasSociales: ProfesionalObraSocial[]
  suscripcion: Suscripcion
  googleConectado: boolean
  googleSyncEnabled: boolean
  mpConectado: boolean
  mpEmail: string | null
  mpNombre: string | null
  cobrosVentanaHoras: number
  cobrosCancelacionHoras: number
  cobrosPrecioSesion: number | null
  cobrosMoneda: string
  cobrosMessagePaciente: string
  esColaborador?: boolean
  tiposTurnoHabilitado: boolean
  tiposTurno: TipoTurnoConSedes[]
  sedes: SedeTipoTurno[]
  matriculas: ProfesionalMatricula[]
}

// ── Design helpers ────────────────────────────────────────────────────
const secStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '24px 26px',
  scrollMarginTop: 80,
}
const secHdrStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 14,
  marginBottom: 22, paddingBottom: 18,
  borderBottom: '1px solid var(--border)',
}
const icnStyle = (bg: string, color: string): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 10,
  background: bg, color,
  display: 'grid', placeItems: 'center', flexShrink: 0,
})
const secFootStyle: React.CSSProperties = {
  marginTop: 22, paddingTop: 18,
  borderTop: '1px solid var(--border)',
  display: 'flex', gap: 10, alignItems: 'center',
}
const fieldStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted-2)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}
const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 12px', height: 38,
  font: 'inherit', fontSize: 14, color: 'var(--ink)',
  background: 'var(--surface)', outline: 'none',
  width: '100%',
  transition: 'border-color .12s ease, box-shadow .12s ease',
}
const textareaStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '10px 12px',
  font: 'inherit', fontSize: 14, color: 'var(--ink)',
  background: 'var(--surface)', outline: 'none',
  width: '100%', minHeight: 80, resize: 'vertical', lineHeight: 1.55,
  transition: 'border-color .12s ease, box-shadow .12s ease',
}
const grid2Class = 'grid grid-cols-1 sm:grid-cols-2 gap-4'
const hintStyle: React.CSSProperties = {
  fontSize: 11.5, color: 'var(--muted-2)',
}
const pasoReqTagStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: 'var(--muted-2)',
  border: '1px solid var(--border)', borderRadius: 100,
  padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

// KL1-T39 — mismos planes en los que está disponible el aviso de deuda,
// consultados también server-side en el cron (/api/cron/aviso-deuda).
const PLANES_AVISO_DEUDA = ['profesional', 'premium', 'bonificado']
const OPCIONES_AVISO_DEUDA: { value: string; label: string }[] = [
  { value: 'nunca', label: 'Nunca' },
  { value: '24h', label: '24 horas después de la sesión' },
  { value: '48h', label: '48 horas después' },
  { value: '72h', label: '72 horas después' },
  { value: '7dias', label: 'A los 7 días' },
  { value: 'fin_mes', label: 'A fin de mes' },
]

// ── Section icons ──────────────────────────────────────────────────────
const icnSvg = (d: string | React.ReactNode) => (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
    {d}
  </svg>
)
const ICONS: Record<string, React.ReactNode> = {
  perfil:          icnSvg(<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>),
  horarios:        icnSvg(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  cobros:          icnSvg(<><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></>),
  'cobros-pagos':  icnSvg(<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></>),
  transferencia:   icnSvg(<><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="7" y1="14" x2="13" y2="14"/></>),
  politica:        icnSvg(<><path d="M3 10h18M5 6h14l1 14H4L5 6z"/><path d="M9 6V4a3 3 0 0 1 6 0v2"/></>),
  'aviso-deuda':   icnSvg(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  feriados:        icnSvg(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9.5" y1="14.5" x2="14.5" y2="19.5"/><line x1="14.5" y1="14.5" x2="9.5" y2="19.5"/></>),
  obras:           icnSvg(<path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"/>),
  integraciones:   icnSvg(<><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M8 5h8M8 19h8M5 8v8M19 8v8"/></>),
  firmas:          icnSvg(<path d="M12 20h9M16 3l5 5-11 11H5v-5z"/>),
  'link-publico':  icnSvg(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>),
  plan:            icnSvg(<path d="M12 2l3 7 7 .5-5.5 4.5L18 21l-6-4-6 4 1.5-7L2 9.5 9 9z"/>),
  cuenta:          icnSvg(<><path d="M12 1l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V5l8-4z"/><path d="M9 12l2 2 4-4"/></>),
  colaboradoras:   icnSvg(<><circle cx="9" cy="8" r="3"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M17 8a3 3 0 1 0 0-6"/><path d="M22 20a6 6 0 0 0-5-6"/></>),
  recetas:         icnSvg(<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></>),
  'tipos-turno':   icnSvg(<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h4M8 17h7"/></>),
  recordatorios:   icnSvg(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
}

// ── Toggle switch ──────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={on}
      style={{
        position: 'relative', width: 38, height: 22, flexShrink: 0,
        background: on ? 'var(--ink)' : 'var(--border-strong)',
        borderRadius: 100, cursor: disabled ? 'default' : 'pointer',
        border: 'none', transition: 'background .15s ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: on ? 18 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white',
        transition: 'left .15s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        display: 'block',
      }} />
    </button>
  )
}

// ── Toggle row ─────────────────────────────────────────────────────────
function ToggleRow({ name, desc, on, onChange, disabled }: {
  name: string
  desc: React.ReactNode
  on: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// ── Accordion — misma tarjeta/bordes que el resto de la app, con resumen
// en el header (Ajustes v3, Fase 1: orden y estética únicamente). ───────
function Accordion({ title, desc, right, defaultOpen = false, forceOpen, id, children }: {
  title: string
  desc?: string
  right?: React.ReactNode
  defaultOpen?: boolean
  // Fuerza la apertura (p.ej. al llegar desde una tarea del Resumen que
  // apunta a este acordeón puntual) sin romper el toggle manual normal:
  // el usuario sigue pudiendo cerrarlo después con el click de siempre.
  forceOpen?: boolean
  id?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
  return (
    <div id={id} style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: 14, overflow: 'hidden', background: 'var(--surface)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
          {desc && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>}
        </div>
        {right}
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'var(--muted-2)', strokeWidth: 2, fill: 'none', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '16px 18px 20px', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Chip de estado para el hub "Resumen" ────────────────────────────────
function Chip({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'muted' }) {
  const colors = {
    ok: { bg: 'var(--ok-soft)', fg: 'var(--ok)' },
    warn: { bg: 'var(--amber-soft)', fg: 'var(--amber-ink)' },
    muted: { bg: 'var(--surface-2)', fg: 'var(--muted)' },
  }[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
      borderRadius: 100, fontSize: 11, fontWeight: 600,
      background: colors.bg, color: colors.fg, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

// ── HORAS arrays ──────────────────────────────────────────────────────
const HORAS_INICIO = Array.from({ length: 24 * 4 }, (_, i) => i * 0.25)        // 0:00 → 23:45
const HORAS_FIN    = Array.from({ length: 24 * 4 - 1 }, (_, i) => (i + 1) * 0.25) // 0:15 → 24:00

function formatHora(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

type Franja = { inicio: number; fin: number }
type HorarioDia = { activo: boolean; franjas: Franja[] }
type HorariosPorDia = Record<string, HorarioDia>

function normalizarHorario(raw: Record<string, unknown>): HorariosPorDia {
  const dias = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
  const resultado: HorariosPorDia = {}
  for (const dia of dias) {
    const d = raw[dia] as Record<string, unknown> | undefined
    if (!d) { resultado[dia] = { activo: false, franjas: [{ inicio: 9, fin: 13 }] }; continue }
    if (Array.isArray(d.franjas)) { resultado[dia] = d as unknown as HorarioDia; continue }
    resultado[dia] = {
      activo: (d.activo as boolean) ?? false,
      franjas: [{ inicio: (d.inicio as number) ?? 9, fin: (d.fin as number) ?? 18 }],
    }
  }
  return resultado
}

const DIAS_SEMANA_CONFIG = [
  { key: 'lunes',     label: 'Lunes' },
  { key: 'martes',    label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves',    label: 'Jueves' },
  { key: 'viernes',   label: 'Viernes' },
  { key: 'sabado',    label: 'Sábado' },
  { key: 'domingo',   label: 'Domingo' },
]

// ── Main component ─────────────────────────────────────────────────────
export default function AjustesClient({ profile, obrasSociales, suscripcion, googleConectado, googleSyncEnabled, mpConectado, mpEmail, mpNombre, cobrosVentanaHoras, cobrosCancelacionHoras, cobrosPrecioSesion, cobrosMoneda, cobrosMessagePaciente, esColaborador = false, tiposTurnoHabilitado, tiposTurno, sedes, matriculas }: Props) {
  const mostrarColaboradoras = (profile.plan === 'premium' || profile.plan === 'bonificado') && !esColaborador
  const mostrarAvisoDeuda = PLANES_AVISO_DEUDA.includes(profile.plan ?? '')
  const router = useRouter()
  // null = todavía no se sabe (SedesHorariosSection no terminó de cargar).
  // No se asume false mientras tanto — eso era lo que hacía aparecer el
  // bloque legacy de "Horarios de atención" un instante y después
  // desaparecer de golpe para un profesional con 2+ sedes.
  const [multiSede, setMultiSede] = useState<boolean | null>(null)

  // Perfil state
  const [perfilForm, setPerfilForm] = useState({
    especialidad: profile.especialidad ?? '',
    titulo_credencial_adicional: profile.titulo_credencial_adicional ?? '',
    dni: profile.dni ?? '',
    // matricula / matricula_tipo / matricula_provincia — sacados del estado
    // de este formulario (Fase 3, ajustes-v3): ahora los sincroniza el
    // trigger trg_sync_matricula_principal desde profesional_matriculas. Si
    // quedaran acá, cada guardado de "Datos personales" pisaría ese valor
    // con lo que había al cargar la pantalla.
    telefono: profile.telefono ?? '',
    pais: profile.pais ?? 'Argentina',
    provincia: profile.provincia ?? '',
    localidad: profile.localidad ?? '',
    direccion: profile.direccion ?? '',
    terminologia: (profile.terminologia ?? 'sesion') as 'sesion' | 'consulta',
    antropometria_certificacion: profile.antropometria_certificacion ?? '',
    cuit: normalizarCuit(profile.cuit ?? ''),
    condicion_iva: profile.condicion_iva ?? '',
    razon_social: profile.razon_social ?? '',
  })
  const [antropometriaActiva, setAntropometriaActiva] = useState<boolean>(
    profile.antropometria_activa ?? (profile.especialidad === 'Nutrición')
  )
  const redesRef = useRef<RedesSociales>({
    instagram_url: profile.instagram_url ?? null,
    facebook_url: profile.facebook_url ?? null,
    x_url: profile.x_url ?? null,
    tiktok_url: profile.tiktok_url ?? null,
    linkedin_url: profile.linkedin_url ?? null,
  })
  const [perfilLoading, setPerfilLoading] = useState(false)
  const [perfilSaved, setPerfilSaved] = useState(false)
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const [facturacionLoading, setFacturacionLoading] = useState(false)
  const [facturacionSaved, setFacturacionSaved] = useState(false)
  const [facturacionError, setFacturacionError] = useState<string | null>(null)

  // Recetas state
  const [recetasForm, setRecetasForm] = useState({
    sexo: profile.sexo ?? '',
    fecha_nacimiento: profile.fecha_nacimiento_profesional ?? '',
    domicilio_consultorio: profile.domicilio_consultorio ?? '',
    localidad_consultorio: profile.localidad_consultorio ?? '',
    provincia_consultorio: profile.provincia_consultorio ?? '',
  })
  const [recetasLoading, setRecetasLoading] = useState(false)
  const [recetasSaved, setRecetasSaved] = useState(false)
  const [recetasError, setRecetasError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Horarios state
  const [horariosPorDia, setHorariosPorDia] = useState<HorariosPorDia>(() => {
    if (profile.horarios_por_dia)
      return normalizarHorario(profile.horarios_por_dia as Record<string, unknown>)
    const ini = profile.agenda_hora_inicio ?? 9
    const fin = profile.agenda_hora_fin ?? 18
    return normalizarHorario({
      lunes:     { activo: true,  inicio: ini, fin },
      martes:    { activo: true,  inicio: ini, fin },
      miercoles: { activo: true,  inicio: ini, fin },
      jueves:    { activo: true,  inicio: ini, fin },
      viernes:   { activo: true,  inicio: ini, fin },
      sabado:    { activo: false, inicio: 9,   fin: 13 },
      domingo:   { activo: false, inicio: 9,   fin: 13 },
    })
  })
  const [horarioLoading, setHorarioLoading] = useState(false)
  const [horarioSaved, setHorarioSaved] = useState(false)

  // Aviso de deuda state
  const [avisoDeudaTiming, setAvisoDeudaTiming] = useState<string>(
    (profile as Record<string, unknown>).aviso_deuda_timing as string ?? 'nunca'
  )
  const [avisoDeudaLoading, setAvisoDeudaLoading] = useState(false)
  const [avisoDeudaSaved, setAvisoDeudaSaved] = useState(false)

  // Recordatorio de turno al paciente state
  const [recordatorioTurnoActivo, setRecordatorioTurnoActivo] = useState<boolean>(
    (profile as Record<string, unknown>).recordatorio_turno_activo as boolean ?? true
  )
  const [recordatorioTurnoLoading, setRecordatorioTurnoLoading] = useState(false)

  // Política de cobros state
  const [cobrar, setCobrar] = useState(profile.cobrar_inasistencias ?? false)
  const [cobrarGuardando, setCobrarGuardando] = useState(false)

  // Feriados state
  const [feriadosNacionales, setFeriadosNacionales] = useState(profile.feriados_nacionales ?? false)
  const [feriadosProvinciales, setFeriadosProvinciales] = useState(profile.feriados_provinciales ?? false)
  const [feriadosTrabajaSiConfirmado, setFeriadosTrabajaSiConfirmado] = useState(profile.feriados_trabajar_si_confirmado ?? false)

  // Firmas state
  const [firmaUrl, setFirmaUrl] = useState<string | null>(profile.firma_url ?? null)
  const [firmaSelloUrl, setFirmaSelloUrl] = useState<string | null>(profile.firma_sello_url ?? null)

  // Eliminar cuenta (baja lógica) state
  const [eliminarOpen, setEliminarOpen] = useState(false)
  const [eliminarEmailInput, setEliminarEmailInput] = useState('')
  const [eliminarLoading, setEliminarLoading] = useState(false)
  const [eliminarError, setEliminarError] = useState<string | null>(null)

  // Cobros y pagos state
  const [cobrosVentana, setCobrosVentana] = useState(cobrosVentanaHoras)
  const [cobrosCancelacion, setCobrosCancelacion] = useState(cobrosCancelacionHoras)
  // cobrosPrecioSesion/cobrosMoneda (props) ya no tienen campo en la UI — KL
  // item 7: único consumidor era esta pantalla, se saca el bloque "Precio de
  // sesión — link público" sin tocar las columnas ni la firma de props.
  const [cobrosMensaje, setCobrosMensaje] = useState(cobrosMessagePaciente)
  const [cobrosLoading, setCobrosLoading] = useState(false)
  const [cobrosSaved, setCobrosSaved] = useState(false)
  const [transferenciaBanco, setTransferenciaBanco] = useState(profile.transferencia_banco ?? '')
  const [transferenciaAlias, setTransferenciaAlias] = useState(profile.transferencia_alias ?? '')
  const [transferenciaTitular, setTransferenciaTitular] = useState(profile.transferencia_titular ?? '')
  const [transferenciaLoading, setTransferenciaLoading] = useState(false)
  const [transferenciaSaved, setTransferenciaSaved] = useState(false)

  // Link público state
  const p = profile as unknown as Record<string, unknown>
  const [bookingActivo, setBookingActivo] = useState<boolean>(!!(p.booking_activo))
  const [bookingBio, setBookingBio] = useState<string>((p.booking_bio as string | null) ?? '')
  const [bookingDuracionSesion, setBookingDuracionSesion] = useState<number>((p.booking_duracion_sesion as number | null) ?? 50)
  const [bookingDuracionEntrevista, setBookingDuracionEntrevista] = useState<number>((p.booking_duracion_entrevista as number | null) ?? 30)
  const [bookingTiempoEntre, setBookingTiempoEntre] = useState<number>((p.booking_tiempo_entre as number | null) ?? 10)
  const [bookingAnticipacion, setBookingAnticipacion] = useState<number>((p.booking_anticipacion_minutos as number | null) ?? 60)
  const [bookingModalidades, setBookingModalidades] = useState<string[]>((p.booking_modalidades as string[] | null) ?? ['presencial'])
  const [bookingPrecioSesion, setBookingPrecioSesion] = useState<string>(p.booking_precio_sesion != null ? String(p.booking_precio_sesion) : '')
  const [bookingPrecioEntrevista, setBookingPrecioEntrevista] = useState<string>(p.booking_precio_entrevista != null ? String(p.booking_precio_entrevista) : '')
  const [bookingSesionVisible, setBookingSesionVisible] = useState<boolean>((p.booking_sesion_visible as boolean | null) ?? true)
  const [bookingEntrevistaVisible, setBookingEntrevistaVisible] = useState<boolean>((p.booking_entrevista_visible as boolean | null) ?? true)
  const [bookingVisibilidadError, setBookingVisibilidadError] = useState<string | null>(null)
  const [bookingRequierePago, setBookingRequierePago] = useState<boolean>((p.booking_requiere_pago as boolean | null) ?? true)
  const [bookingRequiereDni, setBookingRequiereDni] = useState<boolean>((p.booking_requiere_dni as boolean | null) ?? false)
  const [bookingRequiereFechaNacimiento, setBookingRequiereFechaNacimiento] = useState<boolean>((p.booking_requiere_fecha_nacimiento as boolean | null) ?? false)
  const [bookingSlug] = useState<string>((p.booking_slug as string | null) ?? '')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingSaved, setBookingSaved] = useState(false)
  const [bookingCopied, setBookingCopied] = useState(false)


  // ── Avatar handlers ────────────────────────────────────────────────
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setPerfilError('La imagen no puede superar 2MB'); return }
    setUploading(true); setPerfilError(null)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${profile.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setPerfilError('Error al subir la imagen.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
    setAvatarUrl(publicUrl); setUploading(false); router.refresh()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDeleteAvatar() {
    if (!avatarUrl) return
    setUploading(true)
    const supabase = createClient()
    const path = avatarUrl.split('/object/public/avatars/')[1]
    if (path) await supabase.storage.from('avatars').remove([path])
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
    setAvatarUrl(null); setUploading(false); router.refresh()
  }

  // ── Datos de facturación save (CUIT, condición IVA, razón social) ──
  // Separado de handlePerfilSave a pedido explícito: estos campos viven ahora
  // en el grupo "Cuenta y plan", lejos de "Perfil y matrícula" — si
  // compartieran el guardado, un cambio sin guardar en Perfil se guardaría
  // sin querer al tocar "Guardar" acá. Misma tabla, mismo cliente, misma
  // validación de CUIT que tenía handlePerfilSave, aislada a estas 3 columnas.
  async function handleFacturacionSave(e: React.FormEvent) {
    e.preventDefault()
    setFacturacionError(null)
    if (perfilForm.cuit && !validarCuit(perfilForm.cuit)) {
      setFacturacionError('El CUIT no es válido.')
      return
    }
    setFacturacionLoading(true); setFacturacionSaved(false)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      cuit: perfilForm.cuit || null,
      condicion_iva: perfilForm.condicion_iva || null,
      razon_social: perfilForm.razon_social.trim().slice(0, 120) || null,
    }).eq('id', profile.id)
    if (error) { setFacturacionError('Error al guardar.'); setFacturacionLoading(false); return }
    setFacturacionSaved(true); setFacturacionLoading(false); router.refresh()
  }

  // ── Guardado del grupo "Perfil y matrícula" (perfil + sexo/fecha) ──
  // El grupo entero (Datos personales, Matrícula, Redes sociales, Módulos de
  // especialidad) comparte un solo botón "Guardar cambios" al pie, igual que
  // hoy la sección "Perfil profesional" tiene un único submit para todos sus
  // campos — no se inventa un guardado independiente por acordeón. Sexo y
  // fecha de nacimiento, reubicados acá desde "Recetas electrónicas", siguen
  // escribiendo exactamente las mismas columnas que handleRecetasSave (sin
  // tocar domicilio del consultorio, que sigue aparte). Si el primer guardado
  // falla, se corta ahí y se muestra solo ese error — nunca un guardado
  // parcial sin avisar, ni dos indicadores de éxito a la vez.
  async function handlePerfilGrupoSave(e: React.FormEvent) {
    e.preventDefault()
    setPerfilError(null)
    setRecetasError(null)
    if (perfilForm.dni) {
      const dniClean = perfilForm.dni.replace(/\D/g, '')
      if (dniClean.length < 7 || dniClean.length > 8) {
        setPerfilError('El DNI debe tener 7 u 8 dígitos.')
        return
      }
    }
    setPerfilLoading(true); setPerfilSaved(false)
    const supabase = createClient()
    const dniClean = perfilForm.dni.replace(/\D/g, '')
    const { error: perfilErr } = await supabase.from('profiles').update({
      dni: dniClean || null,
      especialidad: perfilForm.especialidad || null,
      titulo_credencial_adicional: perfilForm.titulo_credencial_adicional || null,
      // matricula / matricula_tipo / matricula_provincia: ya no se guardan
      // desde este formulario — las sincroniza trg_sync_matricula_principal
      // desde profesional_matriculas (ver migración 024). Guardarlas acá
      // pisaría ese valor sincronizado con lo que había al cargar la
      // pantalla.
      telefono: perfilForm.telefono || null,
      pais: perfilForm.pais || null,
      provincia: perfilForm.provincia || null,
      localidad: perfilForm.localidad || null,
      direccion: perfilForm.direccion || null,
      terminologia: perfilForm.terminologia,
      antropometria_certificacion: perfilForm.antropometria_certificacion.trim().slice(0, 60) || null,
      antropometria_activa: antropometriaActiva,
      ...redesRef.current,
    }).eq('id', profile.id)
    if (perfilErr) { setPerfilError('Error al guardar.'); setPerfilLoading(false); return }
    setPerfilLoading(false)

    setRecetasLoading(true); setRecetasSaved(false)
    const { error: recetasErr } = await supabase.from('profiles').update({
      sexo: recetasForm.sexo || null,
      fecha_nacimiento_profesional: recetasForm.fecha_nacimiento || null,
      domicilio_consultorio: recetasForm.domicilio_consultorio || null,
      localidad_consultorio: recetasForm.localidad_consultorio || null,
      provincia_consultorio: recetasForm.provincia_consultorio || null,
    }).eq('id', profile.id)
    if (recetasErr) { setRecetasError('Error al guardar.'); setRecetasLoading(false); return }
    setRecetasLoading(false)

    setPerfilSaved(true); router.refresh()
  }

  function agregarFranja(dia: string) {
    setHorariosPorDia(prev => {
      const d = prev[dia]
      const ultima = d.franjas[d.franjas.length - 1]
      const nuevoInicio = Math.min(ultima.fin + 1, 22)
      return { ...prev, [dia]: { ...d, franjas: [...d.franjas, { inicio: nuevoInicio, fin: Math.min(nuevoInicio + 2, 23) }] } }
    })
  }

  function eliminarFranja(dia: string, idx: number) {
    setHorariosPorDia(prev => {
      const d = prev[dia]
      const nuevasFranjas = d.franjas.filter((_, i) => i !== idx)
      return { ...prev, [dia]: { ...d, franjas: nuevasFranjas.length > 0 ? nuevasFranjas : d.franjas } }
    })
  }

  function actualizarFranja(dia: string, idx: number, campo: 'inicio' | 'fin', valor: number) {
    setHorariosPorDia(prev => {
      const d = prev[dia]
      const nuevasFranjas = d.franjas.map((f, i) => i === idx ? { ...f, [campo]: valor } : f)
      return { ...prev, [dia]: { ...d, franjas: nuevasFranjas } }
    })
  }

  function copiarHorario(diaOrigen: string) {
    setHorariosPorDia(prev => {
      const origen = prev[diaOrigen]
      const nuevo: HorariosPorDia = { ...prev }
      for (const dia of Object.keys(nuevo)) {
        if (dia !== diaOrigen && nuevo[dia].activo) {
          nuevo[dia] = { ...nuevo[dia], franjas: [...origen.franjas] }
        }
      }
      return nuevo
    })
  }

  // ── Horario save ───────────────────────────────────────────────────
  async function handleHorarioSave() {
    setHorarioLoading(true)
    const supabase = createClient()
    const activos = Object.values(horariosPorDia).filter(d => d.activo)
    const todasFranjas = activos.flatMap(d => d.franjas)
    const globalInicio = todasFranjas.length > 0 ? Math.min(...todasFranjas.map(f => f.inicio)) : 9
    const globalFin = todasFranjas.length > 0 ? Math.max(...todasFranjas.map(f => f.fin)) : 18
    await supabase.from('profiles').update({
      horarios_por_dia: horariosPorDia,
      agenda_hora_inicio: globalInicio,
      agenda_hora_fin: globalFin,
    } as never).eq('id', profile.id)
    setHorarioLoading(false); setHorarioSaved(true)
    setTimeout(() => setHorarioSaved(false), 2500)
    router.refresh()
  }

  // ── Aviso de deuda — cuándo enviarlo ────────────────────────────────
  async function handleAvisoDeudaTimingChange(val: string) {
    setAvisoDeudaLoading(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ aviso_deuda_timing: val } as never).eq('id', profile.id)
    setAvisoDeudaTiming(val)
    setAvisoDeudaLoading(false)
    setAvisoDeudaSaved(true)
    setTimeout(() => setAvisoDeudaSaved(false), 2000)
  }

  // ── Recordatorio de turno al paciente — toggle ──────────────────────
  async function handleRecordatorioTurnoToggle() {
    const nuevo = !recordatorioTurnoActivo
    setRecordatorioTurnoActivo(nuevo)
    setRecordatorioTurnoLoading(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ recordatorio_turno_activo: nuevo }).eq('id', profile.id)
    setRecordatorioTurnoLoading(false)
  }

  // ── Política toggle ────────────────────────────────────────────────
  async function handleCobrarToggle() {
    const nuevo = !cobrar
    setCobrar(nuevo); setCobrarGuardando(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ cobrar_inasistencias: nuevo }).eq('id', profile.id)
    setCobrarGuardando(false)
  }

  // ── Feriados toggles ──────────────────────────────────────────────
  async function handleFeriadosNacionalesToggle() {
    const nuevo = !feriadosNacionales
    setFeriadosNacionales(nuevo)
    const supabase = createClient()
    await supabase.from('profiles').update({ feriados_nacionales: nuevo } as never).eq('id', profile.id)
    if (nuevo) fetch('/api/ajustes/aplicar-feriados', { method: 'POST' }).catch(() => {})
  }

  async function handleFeriadosProvincialesToggle() {
    const nuevo = !feriadosProvinciales
    setFeriadosProvinciales(nuevo)
    const supabase = createClient()
    await supabase.from('profiles').update({ feriados_provinciales: nuevo } as never).eq('id', profile.id)
    if (nuevo) fetch('/api/ajustes/aplicar-feriados', { method: 'POST' }).catch(() => {})
  }

  async function handleFeriadosTrabajaSiConfirmadoToggle() {
    const nuevo = !feriadosTrabajaSiConfirmado
    setFeriadosTrabajaSiConfirmado(nuevo)
    const supabase = createClient()
    await supabase.from('profiles').update({ feriados_trabajar_si_confirmado: nuevo } as never).eq('id', profile.id)
  }

  // ── Cobros save ────────────────────────────────────────────────────
  async function handleCobrosSave(e: React.FormEvent) {
    e.preventDefault()
    setCobrosLoading(true); setCobrosSaved(false)
    const supabase = createClient()
    await supabase.from('profiles').update({
      cobros_ventana_horas: cobrosVentana,
      cobros_cancelacion_horas: cobrosCancelacion,
      cobros_mensaje_paciente: cobrosMensaje || null,
    } as never).eq('id', profile.id)
    setCobrosLoading(false); setCobrosSaved(true)
    setTimeout(() => setCobrosSaved(false), 2500)
  }

  async function handleTransferenciaSave(e: React.FormEvent) {
    e.preventDefault()
    setTransferenciaLoading(true); setTransferenciaSaved(false)
    const supabase = createClient()
    await supabase.from('profiles').update({
      transferencia_banco: transferenciaBanco.trim() || null,
      transferencia_alias: transferenciaAlias.trim() || null,
      transferencia_titular: transferenciaTitular.trim() || null,
    }).eq('id', profile.id)
    setTransferenciaLoading(false); setTransferenciaSaved(true)
    setTimeout(() => setTransferenciaSaved(false), 2500)
  }

  // ── Booking save ───────────────────────────────────────────────────
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Mínimo de 1 tipo de consulta disponible en el link: tipos propios con
  // visible_en_booking (activos) + tipos base con precio cargado y visible.
  // tiposTurno es el snapshot cargado al entrar a Ajustes — no se actualiza
  // en vivo con lo que hace TiposTurnoSection (sección independiente, sin
  // callback hacia el padre), igual que el resto de esta pantalla no
  // sincroniza entre secciones.
  const tipoPropioActivoExiste = tiposTurno.some((t) => t.activo)
  function handleToggleSesionVisible() {
    const nuevo = !bookingSesionVisible
    const conteo = contarTiposDisponibles({
      tiposPropios: tiposTurno,
      sesionPrecioCargado: bookingPrecioSesion !== '',
      sesionVisible: nuevo,
      entrevistaPrecioCargado: bookingPrecioEntrevista !== '',
      entrevistaVisible: bookingEntrevistaVisible,
    })
    if (!nuevo && conteo === 0) {
      setBookingVisibilidadError('Tiene que quedar al menos un tipo de consulta disponible en el link de reservas')
      return
    }
    setBookingVisibilidadError(null)
    setBookingSesionVisible(nuevo)
  }
  function handleToggleEntrevistaVisible() {
    const nuevo = !bookingEntrevistaVisible
    const conteo = contarTiposDisponibles({
      tiposPropios: tiposTurno,
      sesionPrecioCargado: bookingPrecioSesion !== '',
      sesionVisible: bookingSesionVisible,
      entrevistaPrecioCargado: bookingPrecioEntrevista !== '',
      entrevistaVisible: nuevo,
    })
    if (!nuevo && conteo === 0) {
      setBookingVisibilidadError('Tiene que quedar al menos un tipo de consulta disponible en el link de reservas')
      return
    }
    setBookingVisibilidadError(null)
    setBookingEntrevistaVisible(nuevo)
  }

  async function handleBookingSave(e: React.FormEvent) {
    e.preventDefault()
    setBookingError(null)
    if (bookingBio && bookingBio.length > 200) {
      setBookingError('Bio pública no puede exceder 200 caracteres')
      return
    }
    // PASO 5 — red de seguridad server-adjacent: aunque la UI ya bloquea el
    // toggle que dejaría el conteo en 0, handleBookingSave es la última
    // puerta antes de persistir — nunca confiar solo en que el botón nunca
    // se haya podido apretar en ese estado.
    const conteoFinal = contarTiposDisponibles({
      tiposPropios: tiposTurno,
      sesionPrecioCargado: bookingPrecioSesion !== '',
      sesionVisible: bookingSesionVisible,
      entrevistaPrecioCargado: bookingPrecioEntrevista !== '',
      entrevistaVisible: bookingEntrevistaVisible,
    })
    if (conteoFinal === 0) {
      setBookingError('Tiene que quedar al menos un tipo de consulta disponible en el link de reservas')
      return
    }
    setBookingLoading(true); setBookingSaved(false)
    const supabase = createClient()
    await supabase.from('profiles').update({
      booking_activo: bookingActivo,
      booking_bio: bookingBio || null,
      booking_duracion_sesion: bookingDuracionSesion,
      booking_duracion_entrevista: bookingDuracionEntrevista,
      booking_tiempo_entre: bookingTiempoEntre,
      booking_anticipacion_minutos: bookingAnticipacion,
      booking_modalidades: bookingModalidades,
      booking_precio_sesion: bookingPrecioSesion ? parseFloat(bookingPrecioSesion) : null,
      booking_precio_entrevista: bookingPrecioEntrevista ? parseFloat(bookingPrecioEntrevista) : null,
      booking_sesion_visible: bookingSesionVisible,
      booking_entrevista_visible: bookingEntrevistaVisible,
      booking_requiere_pago: bookingRequierePago,
      booking_requiere_dni: bookingRequiereDni,
      booking_requiere_fecha_nacimiento: bookingRequiereFechaNacimiento,
    } as never).eq('id', profile.id)
    setBookingLoading(false); setBookingSaved(true)
    setTimeout(() => setBookingSaved(false), 2500)
  }


  // ── Firma update ───────────────────────────────────────────────────
  async function updateFirmaDB(campo: 'firma_url' | 'firma_sello_url', url: string | null) {
    const supabase = createClient()
    await supabase.from('profiles').update({ [campo]: url }).eq('id', profile.id)
  }

  async function handleRecetasSave(e: React.FormEvent) {
    e.preventDefault()
    setRecetasLoading(true); setRecetasError(null); setRecetasSaved(false)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      sexo: recetasForm.sexo || null,
      fecha_nacimiento_profesional: recetasForm.fecha_nacimiento || null,
      domicilio_consultorio: recetasForm.domicilio_consultorio || null,
      localidad_consultorio: recetasForm.localidad_consultorio || null,
      provincia_consultorio: recetasForm.provincia_consultorio || null,
    }).eq('id', profile.id)
    if (error) { setRecetasError('Error al guardar.'); setRecetasLoading(false); return }
    setRecetasSaved(true); setRecetasLoading(false)
    setTimeout(() => setRecetasSaved(false), 3000)
  }

  async function handleEliminarCuenta() {
    if (eliminarEmailInput.trim().toLowerCase() !== profile.email?.toLowerCase()) return
    setEliminarLoading(true)
    setEliminarError(null)
    try {
      const res = await fetch('/api/cuenta/eliminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacion: eliminarEmailInput }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setEliminarError(data.error ?? 'No se pudo eliminar la cuenta. Intentá de nuevo.')
        setEliminarLoading(false)
        return
      }
      window.location.href = '/login'
    } catch {
      setEliminarError('No se pudo eliminar la cuenta. Intentá de nuevo.')
      setEliminarLoading(false)
    }
  }

  const initials = `${profile.nombre?.[0] ?? ''}${profile.apellido?.[0] ?? ''}`.toUpperCase()

  // ── Los 8 grupos — navegación por estado dentro de la misma ruta /ajustes,
  // sincronizada con el hash de la URL (#cobros) para que Atrás y mobile
  // funcionen sin crear rutas nuevas. null = pantalla Resumen. ──────────────
  const GRUPOS: { id: string; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'perfil', label: 'Perfil y matrícula', desc: 'Tus datos, matrícula, terminología, firma y sello.', icon: ICONS.perfil },
    { id: 'agenda', label: 'Agenda y consultorio', desc: 'Horarios, feriados, sedes y tipos de turno.', icon: ICONS.horarios },
    { id: 'cobros', label: 'Cobros y obras sociales', desc: 'Cómo te pagan, reglas de cobro y obras sociales.', icon: ICONS.cobros },
    { id: 'reservas', label: 'Reservas online', desc: 'Tu link público: bio, modalidades y precios.', icon: ICONS['link-publico'] },
    { id: 'notif', label: 'Notificaciones', desc: 'Recordatorios a tus pacientes y avisos de cobro.', icon: ICONS.recordatorios },
    { id: 'integ', label: 'Integraciones', desc: 'Google Calendar, Drive y Mercado Pago.', icon: ICONS.integraciones },
    ...(mostrarColaboradoras ? [{ id: 'equipo', label: 'Asistentes', desc: 'Tu secretaria o asistente.', icon: ICONS.colaboradoras }] : []),
    { id: 'cuenta', label: 'Cuenta y plan', desc: 'Tu plan, facturación y seguridad.', icon: ICONS.cuenta },
  ]
  const GRUPO_IDS = GRUPOS.map(g => g.id)

  const [currentGroup, setCurrentGroup] = useState<string | null>(null)
  // Acordeón puntual a abrir y hacia el que hacer scroll suave al entrar a
  // un grupo desde una tarea del Resumen (ej. "Verificá tu matrícula" →
  // grupo perfil, acordeón matricula). null = comportamiento de siempre
  // (scroll al tope del grupo).
  const [acordeonObjetivo, setAcordeonObjetivo] = useState<string | null>(null)

  useEffect(() => {
    function leerHash() {
      const hash = window.location.hash.replace('#', '')
      setCurrentGroup(hash && GRUPO_IDS.includes(hash) ? hash : null)
    }
    leerHash()
    window.addEventListener('hashchange', leerHash)
    return () => window.removeEventListener('hashchange', leerHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goToGroup(id: string | null, acordeon?: string | null) {
    setCurrentGroup(id)
    setAcordeonObjetivo(acordeon ?? null)
    window.history.pushState(null, '', id ? `#${id}` : window.location.pathname + window.location.search)
    // Con acordeón puntual, el scroll lo hace el efecto de abajo una vez que
    // ese acordeón ya está en el DOM (abierto) — acá solo se mantiene el
    // scroll-al-tope de siempre cuando no se pide uno.
    if (!acordeon) window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (!acordeonObjetivo || !currentGroup) return
    const el = document.getElementById(`acordeon-${acordeonObjetivo}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentGroup, acordeonObjetivo])

  // ── Chips de estado del Resumen — solo lectura de datos ya existentes,
  // nunca se guarda nada acá. ────────────────────────────────────────────
  // Punto 7 de Fase 3: hay matrícula si profesional_matriculas tiene
  // alguna fila; si la tabla está vacía, profiles.matricula como respaldo
  // (perfil viejo que nunca llegó a cargar nada en la tabla nueva).
  const hayMatricula = matriculas.length > 0 ? true : !!profile.matricula
  const matriculaVerificada = matriculas.some((m) => m.verificada)
  const perfilFaltante = !profile.nombre ? 'nombre' : !perfilForm.especialidad ? 'especialidad' : !perfilForm.dni ? 'DNI' : !hayMatricula ? 'matrícula' : null
  const perfilCompleto = !perfilFaltante

  const cobrosCompleto = mpConectado || !!(transferenciaBanco && transferenciaAlias && transferenciaTitular)

  const transferenciaCargada = !!(transferenciaBanco && transferenciaAlias && transferenciaTitular)
  const diasActivosHorario = Object.values(horariosPorDia).filter(d => d.activo).length

  const reservasPasos = [
    true, // Horarios de atención: siempre hay alguna configuración de horario.
    bookingPrecioSesion !== '' || bookingPrecioEntrevista !== '' || tipoPropioActivoExiste,
    !bookingRequierePago || mpConectado || transferenciaCargada,
    bookingBio.trim() !== '',
  ]
  const reservasPasosOk = reservasPasos.filter(Boolean).length

  const resumenPreciosReservas = [
    bookingPrecioSesion !== '' ? `Sesión $${Number(bookingPrecioSesion).toLocaleString('es-AR')}` : null,
    bookingPrecioEntrevista !== '' ? `Entrevista inicial $${Number(bookingPrecioEntrevista).toLocaleString('es-AR')}` : null,
  ].filter(Boolean).join(' · ') || 'Sin precio cargado todavía'

  const MODALIDAD_LABEL: Record<string, string> = { presencial: 'Presencial', videollamada: 'Videollamada', telefonica: 'Telefónica' }
  const resumenPresentacionReservas = [
    bookingBio.trim() ? 'Bio cargada' : 'Sin bio',
    bookingModalidades.length > 0 ? bookingModalidades.map(m => MODALIDAD_LABEL[m] ?? m).join(' y ') : 'Sin modalidad',
  ].join(' · ')

  const integracionesCompleto = mpConectado && googleConectado

  const resumenTareas: { label: string; detalle: string; grupo: string; acordeon?: string }[] = []
  if (!perfilCompleto) resumenTareas.push({
    label: 'Completá tu perfil', detalle: `Falta ${perfilFaltante}.`, grupo: 'perfil',
    // Si lo que falta es la matrícula, el acordeón a abrir es el de
    // Matrícula; nombre/especialidad/DNI viven en Datos personales, que ya
    // está abierto por defecto — no hace falta acordeón puntual ahí.
    ...(perfilFaltante === 'matrícula' ? { acordeon: 'matricula' } : {}),
  })
  // No cuenta como "Pendiente" (perfilCompleto sigue siendo solo
  // existencia, igual que Fase 1) — es un aviso aparte en "Te falta
  // configurar" para la matrícula cargada pero todavía sin verificar.
  else if (hayMatricula && !matriculaVerificada) resumenTareas.push({ label: 'Verificá tu matrícula', detalle: 'Con REFEPS, para habilitar recetas electrónicas.', grupo: 'perfil', acordeon: 'matricula' })
  if (!bookingActivo || reservasPasosOk < 4) resumenTareas.push({ label: 'Activá tu link de reservas', detalle: `${reservasPasosOk} de 4 pasos completos.`, grupo: 'reservas' })

  // ── Envoltorio de cada grupo: botón Volver + header (icono/título/desc del
  // propio GRUPOS) + contenido. Usa currentGroup/GRUPOS/goToGroup por clausura. ──
  function GrupoShell({ children }: { children: React.ReactNode }) {
    const grupo = GRUPOS.find(g => g.id === currentGroup)
    if (!grupo) return null
    return (
      <div>
        <button type="button" onClick={() => goToGroup(null)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 13, fontWeight: 600, color: 'var(--muted)',
        }}>
          <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M15 18l-6-6 6-6" /></svg>
          Volver a Ajustes
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
          <div style={icnStyle('var(--accent-soft)', 'var(--accent)')}>{grupo.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>{grupo.label}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.5 }}>{grupo.desc}</p>
          </div>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="px-4 md:px-7 pb-20 w-full mx-auto" style={{ maxWidth: 1320 }}>
      {/* Page header */}
      <header style={{ padding: '26px 0 18px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15, color: 'var(--ink)' }}>
          Ajustes
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0', maxWidth: 640 }}>
          Configurá tu perfil, cobros, integraciones y políticas profesionales. Algunos datos son visibles para colegas en Interconsultas.
        </p>
      </header>

      {/* Banner DNI faltante — solo para usuarios que completaron el onboarding antes de que fuera obligatorio */}
      {!profile.dni && profile.onboarding_completed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--amber-soft)', border: '1px solid var(--amber)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--amber-ink)', flexShrink: 0 }}>
            badge
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--amber-ink)' }}>
              Completá tu DNI para habilitar validaciones automáticas de matrícula
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--amber-ink)', opacity: 0.85 }}>
              Es necesario para la verificación de profesionales en el REFEPS (SISA).
            </p>
          </div>
          <a
            href="#perfil"
            style={{
              fontSize: 12.5, fontWeight: 600, color: 'var(--amber-ink)',
              textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Ir a Perfil →
          </a>
        </div>
      )}

      {currentGroup === null ? (
        <>
          {/* ═══ RESUMEN ═══ */}
          {resumenTareas.length > 0 && (
            <div style={{ ...secStyle, marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Te falta configurar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {resumenTareas.map(t => (
                  <button
                    key={t.grupo}
                    type="button"
                    onClick={() => goToGroup(t.grupo, t.acordeon)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{t.detalle}</div>
                    </div>
                    <span style={{ fontSize: 15, color: 'var(--muted-2)', flexShrink: 0 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GRUPOS.map(g => {
              let chip: { text: string; tone: 'ok' | 'warn' | 'muted' } | null = null
              if (g.id === 'perfil') chip = perfilCompleto ? { text: 'Completo', tone: 'ok' } : { text: 'Pendiente', tone: 'warn' }
              if (g.id === 'cobros') chip = cobrosCompleto ? { text: 'Completo', tone: 'ok' } : { text: 'Pendiente', tone: 'warn' }
              if (g.id === 'reservas') chip = (bookingActivo && reservasPasosOk === 4) ? { text: 'Activo', tone: 'ok' } : { text: `${reservasPasosOk} de 4 pasos`, tone: 'muted' }
              if (g.id === 'integ') chip = integracionesCompleto ? { text: 'Completo', tone: 'ok' } : { text: 'Pendiente', tone: 'warn' }
              if (g.id === 'cuenta') chip = { text: profile.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Sin plan', tone: 'muted' }
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => goToGroup(g.id, g.id === 'perfil' && perfilFaltante === 'matrícula' ? 'matricula' : undefined)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 10,
                    padding: 18, borderRadius: 14, border: '1px solid var(--border)',
                    background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={icnStyle('var(--accent-soft)', 'var(--accent)')}>{g.icon}</div>
                    {chip && <Chip text={chip.text} tone={chip.tone} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{g.label}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>{g.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <GrupoShell>

          {currentGroup === 'perfil' && (
            <>
              <form onSubmit={handlePerfilGrupoSave}>
                <Accordion title="Datos personales" desc="Datos visibles para tus pacientes y colegas en Interconsultas." defaultOpen>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    padding: 16, background: 'var(--surface-2)',
                    borderRadius: 12, border: '1px solid var(--border)',
                    marginBottom: 22,
                  }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(145deg, #E3E9F6, #C9D3E9)',
                      color: '#16389F', display: 'grid', placeItems: 'center',
                      fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em',
                      overflow: 'hidden', position: 'relative',
                    }}>
                      {avatarUrl
                        /* eslint-disable-next-line @next/next/no-img-element */
                        ? <img src={avatarUrl} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : initials}
                      <label style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--ink)', color: 'white',
                        display: 'grid', placeItems: 'center',
                        border: '2px solid var(--surface-2)',
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        opacity: uploading ? 0.5 : 1,
                      }}>
                        <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: 'white', strokeWidth: 2, fill: 'none' }}>
                          <path d="M3 5h4l2-2h6l2 2h4v14H3z"/><circle cx="12" cy="13" r="4"/>
                        </svg>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} disabled={uploading} />
                      </label>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Foto del profesional</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>JPG, PNG o WebP · Máximo 2MB · Se mostrará en círculo</div>
                      {avatarUrl && (
                        <button type="button" onClick={handleDeleteAvatar} disabled={uploading}
                          style={{ marginTop: 6, fontSize: 12, color: '#DC2626', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontWeight: 500 }}>
                          Eliminar foto
                        </button>
                      )}
                    </div>
                  </div>

                  {perfilError && (
                    <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
                      {perfilError}
                    </div>
                  )}

                  <div className={`${grid2Class} mb-4`}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Nombre completo <span style={{ color: '#DC2626' }}>*</span></label>
                      <input style={{ ...inputStyle, background: 'var(--surface-2)', color: 'var(--muted)' }} value={`${profile.nombre} ${profile.apellido}`} readOnly />
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Email <span style={{ color: '#DC2626' }}>*</span></label>
                      <input style={{ ...inputStyle, background: 'var(--surface-2)', color: 'var(--muted)' }} value={profile.email} readOnly />
                    </div>
                  </div>

                  <div className={`${grid2Class} mb-4`}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Especialidad</label>
                      <select style={inputStyle} value={perfilForm.especialidad} onChange={e => setPerfilForm(p => ({ ...p, especialidad: e.target.value }))}>
                        <option value="">Sin especificar</option>
                        {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Título o credencial adicional <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-2)' }}>opcional</span></label>
                      <input style={inputStyle} type="text" placeholder="Ej: Prof. en Educación Física" value={perfilForm.titulo_credencial_adicional} onChange={e => setPerfilForm(p => ({ ...p, titulo_credencial_adicional: e.target.value }))} />
                      <span style={hintStyle}>Se muestra junto a tu especialidad, ej: &quot;Nutrición · Prof. en Educación Física&quot;.</span>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Término para los turnos</label>
                      <select style={inputStyle} value={perfilForm.terminologia} onChange={e => setPerfilForm(p => ({ ...p, terminologia: e.target.value as 'sesion' | 'consulta' }))}>
                        <option value="sesion">Sesión</option>
                        <option value="consulta">Consulta</option>
                      </select>
                      <span style={hintStyle}>Personaliza cómo se llaman los turnos en toda la app.</span>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>DNI</label>
                      <input
                        style={inputStyle}
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej: 27704316"
                        maxLength={9}
                        value={perfilForm.dni}
                        onChange={e => setPerfilForm(p => ({ ...p, dni: e.target.value.replace(/\D/g, '') }))}
                      />
                      <span style={hintStyle}>Solo dígitos, sin puntos ni espacios.</span>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Sexo</label>
                      <select style={inputStyle} value={recetasForm.sexo} onChange={e => setRecetasForm(p => ({ ...p, sexo: e.target.value }))}>
                        <option value="">Seleccioná</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Fecha de nacimiento</label>
                      <input style={inputStyle} type="date" value={recetasForm.fecha_nacimiento} onChange={e => setRecetasForm(p => ({ ...p, fecha_nacimiento: e.target.value }))} />
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Teléfono de contacto</label>
                      <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <span style={{ padding: '0 12px', fontSize: 13, color: 'var(--muted)', fontWeight: 500, background: 'var(--surface-2)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>+54</span>
                        <input style={{ ...inputStyle, border: 'none', flex: 1, borderRadius: 0 }} type="tel" placeholder="9 11 1234-5678" value={perfilForm.telefono} onChange={e => setPerfilForm(p => ({ ...p, telefono: e.target.value }))} />
                      </div>
                      <span style={hintStyle}>Visible para otros profesionales en interconsultas.</span>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>País</label>
                      <select style={inputStyle} value={perfilForm.pais} onChange={e => setPerfilForm(p => ({ ...p, pais: e.target.value, provincia: '', localidad: '' }))}>
                        {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Provincia / Estado</label>
                      <select style={inputStyle} value={perfilForm.provincia} onChange={e => setPerfilForm(p => ({ ...p, provincia: e.target.value }))}>
                        <option value="">Sin especificar</option>
                        {(PAISES_PROVINCIAS[perfilForm.pais] ?? []).map(prov => <option key={prov} value={prov}>{prov}</option>)}
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Localidad / Ciudad</label>
                      <input style={inputStyle} type="text" placeholder="Ej: Buenos Aires" value={perfilForm.localidad} onChange={e => setPerfilForm(p => ({ ...p, localidad: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2" style={fieldStyle}>
                      <label style={labelStyle}>Dirección donde realiza la prestación</label>
                      <input style={inputStyle} type="text" placeholder="Av. Corrientes 1234, Piso 3" value={perfilForm.direccion} onChange={e => setPerfilForm(p => ({ ...p, direccion: e.target.value }))} />
                      <span style={hintStyle}>Se usa en las planillas de asistencia para obras sociales.</span>
                    </div>
                  </div>
                </Accordion>

                <Accordion id="acordeon-matricula" forceOpen={acordeonObjetivo === 'matricula'} title="Matrícula" desc="Provincial y nacional. Se muestra en tu perfil público y en documentos.">
                  <MatriculasSection profesionalId={profile.id} dniInicial={profile.dni} matriculasIniciales={matriculas} />
                </Accordion>

                <Accordion title="Redes sociales" desc="Hasta 3. Se muestran en la sección Contacto de los planes que compartís con tus pacientes.">
                  <RedesSocialesField initialValue={redesRef.current} onChange={(v) => { redesRef.current = v }} />
                </Accordion>

                <Accordion title="Módulos de especialidad" desc="Funciones adicionales según tu especialidad.">
                  <ToggleRow
                    name="Módulo de antropometría"
                    desc="Muestra la solapa Antropometría en la ficha de tus pacientes."
                    on={antropometriaActiva}
                    onChange={() => setAntropometriaActiva((v) => !v)}
                  />
                  <div style={{ ...fieldStyle, marginTop: 16 }}>
                    <label style={labelStyle}>Certificación en antropometría</label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="Ej: ISAK nivel 1"
                      maxLength={60}
                      value={perfilForm.antropometria_certificacion}
                      onChange={e => setPerfilForm(p => ({ ...p, antropometria_certificacion: e.target.value }))}
                    />
                  </div>
                </Accordion>

                <div style={{ ...secFootStyle, marginBottom: 14 }}>
                  {perfilSaved && (
                    <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                      Cambios guardados
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  <button type="submit" disabled={perfilLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: perfilLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: perfilLoading ? 0.7 : 1 }}>
                    {perfilLoading ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>

              <Accordion title="Domicilio para recetas electrónicas" desc="Se usa exclusivamente para la emisión de recetas electrónicas y no es visible para tus pacientes.">
                {recetasError && (
                  <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
                    {recetasError}
                  </div>
                )}
                <form onSubmit={handleRecetasSave}>
                  <div className="mb-4">
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Domicilio del consultorio</label>
                      <input style={inputStyle} type="text" placeholder="Ej: Av. Corrientes 1234, Piso 3, Of. 8" value={recetasForm.domicilio_consultorio} onChange={e => setRecetasForm(p => ({ ...p, domicilio_consultorio: e.target.value }))} />
                    </div>
                  </div>
                  <div className={grid2Class}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Localidad del consultorio</label>
                      <input style={inputStyle} type="text" placeholder="Ej: Buenos Aires" value={recetasForm.localidad_consultorio} onChange={e => setRecetasForm(p => ({ ...p, localidad_consultorio: e.target.value }))} />
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Provincia del consultorio</label>
                      <select style={inputStyle} value={recetasForm.provincia_consultorio} onChange={e => setRecetasForm(p => ({ ...p, provincia_consultorio: e.target.value }))}>
                        <option value="">Seleccioná la provincia</option>
                        {['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={secFootStyle}>
                    {recetasSaved && (
                      <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                        Guardado
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <button type="submit" disabled={recetasLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: recetasLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: recetasLoading ? 0.7 : 1 }}>
                      {recetasLoading ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </Accordion>

              <Accordion title="Firma y sello" desc="Se aplican automáticamente al final de documentos exportados. Tienen validez legal en Argentina según Ley 25.506.">
                <div className={`${grid2Class} mb-2`}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '20px 18px', background: 'var(--surface)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Firma</div>
                    <FirmaUploader
                      label="Firma manuscrita"
                      descripcion="Solo tu firma, sin sello"
                      instrucciones="Solo tu firma, sin sello, sobre fondo blanco en tinta negra."
                      firmaUrl={firmaUrl}
                      bucket="firmas-profesionales"
                      storagePath={`${profile.id}/firma-simple`}
                      onUpload={(url) => { setFirmaUrl(url); updateFirmaDB('firma_url', url) }}
                      onDelete={() => { setFirmaUrl(null); updateFirmaDB('firma_url', null) }}
                    />
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '20px 18px', background: 'var(--surface)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Sello profesional</div>
                    <FirmaUploader
                      label="Firma y sello profesional"
                      descripcion="Combinación de tu firma manuscrita y sello profesional"
                      instrucciones="La imagen debe mostrar tu firma y sello profesional sobre fondo blanco, en tinta negra."
                      firmaUrl={firmaSelloUrl}
                      bucket="firmas-profesionales"
                      storagePath={`${profile.id}/firma-sello`}
                      onUpload={(url) => { setFirmaSelloUrl(url); updateFirmaDB('firma_sello_url', url) }}
                      onDelete={() => { setFirmaSelloUrl(null); updateFirmaDB('firma_sello_url', null) }}
                    />
                  </div>
                </div>
              </Accordion>
            </>
          )}

          {currentGroup === 'agenda' && (
            <>
              <Accordion title="Sedes y horarios" desc="Define tus sedes y los horarios de atención en cada una." defaultOpen>
                <SedesHorariosSection plan={profile.plan} onMultiChange={setMultiSede} />
                {multiSede === false && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ marginBottom: 16 }}>
                  {DIAS_SEMANA_CONFIG.map(({ key, label }, idx) => {
                const dia = horariosPorDia[key] ?? { activo: false, franjas: [{ inicio: 9, fin: 18 }] }
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
                    borderBottom: idx < DIAS_SEMANA_CONFIG.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 130, flexShrink: 0, paddingTop: 5 }}>
                      <Toggle
                        on={dia.activo}
                        onChange={() => setHorariosPorDia(prev => ({ ...prev, [key]: { ...prev[key], activo: !prev[key].activo } }))}
                      />
                      <span style={{ fontSize: 13.5, fontWeight: dia.activo ? 600 : 400, color: dia.activo ? 'var(--ink)' : 'var(--muted)' }}>
                        {label}
                      </span>
                    </div>
                    {!dia.activo ? (
                      <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1, paddingTop: 6 }}>No disponible</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        {dia.franjas.map((franja, idx2) => (
                          <div key={idx2} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <select
                              style={{ ...inputStyle, width: 90, height: 34, paddingRight: 8 }}
                              value={franja.inicio}
                              onChange={e => actualizarFranja(key, idx2, 'inicio', Number(e.target.value))}
                            >
                              {HORAS_INICIO.map((h) => (
                                <option key={h} value={h}>{formatHora(h)}</option>
                              ))}
                            </select>
                            <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>
                            <select
                              style={{ ...inputStyle, width: 90, height: 34, paddingRight: 8 }}
                              value={franja.fin}
                              onChange={e => actualizarFranja(key, idx2, 'fin', Number(e.target.value))}
                            >
                              {HORAS_FIN.filter(h => h > franja.inicio).map((h) => (
                                <option key={h} value={h}>{formatHora(h)}</option>
                              ))}
                            </select>
                            {dia.franjas.length > 1 && (
                              <button type="button" onClick={() => eliminarFranja(key, idx2)}
                                title="Eliminar franja"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-2)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>
                                ×
                              </button>
                            )}
                            {idx2 === 0 && (
                              <>
                                <button type="button" onClick={() => agregarFranja(key)}
                                  title="Agregar franja horaria"
                                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--accent)', fontSize: 16, lineHeight: 1, padding: '2px 7px' }}>
                                  +
                                </button>
                                <button type="button" onClick={() => copiarHorario(key)}
                                  title="Copiar a todos los días activos"
                                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--muted-2)', fontSize: 13, padding: '2px 7px' }}>
                                  ⧉
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
                  </div>

                  <div style={secFootStyle}>
                    {horarioSaved && (
                      <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                        Cambios guardados
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <button type="button" onClick={handleHorarioSave} disabled={horarioLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: horarioLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: horarioLoading ? 0.7 : 1 }}>
                      {horarioSaved ? '✓ Guardado' : horarioLoading ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
                )}
              </Accordion>

              <Accordion title="Tipos de turno" desc="Configurá los tipos de turno propios que ofrecés.">
                <TiposTurnoSection
                  plan={profile.plan}
                  habilitado={tiposTurnoHabilitado}
                  tiposIniciales={tiposTurno}
                  terminologia={profile.terminologia ?? undefined}
                  sedes={sedes}
                  baseSesion={{ precioCargado: bookingPrecioSesion !== '', visible: bookingSesionVisible }}
                  baseEntrevista={{ precioCargado: bookingPrecioEntrevista !== '', visible: bookingEntrevistaVisible }}
                />
              </Accordion>

              <Accordion title="Feriados y días no laborales" desc="Configurá cómo KLIA maneja los feriados en tu agenda y link público.">
                <ToggleRow
                  name="Respetar feriados nacionales"
                  desc="Los feriados nacionales no aparecen como disponibles en tu link público de turnos."
                  on={feriadosNacionales}
                  onChange={handleFeriadosNacionalesToggle}
                />
                <ToggleRow
                  name={`Respetar feriados de ${perfilForm.provincia || 'tu provincia'}`}
                  desc={!perfilForm.provincia
                    ? '⚠️ Completá tu provincia en el perfil para activar esta opción.'
                    : `Los feriados provinciales de ${perfilForm.provincia} no aparecen como disponibles en tu link público.`}
                  on={feriadosProvinciales}
                  onChange={handleFeriadosProvincialesToggle}
                  disabled={!perfilForm.provincia}
                />
                <ToggleRow
                  name="Mantener sesiones confirmadas en feriados"
                  desc="Las sesiones ya confirmadas en feriados se mantienen y se cobran normalmente. Solo bloquea nuevos turnos."
                  on={feriadosTrabajaSiConfirmado}
                  onChange={handleFeriadosTrabajaSiConfirmadoToggle}
                />
              </Accordion>
            </>
          )}

          {currentGroup === 'cobros' && (
            <>
              <Accordion title="Cómo te pagan" desc="Mercado Pago y transferencia bancaria para cobrar tus sesiones." defaultOpen>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '4px 0 18px', borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Mercado Pago</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                      {mpConectado ? `Vinculado${mpNombre ? `: ${mpNombre}` : ''}` : 'No conectado todavía.'}
                    </div>
                  </div>
                  {mpConectado ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--ok-soft)', color: 'var(--ok)', flexShrink: 0 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                      Vinculado
                    </span>
                  ) : (
                    <a href="/api/auth/mercadopago" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', flexShrink: 0, textDecoration: 'none' }}>
                      Conectar
                    </a>
                  )}
                </div>

                <form onSubmit={handleTransferenciaSave}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Transferencia bancaria</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.55 }}>Medio de pago alternativo a Mercado Pago. Se muestra en tu link público de reservas junto al pago online, si lo tenés conectado.</div>
                  <div className={grid2Class} style={{ marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 6 }}>Banco</label>
                      <input style={inputStyle} type="text" placeholder="Ej: Banco Galicia" value={transferenciaBanco} onChange={e => setTransferenciaBanco(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 6 }}>Alias</label>
                      <input style={inputStyle} type="text" placeholder="Ej: mi.alias.mp" value={transferenciaAlias} onChange={e => setTransferenciaAlias(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 6 }}>Titular (Nombre y Apellido)</label>
                    <input style={inputStyle} type="text" placeholder="Ej: Norberto Riccitelli" value={transferenciaTitular} onChange={e => setTransferenciaTitular(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {transferenciaSaved && (
                      <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                        Guardado
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <button type="submit" disabled={transferenciaLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: transferenciaLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: transferenciaLoading ? 0.7 : 1 }}>
                      {transferenciaLoading ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              </Accordion>

              <Accordion title="Link de pago" desc="Ventana de pago, política de cancelación y mensaje al paciente en tu link público.">
                <form onSubmit={handleCobrosSave}>
                  {/* Ventana de pago */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Ventana de pago</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.55 }}>¿Cuánto tiempo tiene el paciente para pagar antes de que se libere el turno?</div>
                    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, gap: 2 }}>
                      {[24, 48, 72].map(h => (
                        <button key={h} type="button" onClick={() => setCobrosVentana(h)}
                          style={{ border: 'none', padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: 'pointer', background: cobrosVentana === h ? 'var(--ink)' : 'transparent', color: cobrosVentana === h ? 'white' : 'var(--muted)', transition: 'all .12s ease' }}>
                          {h} hs
                        </button>
                      ))}
                      <button type="button" onClick={() => setCobrosVentana(0)}
                        style={{ border: 'none', padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: 'pointer', background: cobrosVentana === 0 ? 'var(--ink)' : 'transparent', color: cobrosVentana === 0 ? 'white' : 'var(--muted)', transition: 'all .12s ease' }}>
                        Sin límite
                      </button>
                    </div>
                  </div>

                  {/* Política de cancelación */}
                  <div style={{ marginBottom: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Política de cancelación</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.55 }}>¿Con cuántas horas de anticipación puede cancelar el paciente con devolución completa?</div>
                    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, gap: 2 }}>
                      {[6, 12, 24, 48].map(h => (
                        <button key={h} type="button" onClick={() => setCobrosCancelacion(h)}
                          style={{ border: 'none', padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: 'pointer', background: cobrosCancelacion === h ? 'var(--ink)' : 'transparent', color: cobrosCancelacion === h ? 'white' : 'var(--muted)', transition: 'all .12s ease' }}>
                          {h} hs
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mensaje al paciente */}
                  <div style={{ paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Mensaje personalizado al paciente</label>
                      <textarea style={textareaStyle} placeholder="Se incluye en el email de confirmación de turno…" value={cobrosMensaje} onChange={e => setCobrosMensaje(e.target.value)} />
                      <span style={hintStyle}>Se incluye en el email de confirmación de turno y en el link público.</span>
                    </div>
                  </div>

                  <div style={secFootStyle}>
                    {cobrosSaved && (
                      <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                        Cambios guardados
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <button type="submit" disabled={cobrosLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: cobrosLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: cobrosLoading ? 0.7 : 1 }}>
                      {cobrosLoading ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </Accordion>

              <Accordion title="Deuda y cobros generales" desc="Reglas para calcular la deuda de tus pacientes.">
                <ToggleRow
                  name="Cobrar sesiones no asistidas"
                  desc={<>Si está activo, las sesiones marcadas como <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>&ldquo;No asistió&rdquo;</strong> se incluyen en la deuda del paciente. Podés configurar excepciones por paciente desde su ficha.</>}
                  on={cobrar}
                  onChange={handleCobrarToggle}
                  disabled={cobrarGuardando}
                />
              </Accordion>

              <Accordion title="Obras sociales y prepagas" desc="Configurá honorarios y datos de cada obra social para tus liquidaciones.">
                <ObraSocialesConfig initialList={obrasSociales} terapeutaId={profile.id} />
              </Accordion>
            </>
          )}

          {currentGroup === 'notif' && (
            <>
              <Accordion title="Recordatorios a pacientes" desc="Controlá qué avisos reciben tus pacientes antes de su turno." defaultOpen>
                <ToggleRow
                  name="Recordatorio de turno al paciente"
                  desc="Se envía un día antes del turno, por email y WhatsApp. Si lo desactivás, tus pacientes no reciben recordatorio de turno por ningún canal. No afecta el aviso de pago."
                  on={recordatorioTurnoActivo}
                  onChange={handleRecordatorioTurnoToggle}
                  disabled={recordatorioTurnoLoading}
                />
              </Accordion>

              {mostrarAvisoDeuda && (
                <Accordion title="Aviso de deuda" desc="Notificá automáticamente a pacientes particulares con sesiones realizadas sin pagar.">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 16px', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>Cuándo enviar el aviso</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>Contado desde el fin de la sesión. Un solo aviso por email por sesión. No aplica a obras sociales, bonificadas, ausencias ni cancelaciones.</div>
                    </div>
                    <select
                      style={{ ...inputStyle, width: 240, flexShrink: 0 }}
                      value={avisoDeudaTiming}
                      onChange={e => handleAvisoDeudaTimingChange(e.target.value)}
                      disabled={avisoDeudaLoading}
                    >
                      {OPCIONES_AVISO_DEUDA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {avisoDeudaSaved && (
                    <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                      Guardado
                    </span>
                  )}
                </Accordion>
              )}
            </>
          )}

          {currentGroup === 'integ' && (
            <Accordion title="Google Calendar y Mercado Pago" desc="Conectá KLIA con tus herramientas favoritas. Los datos se sincronizan en tiempo real." defaultOpen>
              <Suspense fallback={null}>
                <IntegracionesClient
                  conectado={googleConectado}
                  syncEnabled={googleSyncEnabled}
                  mpConectado={mpConectado}
                  mpEmail={mpEmail}
                  mpNombre={mpNombre}
                />
              </Suspense>
            </Accordion>
          )}

          {currentGroup === 'reservas' && (
            <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>Link activo</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Compartí tu link personal para que tus pacientes reserven turnos online.</div>
            </div>
            <Toggle on={bookingActivo} onChange={() => setBookingActivo(v => !v)} />
          </div>

            {/* Slug read-only */}
            {bookingSlug && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--surface-variant, #F6F7F9)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tu link público</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <code style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    app.klia.com.ar/p/{bookingSlug}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://app.klia.com.ar/p/${bookingSlug}`)
                      setBookingCopied(true)
                      setTimeout(() => setBookingCopied(false), 2000)
                    }}
                    style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: bookingCopied ? 'var(--ok)' : 'var(--ink-2)', whiteSpace: 'nowrap' }}
                  >
                    {bookingCopied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            {/* Progreso — solo lectura de reservasPasos, no bloquea nada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{reservasPasosOk} de 4 pasos</span>
              <div style={{ flex: 1, height: 6, borderRadius: 100, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 100, background: 'var(--ok)', width: `${(reservasPasosOk / 4) * 100}%`, transition: 'width .2s ease' }} />
              </div>
            </div>

            <form onSubmit={handleBookingSave}>
              {/* ─ Paso 1: Horarios de atención ─ */}
              <Accordion
                title="Horarios de atención"
                desc={multiSede ? 'Configurado por sede en Agenda y consultorio.' : `${diasActivosHorario} día${diasActivosHorario === 1 ? '' : 's'} activo${diasActivosHorario === 1 ? '' : 's'} por semana.`}
                defaultOpen
                right={<>
                  <span style={pasoReqTagStyle}>Requerido</span>
                  <Chip text="Completo" tone="ok" />
                </>}
              >
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  {multiSede
                    ? 'Tenés horarios configurados por sede en el grupo Agenda y consultorio.'
                    : `Tenés ${diasActivosHorario} día${diasActivosHorario === 1 ? '' : 's'} activo${diasActivosHorario === 1 ? '' : 's'} por semana cargados.`}
                </p>
                <button
                  type="button"
                  onClick={() => goToGroup('agenda')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}
                >
                  Editar horarios
                </button>
              </Accordion>

              {/* ─ Paso 2: Qué ofrecés y a qué precio ─ */}
              <Accordion
                title="Qué ofrecés y a qué precio"
                desc={resumenPreciosReservas}
                right={<>
                  <span style={pasoReqTagStyle}>Requerido</span>
                  <Chip text={reservasPasos[1] ? 'Completo' : 'Pendiente'} tone={reservasPasos[1] ? 'ok' : 'warn'} />
                </>}
              >
                {/* Duraciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 18 }}>
                  {[
                    { label: 'Duración sesión (min)', value: bookingDuracionSesion, set: setBookingDuracionSesion },
                    { label: 'Duración entrevista (min)', value: bookingDuracionEntrevista, set: setBookingDuracionEntrevista },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
                      <input type="number" min={5} max={240} value={value} onChange={e => set(Number(e.target.value))}
                        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>

                {/* Precios */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: tipoPropioActivoExiste ? 6 : 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Precio sesión</label>
                    <MontoInput name="Precio sesión" value={bookingPrecioSesion} onChange={setBookingPrecioSesion} placeholder="Ej: 70000"
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                    {tipoPropioActivoExiste && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
                        <Toggle on={bookingSesionVisible} onChange={handleToggleSesionVisible} />
                        Mostrar en link de reservas
                      </label>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Precio entrevista inicial</label>
                    <MontoInput name="Precio entrevista inicial" value={bookingPrecioEntrevista} onChange={setBookingPrecioEntrevista} placeholder="Ej: 70000"
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                    {tipoPropioActivoExiste && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
                        <Toggle on={bookingEntrevistaVisible} onChange={handleToggleEntrevistaVisible} />
                        Mostrar en link de reservas
                      </label>
                    )}
                  </div>
                </div>

                {tipoPropioActivoExiste && bookingVisibilidadError && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', flexShrink: 0 }} />
                    {bookingVisibilidadError}
                  </p>
                )}
              </Accordion>

              {/* ─ Paso 3: Cómo cobrás ─ */}
              <Accordion
                title="Cómo cobrás"
                desc={bookingRequierePago ? 'Requiere pago para confirmar.' : 'No requiere pago para confirmar.'}
                right={<span style={pasoReqTagStyle}>Opcional</span>}
              >
                <ToggleRow
                  name="Requiere pago para confirmar"
                  desc="El turno se confirma solo cuando el paciente completa el pago con Mercado Pago. Mercado Pago cobra una comisión por cada cobro que procesa. Klia no cobra ninguna comisión adicional."
                  on={bookingRequierePago}
                  onChange={() => setBookingRequierePago(v => !v)}
                />

                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Mercado Pago</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Se conecta en Integraciones</div>
                    </div>
                    <Chip text={mpConectado ? 'Conectado' : 'No conectado'} tone={mpConectado ? 'ok' : 'muted'} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Transferencia bancaria</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Se carga en Cobros y obras sociales</div>
                    </div>
                    <Chip text={transferenciaCargada ? 'Cargada' : 'Sin cargar'} tone={transferenciaCargada ? 'ok' : 'muted'} />
                  </div>
                </div>
              </Accordion>

              {/* ─ Paso 4: Tu presentación ─ */}
              <Accordion
                title="Tu presentación"
                desc={resumenPresentacionReservas}
                right={<>
                  <span style={pasoReqTagStyle}>Opcional</span>
                  <Chip text={reservasPasos[3] ? 'Completo' : 'Pendiente'} tone={reservasPasos[3] ? 'ok' : 'warn'} />
                </>}
              >
                {/* Bio */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Bio pública</label>
                  <textarea
                    value={bookingBio}
                    onChange={e => {
                      if (e.target.value.length > 200) return
                      setBookingBio(e.target.value)
                    }}
                    rows={3}
                    maxLength={200}
                    placeholder="Describí brevemente tu enfoque y especialidad (visible para pacientes)..."
                    style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{
                    marginTop: 4, textAlign: 'right', fontSize: 12, fontWeight: 500,
                    color: bookingBio.length < 150 ? '#10b981' : bookingBio.length < 191 ? '#F59E0B' : '#EF4444',
                  }}>
                    {bookingBio.length}/200
                  </div>
                </div>

                {/* Modalidades */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Modalidades disponibles</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[['presencial','Presencial'],['videollamada','Videollamada'],['telefonica','Telefónica']].map(([val, lbl]) => (
                      <label key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={bookingModalidades.includes(val)} onChange={e => {
                          if (e.target.checked) setBookingModalidades(m => [...m, val])
                          else setBookingModalidades(m => m.filter(x => x !== val))
                        }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                        {lbl}
                      </label>
                    ))}
                  </div>
                </div>

                <ToggleRow
                  name="Pedir DNI al reservar"
                  desc="El paciente tiene que completar su DNI para poder reservar."
                  on={bookingRequiereDni}
                  onChange={() => setBookingRequiereDni(v => !v)}
                />

                <ToggleRow
                  name="Pedir fecha de nacimiento al reservar"
                  desc="El paciente tiene que completar su fecha de nacimiento para poder reservar."
                  on={bookingRequiereFechaNacimiento}
                  onChange={() => setBookingRequiereFechaNacimiento(v => !v)}
                />

                {/* Buffer y anticipación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Buffer entre turnos (min)</label>
                    <input type="number" min={0} max={240} value={bookingTiempoEntre} onChange={e => setBookingTiempoEntre(Number(e.target.value))}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Anticipación mínima (minutos)</label>
                    <input type="number" min={0} max={10080} value={bookingAnticipacion} onChange={e => setBookingAnticipacion(Number(e.target.value))}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Ej: 60 = 1 hora de anticipación.</p>
                  </div>
                </div>
              </Accordion>

              <div style={secFootStyle}>
                {bookingError && (
                  <span style={{ fontSize: 12, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                    {bookingError}
                  </span>
                )}
                {bookingSaved && !bookingError && (
                  <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                    Cambios guardados
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button type="submit" disabled={bookingLoading} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  cursor: bookingLoading ? 'not-allowed' : 'pointer',
                  border: 'none', background: 'var(--ink)', color: 'white',
                  opacity: bookingLoading ? 0.7 : 1,
                }}>
                  {bookingLoading ? 'Guardando...' : bookingSaved ? '✓ Guardado' : 'Guardar configuración'}
                </button>
              </div>
            </form>
            </>
          )}

          {currentGroup === 'equipo' && mostrarColaboradoras && (
            <Accordion title="Asistentes" desc="Invitá a tu secretaria o asistente para que gestione la agenda y los pacientes en tu nombre." defaultOpen>
              <ColaboradorasConfig />
            </Accordion>
          )}

          {currentGroup === 'cuenta' && (
            <>
          {/* ═══ SUSCRIPCIÓN ═══ */}
          <Accordion title="Tu plan" desc="Tu plan actual, próximo cobro y facturación." defaultOpen>
            <SuscripcionPortal
              profile={{
                estado_cuenta: profile.estado_cuenta,
                plan: profile.plan,
                trial_fin: profile.trial_fin,
                suscripcion_fin: profile.suscripcion_fin ?? null,
              }}
              suscripcion={suscripcion}
            />
          </Accordion>

          <Accordion title="Datos de facturación" desc="CUIT, condición frente al IVA y razón social para facturar tu suscripción de KLIA.">
            {facturacionError && (
              <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
                {facturacionError}
              </div>
            )}
            <form onSubmit={handleFacturacionSave}>
              <div className={`${grid2Class} mb-4`}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>CUIT <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-2)' }}>opcional</span></label>
                  <input
                    style={inputStyle}
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 20-12345678-6"
                    maxLength={13}
                    value={formatearCuit(perfilForm.cuit)}
                    onChange={e => setPerfilForm(p => ({ ...p, cuit: normalizarCuit(e.target.value) }))}
                  />
                  <span style={hintStyle}>Para facturar tu suscripción de KLIA.</span>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Condición frente al IVA <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-2)' }}>opcional</span></label>
                  <select style={inputStyle} value={perfilForm.condicion_iva} onChange={e => setPerfilForm(p => ({ ...p, condicion_iva: e.target.value }))}>
                    <option value="">Sin especificar</option>
                    {CONDICIONES_IVA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4" style={fieldStyle}>
                <label style={labelStyle}>Razón social <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-2)' }}>opcional</span></label>
                <input
                  style={inputStyle}
                  type="text"
                  maxLength={120}
                  value={perfilForm.razon_social}
                  onChange={e => setPerfilForm(p => ({ ...p, razon_social: e.target.value }))}
                />
              </div>
              <div style={secFootStyle}>
                {facturacionSaved && (
                  <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                    Guardado
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button type="submit" disabled={facturacionLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: facturacionLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: facturacionLoading ? 0.7 : 1 }}>
                  {facturacionLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </Accordion>

          <Accordion title="Seguridad" desc="Email de acceso y contraseña.">
            <div style={fieldStyle} className="mb-4">
              <label style={labelStyle}>Email</label>
              <input style={{ ...inputStyle, background: 'var(--surface-2)', color: 'var(--muted)' }} value={profile.email} readOnly />
            </div>
            <button
              type="button"
              disabled
              title="Próximamente"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'not-allowed', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', opacity: 0.8 }}
            >
              Cambiar contraseña (Próximamente)
            </button>
          </Accordion>

          <Accordion title="Eliminar cuenta" desc="Da de baja tu cuenta de KLIA.">
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Esta acción bloquea tu acceso a KLIA y cancela tu suscripción de Mercado Pago si tenés una activa.
            </p>
            <button
              type="button"
              onClick={() => { setEliminarEmailInput(''); setEliminarError(null); setEliminarOpen(true) }}
              style={{ background: 'transparent', border: '1px solid var(--danger)', color: '#DC2626', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '9px 14px', borderRadius: 8 }}
            >
              Eliminar cuenta
            </button>
          </Accordion>
            </>
          )}
        </GrupoShell>
      )}

      <SlideOver
        open={eliminarOpen}
        onClose={() => { if (!eliminarLoading) setEliminarOpen(false) }}
        title="Eliminar cuenta"
        width="sm"
        footer={(
          <div style={{ ...secFootStyle, marginTop: 0, paddingTop: 0, padding: '12px 20px' }}>
            <button
              type="button"
              onClick={() => setEliminarOpen(false)}
              disabled={eliminarLoading}
              style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: eliminarLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}
            >
              Cancelar
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={handleEliminarCuenta}
              disabled={eliminarLoading || eliminarEmailInput.trim().toLowerCase() !== profile.email?.toLowerCase()}
              style={{
                padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: 'none', color: 'white', background: 'var(--danger)',
                cursor: (eliminarLoading || eliminarEmailInput.trim().toLowerCase() !== profile.email?.toLowerCase()) ? 'not-allowed' : 'pointer',
                opacity: (eliminarLoading || eliminarEmailInput.trim().toLowerCase() !== profile.email?.toLowerCase()) ? 0.5 : 1,
              }}
            >
              {eliminarLoading ? 'Eliminando...' : 'Eliminar cuenta'}
            </button>
          </div>
        )}
      >
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
          Esta acción da de baja tu cuenta de KLIA. Al confirmar:
        </p>
        <ul style={{ margin: '0 0 20px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Tu acceso a KLIA se bloquea de inmediato.',
            'Si tenés una suscripción activa con Mercado Pago, se cancela.',
            'Tu link público de reservas se desactiva.',
            'Se desconectan tus integraciones (Google Calendar, Mercado Pago).',
            'Tus datos clínicos y de pagos se conservan por el tiempo que exige la ley, según nuestra política de privacidad.',
          ].map((texto) => (
            <li key={texto} style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{texto}</li>
          ))}
        </ul>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="eliminar-email-confirm">
            Escribí tu email ({profile.email}) para confirmar
          </label>
          <input
            id="eliminar-email-confirm"
            type="text"
            autoComplete="off"
            value={eliminarEmailInput}
            onChange={(e) => setEliminarEmailInput(e.target.value)}
            placeholder={profile.email ?? ''}
            style={inputStyle}
            disabled={eliminarLoading}
          />
        </div>

        {eliminarError && (
          <p style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', flexShrink: 0 }} />
            {eliminarError}
          </p>
        )}
      </SlideOver>
    </div>
  )
}
