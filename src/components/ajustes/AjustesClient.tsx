'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FirmaUploader from '@/components/ui/FirmaUploader'
import ObraSocialesConfig from '@/components/ajustes/ObraSocialesConfig'
import SuscripcionPortal from '@/components/ajustes/SuscripcionPortal'
import IntegracionesClient from '@/components/ajustes/IntegracionesClient'
import { ESPECIALIDADES } from '@/lib/especialidades'
import { PAISES, PAISES_PROVINCIAS } from '@/lib/geografica'
import type { Profile, ProfesionalObraSocial } from '@/types/database'

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

// ── Section icons ──────────────────────────────────────────────────────
const icnSvg = (d: string | React.ReactNode) => (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
    {d}
  </svg>
)
const ICONS: Record<string, React.ReactNode> = {
  perfil:       icnSvg(<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>),
  horarios:     icnSvg(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  cobros:       icnSvg(<><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></>),
  politica:     icnSvg(<><path d="M3 10h18M5 6h14l1 14H4L5 6z"/><path d="M9 6V4a3 3 0 0 1 6 0v2"/></>),
  obras:        icnSvg(<path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"/>),
  integraciones:icnSvg(<><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M8 5h8M8 19h8M5 8v8M19 8v8"/></>),
  firmas:       icnSvg(<path d="M12 20h9M16 3l5 5-11 11H5v-5z"/>),
  'link-publico': icnSvg(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>),
  plan:         icnSvg(<path d="M12 2l3 7 7 .5-5.5 4.5L18 21l-6-4-6 4 1.5-7L2 9.5 9 9z"/>),
  cuenta:       icnSvg(<><path d="M12 1l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V5l8-4z"/><path d="M9 12l2 2 4-4"/></>),
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

// ── HORAS arrays ──────────────────────────────────────────────────────
const HORAS_INICIO = Array.from({ length: 24 }, (_, i) => i)
const HORAS_FIN = Array.from({ length: 23 }, (_, i) => i + 1)

// ── Main component ─────────────────────────────────────────────────────
export default function AjustesClient({ profile, obrasSociales, suscripcion, googleConectado, googleSyncEnabled, mpConectado, mpEmail, mpNombre, cobrosVentanaHoras, cobrosCancelacionHoras, cobrosPrecioSesion, cobrosMoneda, cobrosMessagePaciente }: Props) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState('perfil')

  // Perfil state
  const [perfilForm, setPerfilForm] = useState({
    especialidad: profile.especialidad ?? '',
    matricula: profile.matricula ?? '',
    telefono: profile.telefono ?? '',
    pais: profile.pais ?? 'Argentina',
    provincia: profile.provincia ?? '',
    localidad: profile.localidad ?? '',
    direccion: profile.direccion ?? '',
  })
  const [perfilLoading, setPerfilLoading] = useState(false)
  const [perfilSaved, setPerfilSaved] = useState(false)
  const [perfilError, setPerfilError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Horarios state
  const [horaInicio, setHoraInicio] = useState(profile.agenda_hora_inicio ?? 7)
  const [horaFin, setHoraFin] = useState(profile.agenda_hora_fin ?? 21)
  const [horarioLoading, setHorarioLoading] = useState(false)
  const [horarioSaved, setHorarioSaved] = useState(false)

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

  // Cobros y pagos state
  const [cobrosVentana, setCobrosVentana] = useState(cobrosVentanaHoras)
  const [cobrosCancelacion, setCobrosCancelacion] = useState(cobrosCancelacionHoras)
  const [cobrosPrecio, setCobrosPrecio] = useState(cobrosPrecioSesion?.toString() ?? '')
  const [cobrosMonedaVal, setCobrosMonedaVal] = useState(cobrosMoneda)
  const [cobrosMensaje, setCobrosMensaje] = useState(cobrosMessagePaciente)
  const [cobrosLoading, setCobrosLoading] = useState(false)
  const [cobrosSaved, setCobrosSaved] = useState(false)

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
  const [bookingRequierePago, setBookingRequierePago] = useState<boolean>((p.booking_requiere_pago as boolean | null) ?? true)
  const [bookingSlug] = useState<string>((p.booking_slug as string | null) ?? '')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingSaved, setBookingSaved] = useState(false)
  const [bookingCopied, setBookingCopied] = useState(false)


  // ── IntersectionObserver for scroll-spy ───────────────────────────
  useEffect(() => {
    const sections = document.querySelectorAll('.ajustes-sec[id]')
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) })
    }, { rootMargin: '-100px 0px -60% 0px' })
    sections.forEach(s => io.observe(s))
    return () => io.disconnect()
  }, [])

  function scrollToSection(id: string) {
    const el = document.getElementById(id)
    if (el) {
      const offset = el.getBoundingClientRect().top + window.scrollY - 70
      window.scrollTo({ top: offset, behavior: 'smooth' })
    }
  }

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

  // ── Perfil save ────────────────────────────────────────────────────
  async function handlePerfilSave(e: React.FormEvent) {
    e.preventDefault()
    setPerfilLoading(true); setPerfilError(null); setPerfilSaved(false)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      especialidad: perfilForm.especialidad || null,
      matricula: perfilForm.matricula || null,
      telefono: perfilForm.telefono || null,
      pais: perfilForm.pais || null,
      provincia: perfilForm.provincia || null,
      localidad: perfilForm.localidad || null,
      direccion: perfilForm.direccion || null,
    }).eq('id', profile.id)
    if (error) { setPerfilError('Error al guardar.'); setPerfilLoading(false); return }
    setPerfilSaved(true); setPerfilLoading(false); router.refresh()
  }

  // ── Horario save ───────────────────────────────────────────────────
  async function handleHorarioSave() {
    setHorarioLoading(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ agenda_hora_inicio: horaInicio, agenda_hora_fin: horaFin }).eq('id', profile.id)
    setHorarioLoading(false); setHorarioSaved(true)
    setTimeout(() => setHorarioSaved(false), 2500)
    router.refresh()
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
      cobros_precio_sesion: cobrosPrecio ? parseFloat(cobrosPrecio) : null,
      cobros_moneda: cobrosMonedaVal,
      cobros_mensaje_paciente: cobrosMensaje || null,
    } as never).eq('id', profile.id)
    setCobrosLoading(false); setCobrosSaved(true)
    setTimeout(() => setCobrosSaved(false), 2500)
  }

  // ── Booking save ───────────────────────────────────────────────────
  const [bookingError, setBookingError] = useState<string | null>(null)

  async function handleBookingSave(e: React.FormEvent) {
    e.preventDefault()
    setBookingError(null)
    if (bookingBio && bookingBio.length > 200) {
      setBookingError('Bio pública no puede exceder 200 caracteres')
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
      booking_requiere_pago: bookingRequierePago,
    } as never).eq('id', profile.id)
    setBookingLoading(false); setBookingSaved(true)
    setTimeout(() => setBookingSaved(false), 2500)
  }


  // ── Firma update ───────────────────────────────────────────────────
  async function updateFirmaDB(campo: 'firma_url' | 'firma_sello_url', url: string | null) {
    const supabase = createClient()
    await supabase.from('profiles').update({ [campo]: url }).eq('id', profile.id)
  }

  const initials = `${profile.nombre?.[0] ?? ''}${profile.apellido?.[0] ?? ''}`.toUpperCase()

  // ── Sub-nav links ──────────────────────────────────────────────────
  const navItems = [
    { id: 'perfil', label: 'Perfil profesional' },
    { id: 'horarios', label: 'Horarios' },
    { id: 'cobros-pagos', label: 'Cobros y pagos' },
    { id: 'politica', label: 'Política de cobros' },
    { id: 'feriados', label: 'Feriados' },
    { id: 'obras', label: 'Obras sociales' },
    { id: 'integraciones', label: 'Integraciones' },
    { id: 'firmas', label: 'Firmas digitales' },
    { id: 'link-publico', label: 'Link público' },
    { id: 'sep' },
    { id: 'plan', label: 'Suscripción y plan' },
    { id: 'cuenta', label: 'Cuenta y seguridad' },
  ]

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

      {/* Mobile chip nav — horizontal scroll strip */}
      <div className="md:hidden mb-5">
        <div
          className="ajustes-nav flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {navItems.filter(i => i.id !== 'sep').map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id!)}
              style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeSection === item.id ? 600 : 500,
                background: activeSection === item.id ? 'var(--ink)' : 'var(--surface-2)',
                color: activeSection === item.id ? 'white' : 'var(--ink-2)',
                whiteSpace: 'nowrap',
                transition: 'background .12s ease, color .12s ease',
              }}
            >
              <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {ICONS[item.id!]}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings grid — desktop: sidebar + content; mobile: content only */}
      <div className="md:grid md:gap-8 md:items-start" style={{ gridTemplateColumns: '240px 1fr' }}>

        {/* Desktop sidebar nav */}
        <nav className="hidden md:flex md:flex-col md:sticky gap-1 p-1" style={{ top: 70 }}>
          {navItems.map(item =>
            item.id === 'sep' ? (
              <div key="sep" style={{ height: 1, background: 'var(--border)', margin: '6px 12px' }} />
            ) : (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id!)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  color: activeSection === item.id ? 'white' : 'var(--ink-2)',
                  fontSize: 13.5, fontWeight: activeSection === item.id ? 600 : 500,
                  background: activeSection === item.id ? 'var(--ink)' : 'transparent',
                  transition: 'background .12s ease, color .12s ease',
                  textAlign: 'left', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (activeSection !== item.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
                }}
                onMouseLeave={e => {
                  if (activeSection !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span style={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {ICONS[item.id!]}
                </span>
                {item.label}
              </button>
            )
          )}
        </nav>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* ═══ PERFIL PROFESIONAL ═══ */}
          <section className={`ajustes-sec${activeSection !== 'perfil' ? ' hidden md:block' : ''}`} id="perfil" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('var(--accent-soft)', 'var(--accent)')}>{ICONS.perfil}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Perfil profesional</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Datos visibles para tus pacientes y colegas en Interconsultas.</p>
              </div>
            </div>

            {/* Avatar */}
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

            <form onSubmit={handlePerfilSave}>
              {/* Read-only identity */}
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
                  <label style={labelStyle}>Matrícula profesional</label>
                  <input style={inputStyle} type="text" placeholder="MP 12345" value={perfilForm.matricula} onChange={e => setPerfilForm(p => ({ ...p, matricula: e.target.value }))} />
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

              <div style={secFootStyle}>
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
          </section>

          {/* ═══ HORARIOS ═══ */}
          <section className={`ajustes-sec${activeSection !== 'horarios' ? ' hidden md:block' : ''}`} id="horarios" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('#FFF4E4', 'var(--warn)')}>{ICONS.horarios}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Horarios de atención</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Define los días y franjas horarias visibles en tu agenda.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Hora de inicio</label>
                <select style={{ ...inputStyle, height: 38, paddingRight: 12 }} value={horaInicio} onChange={e => { setHoraInicio(Number(e.target.value)); setHorarioSaved(false) }}>
                  {HORAS_INICIO.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Hora de fin</label>
                <select style={{ ...inputStyle, height: 38, paddingRight: 12 }} value={horaFin} onChange={e => { setHoraFin(Number(e.target.value)); setHorarioSaved(false) }}>
                  {HORAS_FIN.filter(h => h > horaInicio).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                </select>
              </div>
            </div>

            <div style={secFootStyle}>
              {horarioSaved && (
                <span style={{ fontSize: 12, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                  Cambios guardados
                </span>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={handleHorarioSave} disabled={horarioLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: horarioLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: horarioLoading ? 0.7 : 1 }}>
                {horarioSaved ? '✓ Guardado' : horarioLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </section>

          {/* ═══ COBROS Y PAGOS ═══ */}
          <section className={`ajustes-sec${activeSection !== 'cobros-pagos' ? ' hidden md:block' : ''}`} id="cobros-pagos" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('var(--ok-soft)', 'var(--ok)')}>{ICONS.cobros}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Cobros y pagos</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Configurá cómo y cuándo se cobran las sesiones agendadas desde tu link público.</p>
              </div>
              {mpConectado && (
                <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--ok-soft)', color: 'var(--ok)', flexShrink: 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                  Mercado Pago vinculado
                </div>
              )}
            </div>

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

              {/* Precio de sesión */}
              <div style={{ paddingTop: 18, borderTop: '1px solid var(--border)', marginBottom: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Precio de sesión — link público</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.55 }}>Este precio se aplica cuando un paciente agenda desde tu link público.</div>
                <div className={grid2Class} style={{ maxWidth: 480 }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Moneda</label>
                    <select style={inputStyle} value={cobrosMonedaVal} onChange={e => setCobrosMonedaVal(e.target.value)}>
                      <option value="ARS">ARS — Peso argentino</option>
                      <option value="USD">USD — Dólar</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Monto por sesión</label>
                    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <span style={{ padding: '0 12px', fontSize: 13, color: 'var(--muted)', fontWeight: 500, background: 'var(--surface-2)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>$</span>
                      <input style={{ ...inputStyle, border: 'none', flex: 1, borderRadius: 0 }} type="number" min="0" step="0.01" placeholder="60000" value={cobrosPrecio} onChange={e => setCobrosPrecio(e.target.value)} />
                    </div>
                  </div>
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
          </section>

          {/* ═══ POLÍTICA DE COBROS ═══ */}
          <section className={`ajustes-sec${activeSection !== 'politica' ? ' hidden md:block' : ''}`} id="politica" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('var(--warn-soft)', '#B45309')}>{ICONS.politica}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Política de cobros</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Define cómo se calculan las deudas de tus pacientes.</p>
              </div>
            </div>

            <ToggleRow
              name="Cobrar sesiones no asistidas"
              desc={<>Si está activo, las sesiones marcadas como <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>&ldquo;No asistió&rdquo;</strong> se incluyen en la deuda del paciente. Podés configurar excepciones por paciente desde su ficha.</>}
              on={cobrar}
              onChange={handleCobrarToggle}
              disabled={cobrarGuardando}
            />
            <ToggleRow
              name="Cobrar cancelaciones tardías"
              desc={<>Cobrar sesiones canceladas con menos de <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>24 hs</strong> de anticipación.</>}
              on={false}
              onChange={() => {}}
            />
            <div style={{ ...({ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0' }), borderBottom: 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Recordatorio automático de cobros</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>Enviar un email al paciente el primer día de cada mes con el detalle de sesiones adeudadas.</div>
              </div>
              <Toggle on={true} onChange={() => {}} />
            </div>
          </section>

          {/* ═══ FERIADOS ═══ */}
          <section className={`ajustes-sec${activeSection !== 'feriados' ? ' hidden md:block' : ''}`} id="feriados" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('#FEF3C7', '#92400E')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Feriados y días no laborales</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Configurá cómo KLIA maneja los feriados en tu agenda y link público.</p>
              </div>
            </div>
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
          </section>

          {/* ═══ OBRAS SOCIALES ═══ */}
          <section className={`ajustes-sec${activeSection !== 'obras' ? ' hidden md:block' : ''}`} id="obras" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('#ECF0FF', '#002d72')}>{ICONS.obras}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Obras sociales y prepagas</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Configurá honorarios y datos de cada obra social para tus liquidaciones.</p>
              </div>
            </div>
            <ObraSocialesConfig initialList={obrasSociales} terapeutaId={profile.id} />
          </section>

          {/* ═══ INTEGRACIONES ═══ */}
          <section className={`ajustes-sec${activeSection !== 'integraciones' ? ' hidden md:block' : ''}`} id="integraciones" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('var(--accent-soft)', 'var(--accent)')}>{ICONS.integraciones}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Integraciones</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Conectá KLIA con tus herramientas favoritas. Los datos se sincronizan en tiempo real.</p>
              </div>
            </div>
            <Suspense fallback={null}>
              <IntegracionesClient
                conectado={googleConectado}
                syncEnabled={googleSyncEnabled}
                mpConectado={mpConectado}
                mpEmail={mpEmail}
                mpNombre={mpNombre}
              />
            </Suspense>
          </section>

          {/* ═══ FIRMAS DIGITALES ═══ */}
          <section className={`ajustes-sec${activeSection !== 'firmas' ? ' hidden md:block' : ''}`} id="firmas" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('var(--violet-soft)', 'var(--violet)')}>{ICONS.firmas}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Firmas digitales</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Configurá tu firma y sello para planillas, informes y consentimientos.</p>
              </div>
            </div>

            <div className={`${grid2Class} mb-5`}>
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

            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--accent-soft-2)', border: '1px solid var(--accent-soft)',
              fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55,
            }}>
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--accent)', strokeWidth: 2, fill: 'none', flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <span>Estas firmas se aplican automáticamente al final de los documentos exportados. <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>Tienen validez legal en Argentina</strong> según Ley 25.506.</span>
            </div>
          </section>

          {/* ═══ LINK PÚBLICO ═══ */}
          <section className={`ajustes-sec${activeSection !== 'link-publico' ? ' hidden md:block' : ''}`} id="link-publico" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('#EFF4FF', '#2563EB')}>{ICONS['link-publico']}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Link público de reservas</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Compartí tu link personal para que tus pacientes reserven turnos online.</p>
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

            <form onSubmit={handleBookingSave}>
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

              {/* Duraciones y buffer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ marginBottom: 18 }}>
                {[
                  { label: 'Duración sesión (min)', value: bookingDuracionSesion, set: setBookingDuracionSesion },
                  { label: 'Duración entrevista (min)', value: bookingDuracionEntrevista, set: setBookingDuracionEntrevista },
                  { label: 'Buffer entre turnos (min)', value: bookingTiempoEntre, set: setBookingTiempoEntre },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
                    <input type="number" min={5} max={240} value={value} onChange={e => set(Number(e.target.value))}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>

              {/* Anticipación */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Anticipación mínima (minutos)</label>
                <input type="number" min={0} max={10080} value={bookingAnticipacion} onChange={e => setBookingAnticipacion(Number(e.target.value))}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Mínimo de minutos de anticipación para reservar. Ej: 60 = 1 hora de anticipación.</p>
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

              {/* Precios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 18 }}>
                {[
                  { label: 'Precio sesión', value: bookingPrecioSesion, set: setBookingPrecioSesion },
                  { label: 'Precio entrevista inicial', value: bookingPrecioEntrevista, set: setBookingPrecioEntrevista },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
                    <input type="number" min={0} value={value} onChange={e => set(e.target.value)} placeholder="0"
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 40, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>

              {/* Requiere pago */}
              <ToggleRow
                name="Requiere pago para confirmar"
                desc="El turno se confirma solo cuando el paciente completa el pago con Mercado Pago."
                on={bookingRequierePago}
                onChange={() => setBookingRequierePago(v => !v)}
              />

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
          </section>

          {/* ═══ SUSCRIPCIÓN ═══ */}
          <section className={`ajustes-sec${activeSection !== 'plan' ? ' hidden md:block' : ''}`} id="plan" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('#FEF3E2', '#D97706')}>{ICONS.plan}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Suscripción y plan</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Tu plan actual, próximo cobro y facturación.</p>
              </div>
            </div>
            <SuscripcionPortal
              profile={{
                estado_cuenta: profile.estado_cuenta,
                plan: profile.plan,
                trial_fin: profile.trial_fin,
                suscripcion_fin: profile.suscripcion_fin ?? null,
              }}
              suscripcion={suscripcion}
            />
          </section>

          {/* ═══ CUENTA Y SEGURIDAD ═══ */}
          <section className={`ajustes-sec${activeSection !== 'cuenta' ? ' hidden md:block' : ''}`} id="cuenta" style={secStyle}>
            <div style={secHdrStyle}>
              <div style={icnStyle('var(--danger-soft)', 'var(--danger)')}>{ICONS.cuenta}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>Cuenta y seguridad</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Email de acceso, contraseña y autenticación de dos factores.</p>
              </div>
            </div>

            <ToggleRow
              name="Autenticación en dos pasos (2FA)"
              desc="Agrega una capa extra de seguridad usando una app de autenticación."
              on={false}
              onChange={() => {}}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Alertas de inicio de sesión</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>Recibí un email cuando se acceda a tu cuenta desde un dispositivo nuevo.</div>
              </div>
              <Toggle on={true} onChange={() => {}} />
            </div>

            <div style={secFootStyle}>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}>
                Cambiar contraseña
              </button>
              <div style={{ flex: 1 }} />
              <button style={{ background: 'transparent', border: 'none', color: '#DC2626', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>
                Eliminar cuenta
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
