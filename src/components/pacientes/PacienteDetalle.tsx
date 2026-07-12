'use client'

import './facturacion.css'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, differenceInYears } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn, formatNombreCompleto } from '@/lib/utils'
import type { Paciente, MedicacionPaciente, Interconsulta, ProfesionalObraSocial, TurnoRow } from '@/types/database'
import type { PacienteTabKey } from './PacienteTabs'
import { PAISES, PLANES_POR_OS } from '@/lib/data/salud-ar'
import SlideOver from '@/components/ui/SlideOver'
import FirmaUploader from '@/components/ui/FirmaUploader'
import MonedaSelector from '@/components/ui/MonedaSelector'
import { type Moneda, formatearMonto } from '@/lib/monedas'
import { calcularDeudaMes, resolverPoliticaInasistencia } from '@/lib/deuda'
import ArchivosTab from './ArchivosTab'
import InformesTab from './InformesTab'
import AdmisionTab from './AdmisionTab'
import RegistrarPagoSlide, { type TurnoDeuda } from '@/components/cobros/RegistrarPagoSlide'
import PlanillaOSSlide from './PlanillaOSSlide'
import TabComposicionCorporal from '@/components/nutricion/TabComposicionCorporal'

const inputCls =
  'w-full bg-surface-container-high border border-outline-variant/15 text-on-surface rounded-lg px-4 py-3 text-sm focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none'
const labelCls =
  'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-2'

function CurrencyInput({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (raw: string) => void
  className?: string
}) {
  const [focused, setFocused] = useState(false)

  const displayValue =
    !focused && value
      ? new Intl.NumberFormat('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parseFloat(value) || 0)
      : value

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^\d.,]/g, '')
    raw = raw.replace(',', '.')
    const parts = raw.split('.')
    if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('')
    onChange(raw)
  }

  return (
    <input
      type="text"
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={handleChange}
      placeholder="0,00"
      className={className}
      inputMode="decimal"
    />
  )
}

function normalizePhone(t: string | null | undefined): string | null {
  if (!t) return null
  return t.replace(/[^\d+]/g, '')
}

function buildForm(p: Paciente) {
  return {
    nombre: p.nombre,
    apellido: p.apellido,
    dni: p.dni ?? '',
    fecha_nacimiento: p.fecha_nacimiento ?? '',
    telefono: p.telefono ?? '',
    email: p.email ?? '',
    genero: p.genero ?? '',
    nacionalidad: p.nacionalidad ?? '',
    estado_civil: p.estado_civil ?? '',
    domicilio: p.domicilio ?? '',
    ocupacion: p.ocupacion ?? '',
    contacto_emergencia_nombre: p.contacto_emergencia_nombre ?? '',
    contacto_emergencia_telefono: p.contacto_emergencia_telefono ?? '',
    obra_social: p.obra_social ?? '',
    plan_obra_social: p.plan_obra_social ?? '',
    os_nombre_libre: p.os_nombre_libre ?? '',
    os_plan_libre: p.os_plan_libre ?? '',
    os_config_id: p.os_config_id ?? '',
    numero_afiliado: p.numero_afiliado ?? '',
    numero_autorizacion: p.numero_autorizacion ?? '',
    autorizacion_vigencia_desde: p.autorizacion_vigencia_desde ?? '',
    autorizacion_vigencia_hasta: p.autorizacion_vigencia_hasta ?? '',
    modalidad_tratamiento: p.modalidad_tratamiento ?? '',
    frecuencia_sesiones: p.frecuencia_sesiones ?? '',
    honorarios: p.honorarios != null ? String(p.honorarios) : '',
    moneda_preferida: (p.moneda_preferida ?? 'ARS') as Moneda,
    cobrar_inasistencias: p.cobrar_inasistencias ?? null,
    motivo_consulta: p.motivo_consulta ?? '',
    notas: p.notas ?? '',
    codigo_diagnostico: p.codigo_diagnostico ?? '',
    gravedad_estimada: p.gravedad_estimada ?? '',
  }
}

type MedicacionEdit = { farmaco: string; dosis: string; frecuencia: string; prescriptor: string }
const EMPTY_MED: MedicacionEdit = { farmaco: '', dosis: '', frecuencia: '', prescriptor: '' }

interface ProfesionalData {
  nombre: string
  apellido: string
  especialidad: string | null
  matricula: string | null
  matricula_tipo: string | null
  matricula_provincia: string | null
  localidad: string | null
  provincia: string | null
  direccion: string | null
  email: string
  telefono: string | null
  firma_sello_url: string | null
}

function toMedicacionEdit(m: MedicacionPaciente): MedicacionEdit {
  return { farmaco: m.farmaco, dosis: m.dosis ?? '', frecuencia: m.frecuencia ?? '', prescriptor: m.prescriptor ?? '' }
}

export default function PacienteDetalle({
  paciente,
  medicacionesIniciales = [],
  interconsultas = [],
  initialEdit = false,
  activeTab = 'datos',
  obrasSociales = [],
  profObrasSociales = [],
  turnos = [],
  profesionalCobrarInasistencias = false,
  profesionalData = null,
  turnoRecurrente = null,
  tieneDrive = false,
}: {
  paciente: Paciente
  medicacionesIniciales?: MedicacionPaciente[]
  interconsultas?: Interconsulta[]
  initialEdit?: boolean
  activeTab?: PacienteTabKey
  obrasSociales?: string[]
  profObrasSociales?: ProfesionalObraSocial[]
  turnos?: TurnoRow[]
  profesionalCobrarInasistencias?: boolean
  profesionalData?: ProfesionalData | null
  turnoRecurrente?: { dia_semana: number; hora: string } | null
  tieneDrive?: boolean
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(initialEdit)
  const [form, setForm] = useState(() => {
    const base = buildForm(paciente)
    if (!base.os_config_id && base.obra_social) {
      const matched = profObrasSociales.find(o => o.nombre === base.obra_social)
      if (matched) base.os_config_id = matched.id
    }
    return base
  })
  const [medicaciones, setMedicaciones] = useState<MedicacionEdit[]>(() =>
    medicacionesIniciales.map(toMedicacionEdit)
  )
  const [activo, setActivo] = useState(paciente.activo)
  const [seriesActivas, setSeriesActivas] = useState(0)
  const [checkingSeriesActivas, setCheckingSeriesActivas] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planesDisponibles = PLANES_POR_OS[form.obra_social] ?? []

  function addMedicacion() {
    setMedicaciones((prev) => [...prev, { ...EMPTY_MED }])
  }

  function removeMedicacion(idx: number) {
    setMedicaciones((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateMedicacion(idx: number, field: keyof MedicacionEdit, value: string) {
    setMedicaciones((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleObraChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nombre = e.target.value
    const matchedOS = profObrasSociales.find(o => o.nombre === nombre)
    setForm((prev) => ({
      ...prev,
      obra_social: nombre,
      plan_obra_social: '',
      os_nombre_libre: '',
      os_plan_libre: '',
      os_config_id: matchedOS?.id ?? '',
    }))
  }


  async function handleToggleActivo(newValue: boolean) {
    setActivo(newValue)
    if (!newValue && paciente.activo) {
      setCheckingSeriesActivas(true)
      const supabase = createClient()
      const { count } = await supabase
        .from('turnos_recurrentes')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', paciente.id)
        .eq('activo', true)
      setSeriesActivas(count ?? 0)
      setCheckingSeriesActivas(false)
    } else {
      setSeriesActivas(0)
    }
  }

  function handleCancelar() {
    setForm(buildForm(paciente))
    setMedicaciones(medicacionesIniciales.map(toMedicacionEdit))
    setActivo(paciente.activo)
    setSeriesActivas(0)
    setError(null)
    setEditando(false)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('pacientes')
      .update({
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        telefono: form.telefono || null,
        email: form.email || null,
        genero: form.genero || null,
        nacionalidad: form.nacionalidad || null,
        estado_civil: form.estado_civil || null,
        domicilio: form.domicilio || null,
        ocupacion: form.ocupacion || null,
        contacto_emergencia_nombre: form.contacto_emergencia_nombre || null,
        contacto_emergencia_telefono: form.contacto_emergencia_telefono || null,
        obra_social: form.obra_social === 'Otra' ? 'Otra' : (form.obra_social || null),
        plan_obra_social: form.obra_social === 'Otra' ? null : (form.plan_obra_social || null),
        os_nombre_libre: form.obra_social === 'Otra' ? (form.os_nombre_libre.trim() || null) : null,
        os_plan_libre: form.obra_social === 'Otra' ? (form.os_plan_libre.trim() || null) : null,
        os_pendiente_validacion: form.obra_social === 'Otra',
        os_config_id: form.os_config_id || null,
        numero_afiliado: form.numero_afiliado || null,
        numero_autorizacion: form.numero_autorizacion || null,
        autorizacion_vigencia_desde: form.autorizacion_vigencia_desde || null,
        autorizacion_vigencia_hasta: form.autorizacion_vigencia_hasta || null,
        modalidad_tratamiento: form.modalidad_tratamiento || null,
        frecuencia_sesiones: form.frecuencia_sesiones || null,
        honorarios: form.honorarios ? parseFloat(form.honorarios) : null,
        moneda_preferida: form.moneda_preferida || 'ARS',
        cobrar_inasistencias: form.cobrar_inasistencias,
        motivo_consulta: form.motivo_consulta || null,
        notas: form.notas || null,
        codigo_diagnostico: form.codigo_diagnostico || null,
        gravedad_estimada: form.gravedad_estimada || null,
        activo,
      })
      .eq('id', paciente.id)
    if (dbError) {
      setError('Error al guardar los cambios. Intentá de nuevo.')
      setLoading(false)
      return
    }

    if (form.obra_social === 'Otra' && form.os_nombre_libre.trim()) {
      const nombre = form.os_nombre_libre.trim()
      const { data: existing } = await supabase
        .from('obras_sociales')
        .select('id, veces_ingresada')
        .ilike('nombre', nombre)
        .maybeSingle()
      if (existing) {
        await supabase.from('obras_sociales').update({ veces_ingresada: (existing.veces_ingresada ?? 1) + 1 }).eq('id', existing.id)
      } else {
        await supabase.from('obras_sociales').insert({ nombre, plan: form.os_plan_libre.trim() || null, validada: false, veces_ingresada: 1 })
      }
    }


    // Si el paciente pasó de activo a inactivo, liberar series y turnos futuros
    if (!activo && paciente.activo) {
      await supabase
        .from('turnos_recurrentes')
        .update({ activo: false })
        .eq('paciente_id', paciente.id)
        .eq('activo', true)
      await supabase
        .from('turnos')
        .delete()
        .eq('paciente_id', paciente.id)
        .not('serie_recurrente_id', 'is', null)
        .in('estado', ['pendiente', 'confirmado'])
        .gte('fecha_hora', new Date().toISOString())
    }

    // Sync medications: replace all existing ones
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error: delError } = await supabase
        .from('medicacion_paciente')
        .delete()
        .eq('paciente_id', paciente.id)

      if (delError) {
        console.error('Error eliminando medicaciones:', delError)
        setError(`Error al guardar medicaciones: ${delError.message}`)
        setLoading(false)
        return
      }

      const medsFiltradas = medicaciones.filter((m) => m.farmaco.trim())
      if (medsFiltradas.length > 0) {
        const { error: insError } = await supabase.from('medicacion_paciente').insert(
          medsFiltradas.map((m) => ({
            terapeuta_id: user.id,
            paciente_id: paciente.id,
            farmaco: m.farmaco.trim(),
            dosis: m.dosis || null,
            frecuencia: m.frecuencia || null,
            prescriptor: m.prescriptor || null,
          }))
        )
        if (insError) {
          console.error('Error insertando medicaciones:', insError)
          setError(`Error al guardar medicaciones: ${insError.message}`)
          setLoading(false)
          return
        }
      }
    }

    setEditando(false)
    setLoading(false)
    router.refresh()
  }

  if (editando) {
    return (
      <>
        <datalist id="pd-paises">
          {PAISES.map((p) => <option key={p} value={p} />)}
        </datalist>
        <datalist id="pd-planes">
          {planesDisponibles.map((p) => <option key={p} value={p} />)}
        </datalist>
        <form onSubmit={handleGuardar} className="mt-6 flex flex-col gap-6 pb-10">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Datos de identidad */}
        <FormCard title="Datos de Identidad" icon="badge">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Nombre <span className="text-error">*</span></label>
              <input name="nombre" type="text" value={form.nombre} onChange={handleChange} required placeholder="María" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apellido <span className="text-error">*</span></label>
              <input name="apellido" type="text" value={form.apellido} onChange={handleChange} required placeholder="García" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>DNI</label>
              <input name="dni" type="text" value={form.dni} onChange={handleChange} placeholder="12.345.678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de Nacimiento</label>
              <input name="fecha_nacimiento" type="date" value={form.fecha_nacimiento} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input name="telefono" type="tel" value={form.telefono} onChange={handleChange} placeholder="+54 11 1234-5678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="paciente@email.com" className={inputCls} />
              {!form.email && (
                <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                  Sin email no se envían recordatorios automáticos de turnos.
                </p>
              )}
            </div>
          </div>
        </FormCard>

        {/* Información personal */}
        <FormCard title="Información Personal" icon="person">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Género</label>
              <select name="genero" value={form.genero} onChange={handleChange} className={inputCls}>
                <option value="">Seleccionar...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="NB">No Binario</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nacionalidad</label>
              <input name="nacionalidad" type="text" value={form.nacionalidad} onChange={handleChange} placeholder="Argentina" list="pd-paises" autoComplete="off" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estado Civil</label>
              <select name="estado_civil" value={form.estado_civil} onChange={handleChange} className={inputCls}>
                <option value="">Seleccionar...</option>
                <option value="Soltero/a">Soltero/a</option>
                <option value="Casado/a">Casado/a</option>
                <option value="Divorciado/a">Divorciado/a</option>
                <option value="Viudo/a">Viudo/a</option>
                <option value="En pareja">En pareja</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ocupación</label>
              <input name="ocupacion" type="text" value={form.ocupacion} onChange={handleChange} placeholder="Docente, ingeniero..." className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Domicilio</label>
              <input name="domicilio" type="text" value={form.domicilio} onChange={handleChange} placeholder="Av. Corrientes 1234, CABA" className={inputCls} />
            </div>
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 pt-4 border-t border-outline-variant/20">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-4">Contacto de emergencia</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Nombre Completo</label>
                  <input name="contacto_emergencia_nombre" type="text" value={form.contacto_emergencia_nombre} onChange={handleChange} placeholder="Juan García" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input name="contacto_emergencia_telefono" type="tel" value={form.contacto_emergencia_telefono} onChange={handleChange} placeholder="+54 11 1234-5678" className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </FormCard>

        {/* Obra social y tratamiento */}
        <FormCard title="Obra Social y Tratamiento" icon="health_and_safety">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls}>Obra Social / Prepaga</label>
              <select name="obra_social" value={form.obra_social} onChange={handleObraChange} className={inputCls}>
                <option value="">Sin obra social / Particular</option>
                {obrasSociales.map((o) => <option key={o} value={o}>{o}</option>)}
                <option value="Otra">Otra (no figura en la lista)</option>
              </select>
            </div>
            {form.obra_social === 'Otra' ? (
              <>
                <div>
                  <label className={labelCls}>Nombre de la obra social <span className="text-error">*</span></label>
                  <input name="os_nombre_libre" type="text" value={form.os_nombre_libre} onChange={handleChange} placeholder="Ej: OSJERA, IOSE Regional..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Plan <span className="text-on-surface-variant font-normal">(opcional)</span></label>
                  <input name="os_plan_libre" type="text" value={form.os_plan_libre} onChange={handleChange} placeholder="Plan 310, Básico..." className={inputCls} />
                </div>
              </>
            ) : form.obra_social ? (
              <>
                <div>
                  <label className={labelCls}>Plan</label>
                  <input name="plan_obra_social" type="text" value={form.plan_obra_social} onChange={handleChange} placeholder={planesDisponibles.length ? 'Seleccionar o escribir...' : '310, Bronce, Gold...'} list="pd-planes" autoComplete="off" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>N° de Afiliado</label>
                  <input name="numero_afiliado" type="text" value={form.numero_afiliado} onChange={handleChange} placeholder="123456789" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>N° de Autorización</label>
                  <input name="numero_autorizacion" type="text" value={form.numero_autorizacion} onChange={handleChange} placeholder="5917639" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vigencia desde</label>
                  <input name="autorizacion_vigencia_desde" type="date" value={form.autorizacion_vigencia_desde} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vigencia hasta</label>
                  <input name="autorizacion_vigencia_hasta" type="date" value={form.autorizacion_vigencia_hasta} onChange={handleChange} className={inputCls} />
                </div>
              </>
            ) : null}
            <div>
              <label className={labelCls}>Modalidad</label>
              <select name="modalidad_tratamiento" value={form.modalidad_tratamiento} onChange={handleChange} className={inputCls}>
                <option value="">Seleccionar...</option>
                <option value="presencial">Presencial</option>
                <option value="videollamada">Videollamada</option>
                <option value="telefonica">Telefónica</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Frecuencia</label>
              <select name="frecuencia_sesiones" value={form.frecuencia_sesiones} onChange={handleChange} className={inputCls}>
                <option value="">Seleccionar...</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
                <option value="a_demanda">A demanda</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Honorarios por sesión</label>
              <div className="flex gap-2">
                <MonedaSelector
                  value={form.moneda_preferida as Moneda}
                  onChange={(m) => setForm((prev) => ({ ...prev, moneda_preferida: m }))}
                  className="shrink-0"
                />
                <CurrencyInput
                  value={form.honorarios}
                  onChange={(val) => setForm((prev) => ({ ...prev, honorarios: val }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Política de inasistencias</label>
              <div className="space-y-2">
                {[
                  { value: 'null', label: 'Usar configuración global', desc: 'Aplica la política general de tu cuenta' },
                  { value: 'true', label: 'Cobrar inasistencias', desc: 'Las sesiones no asistidas generan deuda' },
                  { value: 'false', label: 'No cobrar inasistencias', desc: 'Las sesiones no asistidas no generan deuda' },
                ].map((opt) => {
                  const current = form.cobrar_inasistencias === null ? 'null' : String(form.cobrar_inasistencias)
                  const active = current === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        cobrar_inasistencias: opt.value === 'null' ? null : opt.value === 'true',
                      }))}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-outline-variant/20 bg-surface-container-high text-on-surface hover:border-primary/40'
                      )}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className={cn('block text-xs mt-0.5', active ? 'text-primary/70' : 'text-on-surface-variant')}>
                        {opt.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </FormCard>

        {/* Resumen clínico */}
        <FormCard title="Resumen Clínico" icon="clinical_notes">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className={labelCls}>Motivo de Consulta</label>
              <textarea name="motivo_consulta" value={form.motivo_consulta} onChange={handleChange} rows={4} placeholder="¿Por qué consulta? Motivo de derivación, problemática principal..." className={cn(inputCls, 'resize-none min-h-[100px]')} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas de Evolución</label>
              <textarea name="notas" value={form.notas} onChange={handleChange} rows={6} placeholder="Evolución del tratamiento, observaciones generales..." className={cn(inputCls, 'resize-none min-h-[150px]')} />
            </div>
            <div>
              <label className={labelCls}>Código Diagnóstico CIE / DSM</label>
              <input name="codigo_diagnostico" type="text" value={form.codigo_diagnostico} onChange={handleChange} placeholder="F41.1, 300.02..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Gravedad Estimada</label>
              <select name="gravedad_estimada" value={form.gravedad_estimada} onChange={handleChange} className={inputCls}>
                <option value="">Seleccionar...</option>
                <option value="leve">Leve</option>
                <option value="moderada">Moderada</option>
                <option value="grave">Grave</option>
              </select>
            </div>
          </div>
        </FormCard>

        {/* Medicación */}
        <FormCard title="Medicación" icon="medication">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={addMedicacion}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Agregar medicamento
            </button>
          </div>
          {medicaciones.length === 0 ? (
            <div className="text-center py-6 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2 block opacity-25">medication</span>
              <p className="text-sm">Sin medicación registrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {medicaciones.map((med, idx) => (
                <div key={idx} className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border border-outline-variant/20 rounded-lg bg-surface-container-high/30">
                  <button
                    type="button"
                    onClick={() => removeMedicacion(idx)}
                    className="absolute top-3 right-3 p-1 text-on-surface-variant hover:text-error hover:bg-red-50 rounded-full transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                  <div>
                    <label className={labelCls}>Fármaco <span className="text-error">*</span></label>
                    <input type="text" value={med.farmaco} onChange={(e) => updateMedicacion(idx, 'farmaco', e.target.value)} placeholder="Fluoxetina" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Dosis</label>
                    <input type="text" value={med.dosis} onChange={(e) => updateMedicacion(idx, 'dosis', e.target.value)} placeholder="20mg" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Frecuencia</label>
                    <input type="text" value={med.frecuencia} onChange={(e) => updateMedicacion(idx, 'frecuencia', e.target.value)} placeholder="1 vez al día" className={inputCls} />
                  </div>
                  <div className="pr-8">
                    <label className={labelCls}>Médico prescriptor</label>
                    <input type="text" value={med.prescriptor} onChange={(e) => updateMedicacion(idx, 'prescriptor', e.target.value)} placeholder="Dr. García" className={inputCls} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormCard>

        {/* Estado del paciente */}
        <FormCard title="Estado del paciente" icon="person_check">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">
                {activo ? 'En tratamiento' : 'Inactivo'}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {activo ? 'Paciente activo, aparece en búsquedas y agenda' : 'Paciente dado de baja'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleActivo(!activo)}
              disabled={checkingSeriesActivas}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-60',
                activo ? 'bg-primary' : 'bg-gray-300'
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
                activo ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          {!activo && paciente.activo && seriesActivas > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2">
              <span className="text-amber-500 flex-shrink-0 text-base leading-snug">⚠️</span>
              <div className="text-xs text-amber-800">
                <p className="font-semibold">
                  Este paciente tiene {seriesActivas} {seriesActivas === 1 ? 'serie' : 'series'} de turnos fijos {seriesActivas === 1 ? 'activa' : 'activas'}.
                </p>
                <p className="mt-0.5">
                  Al desactivarlo se liberarán todos los turnos futuros del calendario.
                </p>
              </div>
            </div>
          )}
        </FormCard>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={handleCancelar} className="btn-secondary flex-1 justify-center py-2.5">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className={cn('btn-primary flex-1 justify-center py-2.5', loading && 'opacity-70 cursor-not-allowed')}
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
      </>
    )
  }

  if (activeTab === 'resumen') {
    return <ResumenTab paciente={paciente} medicaciones={medicacionesIniciales} />
  }

  if (activeTab === 'interconsultas') {
    return <InterconsultasTab paciente={paciente} interconsultas={interconsultas} />
  }

  if (activeTab === 'facturacion') {
    return <AsistenciaTab paciente={paciente} turnos={turnos} profObrasSociales={profObrasSociales} profesionalCobrarInasistencias={profesionalCobrarInasistencias} profesionalData={profesionalData} />
  }

  if (activeTab === 'informes') {
    return <InformesTab paciente={paciente} profesionalData={profesionalData ?? null} turnoRecurrente={turnoRecurrente ?? null} />
  }

  if (activeTab === 'admision') {
    return <AdmisionTab pacienteId={paciente.id} />
  }

  if (activeTab === 'archivos') {
    return <ArchivosTab pacienteId={paciente.id} pacienteNombre={`${paciente.nombre} ${paciente.apellido}`} />
  }

  if (activeTab === 'composicion') {
    return <TabComposicionCorporal pacienteId={paciente.id} />
  }

  if (activeTab && activeTab !== 'datos') {
    return <TabEmptyState tab={activeTab} />
  }

  const edad = paciente.fecha_nacimiento
    ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
    : null
  const fechaNacimiento = paciente.fecha_nacimiento
    ? format(parseISO(paciente.fecha_nacimiento), 'd MMM yyyy', { locale: es })
    : null
  const telHref = normalizePhone(paciente.telefono)

  const generoLabel: Record<string, string> = { M: 'Masculino', F: 'Femenino', NB: 'No Binario' }

  return (
    <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
      <KlinCard title="Información personal">
        <Kv
          rows={[
            ['Nombre completo', formatNombreCompleto(paciente.nombre, paciente.apellido)],
            ['DNI', paciente.dni || '—'],
            [
              'Fecha de nacimiento',
              fechaNacimiento
                ? `${fechaNacimiento}${edad !== null ? ` (${edad} años)` : ''}`
                : '—',
            ],
            ['Género', generoLabel[paciente.genero ?? ''] ?? paciente.genero ?? '—'],
            ['Nacionalidad', paciente.nacionalidad || '—'],
            ['Ocupación', paciente.ocupacion || '—'],
            ['Estado civil', paciente.estado_civil || '—'],
          ]}
        />
      </KlinCard>

      <KlinCard title="Contacto">
        <Kv
          rows={[
            ['Email', paciente.email || '—'],
            [
              'Teléfono',
              telHref ? (
                <a href={`tel:${telHref}`} className="tel">
                  {paciente.telefono}
                </a>
              ) : (
                '—'
              ),
            ],
            ['Domicilio', paciente.domicilio || '—'],
            [
              'Contacto emergencia',
              paciente.contacto_emergencia_nombre
                ? `${paciente.contacto_emergencia_nombre}${paciente.contacto_emergencia_telefono ? ` · ${paciente.contacto_emergencia_telefono}` : ''}`
                : '—',
            ],
          ]}
        />
      </KlinCard>

      <KlinCard title="Obra social">
        <Kv
          rows={[
            ['Obra social', paciente.os_pendiente_validacion && paciente.os_nombre_libre
              ? <span className="flex items-center gap-1.5">{paciente.os_nombre_libre}<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">⚠️ pendiente validación</span></span>
              : (paciente.obra_social || '—')],
            ['Plan', (paciente.os_pendiente_validacion ? paciente.os_plan_libre : paciente.plan_obra_social) || '—'],
            ['N° afiliado', paciente.numero_afiliado || '—'],
            ['Autorización', paciente.numero_autorizacion || '—'],
          ]}
        />
      </KlinCard>

      <KlinCard title="Tratamiento">
        <Kv
          rows={[
            ['Modalidad', paciente.modalidad_tratamiento || '—'],
            ['Frecuencia', paciente.frecuencia_sesiones || '—'],
            [
              'Honorario',
              paciente.honorarios != null
                ? formatearMonto(paciente.honorarios, (paciente.moneda_preferida as Moneda) ?? 'ARS')
                : '—',
            ],
            ['Diagnóstico', paciente.codigo_diagnostico || '—'],
            ['Gravedad', paciente.gravedad_estimada || '—'],
          ]}
        />
      </KlinCard>

      <FirmaPacienteCard paciente={paciente} />
    </div>
  )
}

function ResumenTab({ paciente, medicaciones }: { paciente: Paciente; medicaciones: MedicacionPaciente[] }) {
  const evolucion = paciente.notas || null
  const motivo = paciente.motivo_consulta || null
  const [motivoExpanded, setMotivoExpanded] = useState(false)
  const [evolucionExpanded, setEvolucionExpanded] = useState(false)

  return (
    <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
            Motivo de Consulta
          </h3>
          {motivo ? (
            <div>
              <p className={`text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap ${!motivoExpanded ? 'line-clamp-3' : ''}`}>
                {motivo}
              </p>
              {motivo.length > 150 && (
                <button
                  onClick={() => setMotivoExpanded(!motivoExpanded)}
                  className="text-xs text-primary font-medium mt-2 hover:underline"
                >
                  {motivoExpanded ? 'Ver menos ↑' : 'Seguir leyendo ↓'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Sin datos registrados.</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
            Evolución del tratamiento
          </h3>
          {evolucion ? (
            <div>
              <p className={`text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap ${!evolucionExpanded ? 'line-clamp-3' : ''}`}>
                {evolucion}
              </p>
              {evolucion.length > 150 && (
                <button
                  onClick={() => setEvolucionExpanded(!evolucionExpanded)}
                  className="text-xs text-primary font-medium mt-2 hover:underline"
                >
                  {evolucionExpanded ? 'Ver menos ↑' : 'Seguir leyendo ↓'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Sin datos registrados.</p>
          )}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
            Diagnóstico
          </h3>
          {paciente.codigo_diagnostico ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-on-surface">{paciente.codigo_diagnostico}</p>
              {paciente.gravedad_estimada && (
                <p className="text-xs text-on-surface-variant capitalize">
                  Gravedad: {paciente.gravedad_estimada}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Sin datos registrados.</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
            Medicación
          </h3>
          {medicaciones.length > 0 ? (
            <ul className="space-y-3">
              {medicaciones.map((m) => (
                <li key={m.id} className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-on-surface">{m.farmaco}{m.dosis ? ` — ${m.dosis}` : ''}</span>
                  {(m.frecuencia || m.prescriptor) && (
                    <span className="text-xs text-on-surface-variant">
                      {[m.frecuencia, m.prescriptor ? `Dr. ${m.prescriptor}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-on-surface-variant">Sin datos registrados.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InterconsultasTab({ paciente, interconsultas }: { paciente: Paciente; interconsultas: Interconsulta[] }) {
  if (!paciente.dni?.trim()) {
    return (
      <div className="mt-6 border border-dashed border-outline-variant/30 rounded-xl bg-surface-container-lowest p-10 text-center">
        <span className="material-symbols-outlined text-4xl mb-3 block text-on-surface-variant opacity-30">badge</span>
        <h3 className="text-[17px] font-semibold text-on-surface mb-1.5">DNI requerido</h3>
        <p className="text-[13.5px] text-on-surface-variant">
          Para ver interconsultas el paciente debe tener DNI registrado.
        </p>
      </div>
    )
  }

  if (interconsultas.length === 0) {
    return (
      <div className="mt-6 border border-dashed border-outline-variant/30 rounded-xl bg-surface-container-lowest p-10 text-center">
        <span className="material-symbols-outlined text-4xl mb-3 block text-on-surface-variant opacity-30">group</span>
        <h3 className="text-[17px] font-semibold text-on-surface mb-1.5">Sin interconsultas</h3>
        <p className="text-[13.5px] text-on-surface-variant">
          Este paciente no tiene interconsultas registradas.
        </p>
        <p className="text-[12px] text-on-surface-variant mt-1 opacity-70">
          Cuando otro profesional atienda a este paciente, aparecerá aquí automáticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {interconsultas.map((colega, i) => (
        <InterconsultaCard key={i} colega={colega} />
      ))}
    </div>
  )
}

function InterconsultaCard({ colega }: { colega: Interconsulta }) {
  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 border-l-4 border-l-primary shadow-sm p-5">
      <p className="font-medium text-gray-900 text-[15px]">
        {colega.nombre} {colega.apellido}
      </p>
      {colega.especialidad && (
        <p className="text-sm text-primary mt-0.5">{colega.especialidad}</p>
      )}
      <hr className="my-3 border-outline-variant/20" />
      <div className="space-y-1.5">
        {colega.telefono && (
          <a
            href={`tel:${colega.telefono.replace(/[^\d+]/g, '')}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">phone</span>
            {colega.telefono}
          </a>
        )}
        {colega.email && (
          <a
            href={`mailto:${colega.email}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">mail</span>
            {colega.email}
          </a>
        )}
        {!colega.telefono && !colega.email && (
          <p className="text-xs text-on-surface-variant">Sin datos de contacto.</p>
        )}
      </div>
    </div>
  )
}

function FormCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_8px_24px_rgba(0,26,72,0.06)]">
      <h3 className="font-semibold text-on-surface mb-5 flex items-center gap-2 text-sm">
        <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function FirmaPacienteCard({ paciente }: { paciente: Paciente }) {
  const [firmaUrl, setFirmaUrl] = useState<string | null>(paciente.firma_paciente_url ?? null)
  const supabase = createClient()

  async function guardar(url: string | null) {
    await supabase.from('pacientes').update({ firma_paciente_url: url }).eq('id', paciente.id)
  }

  return (
    <KlinCard title="Firma del paciente / tutor">
      <p className="text-xs text-on-surface-variant mb-4">
        Usada en planillas de asistencia de obras sociales.
      </p>
      <FirmaUploader
        label="Firma del paciente o tutor"
        descripcion="Fotografiá la firma sobre papel blanco con tinta negra"
        instrucciones="Fotografiá la firma sobre papel blanco con tinta negra. Recortá la imagen para que solo muestre la firma."
        firmaUrl={firmaUrl}
        bucket="firmas-pacientes"
        storagePath={`${paciente.terapeuta_id}/${paciente.id}/firma`}
        onUpload={(url) => { setFirmaUrl(url); guardar(url) }}
        onDelete={() => { setFirmaUrl(null); guardar(null) }}
      />
    </KlinCard>
  )
}

function KlinCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-6">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function TabEmptyState({ tab }: { tab: PacienteTabKey }) {
  const config: Record<PacienteTabKey, { title: string; body: string }> = {
    resumen: { title: 'Resumen del paciente', body: '' },
    datos: { title: 'Datos personales', body: '' },
    historial: { title: 'Historial clínico', body: '' },
    informes: {
      title: 'Informes',
      body: 'Los informes clínicos del paciente aparecerán aquí. Próximamente.',
    },
    facturacion: {
      title: 'Facturación',
      body: 'Historial de pagos y estado de cuenta. Próximamente.',
    },
    admision: { title: 'Admisión', body: '' },
    interconsultas: { title: 'Interconsultas', body: '' },
    archivos: { title: 'Archivos', body: '' },
    composicion: { title: 'Antropometría', body: '' },
  }
  const c = config[tab]
  return (
    <div className="mt-6 border border-dashed border-outline-variant/30 rounded-xl bg-surface-container-lowest p-10 text-center">
      <h3 className="text-[22px] font-bold text-on-surface mb-1.5 tracking-tight">{c.title}</h3>
      <p className="text-[13.5px] text-on-surface-variant m-0">{c.body}</p>
    </div>
  )
}

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function getCurrencySymbol(moneda: string): string {
  if (moneda === 'USD') return 'US$'
  if (moneda === 'EUR') return '€'
  return '$'
}
function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

function AsistenciaTab({ paciente, turnos, profObrasSociales = [], profesionalCobrarInasistencias = false, profesionalData = null }: { paciente: Paciente; turnos: TurnoRow[]; profObrasSociales?: ProfesionalObraSocial[]; profesionalCobrarInasistencias?: boolean; profesionalData?: ProfesionalData | null }) {
  const router = useRouter()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())
  const [showConfirm, setShowConfirm] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [mesPagado, setMesPagado] = useState(false)
  const [planillaOpen, setPlanillaOpen] = useState(false)
  const [pagoParcialesOpen, setPagoParcialesOpen] = useState(false)
  const [montoParcialInput, setMontoParcialInput] = useState('')
  const [guardandoParcial, setGuardandoParcial] = useState(false)
  const [pagoParcialesMedio, setPagoParcialesMedio] = useState<'efectivo' | 'transferencia' | 'mercado_pago'>('transferencia')
  const [fechaParcialInput, setFechaParcialInput] = useState(() => new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [openDrop, setOpenDrop] = useState<string | null>(null)
  const [localEstados, setLocalEstados] = useState<Record<string, string>>({})
  const [updatingEstado, setUpdatingEstado] = useState<string | null>(null)
  const [registrarPagoTurno, setRegistrarPagoTurno] = useState<TurnoDeuda | null>(null)

  useEffect(() => {
    function closeAll() {
      setOpenDrop(null)
      setShowConfirm(false)
    }
    document.addEventListener('mousedown', closeAll)
    return () => document.removeEventListener('mousedown', closeAll)
  }, [])

  const osConfig = profObrasSociales.find((o) => o.id === paciente.os_config_id)

  const cobrarInasistencia = resolverPoliticaInasistencia(
    paciente.cobrar_inasistencias,
    profesionalCobrarInasistencias
  )

  const turnosMes = turnos.filter((t) => {
    const d = new Date(t.fecha_hora)
    return d.getMonth() === mes && d.getFullYear() === anio &&
      ['realizado', 'no_asistio', 'cancelado'].includes(t.estado)
  })

  const turnosMesConEstado = turnosMes.map(t => ({
    ...t,
    estado: localEstados[t.id] ?? t.estado,
  }))

  const asistio = turnosMesConEstado.filter((t) => t.estado === 'realizado')
  const noAsistio = turnosMesConEstado.filter((t) => t.estado === 'no_asistio')
  const cancelado = turnosMesConEstado.filter((t) => t.estado === 'cancelado')

  const deuda = calcularDeudaMes(turnosMesConEstado, cobrarInasistencia)
  const { sesionesCobrables, montoTotal, montoCobrado, montoPendiente } = deuda

  const cobrablesPendientes = turnosMesConEstado.filter((t) => {
    if (t.pagado) return false
    if (t.estado === 'realizado') return true
    if (t.estado === 'no_asistio') return cobrarInasistencia
    return false
  })
  const todosPagados = sesionesCobrables > 0 && cobrablesPendientes.length === 0

  const monedaPaciente = (paciente.moneda_preferida ?? 'ARS') as Moneda
  const montoIngresado = parseFloat(montoParcialInput) || 0
  const totalPendientePaciente = montoPendiente[monedaPaciente] ?? 0
  const previewPagaCompleto = montoIngresado > 0 && totalPendientePaciente > 0 && montoIngresado >= totalPendientePaciente
  const previewSaldoTras = Math.max(0, totalPendientePaciente - montoIngresado)

  const canGoNext = !(mes === now.getMonth() && anio === now.getFullYear())
  const anioActual = now.getFullYear()
  const anios = [anioActual - 1, anioActual, anioActual + 1]

  const currSym = getCurrencySymbol(monedaPaciente)
  const totalMesNum = montoTotal[monedaPaciente] ?? 0
  const montoPendienteNum = montoPendiente[monedaPaciente] ?? 0

  function prevMes() {
    if (mes === 0) { setMes(11); setAnio(prev => prev - 1) }
    else setMes(prev => prev - 1)
    setMesPagado(false)
    setLocalEstados({})
  }

  function nextMes() {
    if (!canGoNext) return
    if (mes === 11) { setMes(0); setAnio(prev => prev + 1) }
    else setMes(prev => prev + 1)
    setMesPagado(false)
    setLocalEstados({})
  }

  async function handleEstadoChange(turnoId: string, newEstado: string) {
    setUpdatingEstado(turnoId)
    setOpenDrop(null)
    setLocalEstados(prev => ({ ...prev, [turnoId]: newEstado }))
    try {
      const res = await fetch('/api/turnos/estado', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: turnoId, estado: newEstado }),
      })
      if (!res.ok) {
        setLocalEstados(prev => { const copy = { ...prev }; delete copy[turnoId]; return copy })
      } else {
        router.refresh()
      }
    } finally {
      setUpdatingEstado(null)
    }
  }

  function turnoToDeuda(turno: TurnoRow): TurnoDeuda {
    return {
      id: turno.id,
      fecha_hora: turno.fecha_hora,
      duracion_min: turno.duracion_min ?? 50,
      monto: turno.monto ?? 0,
      moneda: turno.moneda ?? 'ARS',
      estado: localEstados[turno.id] ?? turno.estado,
      estado_pago: (turno.estado_pago as 'pendiente' | 'pago_parcial' | 'bonificado') ?? 'pendiente',
      monto_pagado: turno.monto_pagado ?? 0,
      paciente_id: paciente.id,
      paciente_nombre: paciente.nombre,
      paciente_apellido: paciente.apellido,
      os_config_id: paciente.os_config_id ?? null,
      os_nombre: profObrasSociales.find(o => o.id === paciente.os_config_id)?.nombre ?? null,
    }
  }

  async function handleMarcarPagado() {
    setPagando(true)
    const supabase = createClient()
    const inicioMes = new Date(anio, mes, 1).toISOString()
    const finMes = new Date(anio, mes + 1, 0, 23, 59, 59).toISOString()
    const estadosAMarcar = cobrarInasistencia ? ['realizado', 'no_asistio'] : ['realizado']
    await supabase
      .from('turnos')
      .update({ pagado: true, estado_pago: 'pagado' })
      .eq('paciente_id', paciente.id)
      .in('estado', estadosAMarcar)
      .gte('fecha_hora', inicioMes)
      .lte('fecha_hora', finMes)
    setPagando(false)
    setShowConfirm(false)
    setMesPagado(true)
    router.refresh()
  }

  async function handlePagoParcial() {
    const monto = parseFloat(montoParcialInput)
    if (!monto || monto <= 0) return
    setGuardandoParcial(true)
    try {
      const moneda = (paciente.moneda_preferida ?? 'ARS') as string
      const res = await fetch('/api/cobros/pago-parcial-mes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paciente_id: paciente.id, mes, anio, monto, moneda, medio_pago: pagoParcialesMedio, fecha_cobro: fechaParcialInput }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Error al registrar el pago')
      setPagoParcialesOpen(false)
      setMontoParcialInput('')
      setPagoParcialesMedio('transferencia')
      setFechaParcialInput(new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar el pago')
    } finally {
      setGuardandoParcial(false)
    }
  }

  const turnosMesOrdenados = [...turnosMes].sort(
    (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
  )

  return (
    <>
      {/* Month bar */}
      <div className="month-bar">
        <div className="month-nav">
          <button type="button" onClick={prevMes} title="Mes anterior">
            <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <div className="month-label">{MESES_NOMBRES[mes]} {anio}</div>
          <button type="button" onClick={nextMes} disabled={!canGoNext} title="Mes siguiente">
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </div>
        {paciente.os_config_id && osConfig && (
          <button type="button" className="fac-btn os-sheet" onClick={() => setPlanillaOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 4h12l4 4v12H4z"/><path d="M14 4v6h6"/><path d="M8 15h8M8 18h5"/>
            </svg>
            Generar planilla OS
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="bill-stats">
        <div className="bstat">
          <div className="bstat-icn ok">
            <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div className="bstat-v">{asistio.length}</div>
          <div className="bstat-l">Sesiones atendidas</div>
        </div>
        <div className="bstat">
          <div className="bstat-icn warn">
            <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </div>
          <div className="bstat-v">{noAsistio.length + cancelado.length}</div>
          <div className="bstat-l">Cancelada / ausente</div>
        </div>
        <div className="bstat">
          <div className="bstat-icn neutral">
            <svg viewBox="0 0 24 24"><path d="M3 10h18M5 6h14l1 14H4L5 6z"/></svg>
          </div>
          <div className="bstat-v">
            {totalMesNum > 0
              ? <><span className="cur">{currSym}</span>{fmtNum(totalMesNum)}</>
              : '—'}
          </div>
          <div className="bstat-l">Total del mes</div>
        </div>
        <div className={`bstat${montoPendienteNum > 0 ? ' alert' : ''}`}>
          <div className="bstat-icn danger">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </div>
          <div className="bstat-v">
            {montoPendienteNum > 0
              ? <><span className="cur">{currSym}</span>{fmtNum(montoPendienteNum)}</>
              : todosPagados ? '✓' : '—'}
          </div>
          <div className="bstat-l">Pendiente de cobro</div>
        </div>
      </div>

      {turnosMes.length === 0 ? (
        <div className="bill-empty">
          <div className="icn">
            <svg viewBox="0 0 24 24"><path d="M3 10h18M5 6h14l1 14H4L5 6z"/></svg>
          </div>
          <h3>Sin sesiones este mes</h3>
          <p>No hay sesiones registradas para este período.</p>
        </div>
      ) : (
        <>
          <div className="ses-head">
            <h3>Sesiones del mes</h3>
            <span className="ses-count">{turnosMes.length} sesión{turnosMes.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="ses-list">
            {turnosMesOrdenados.map((turno) => {
              const efectivoEstado = localEstados[turno.id] ?? turno.estado
              const esPagado = !!turno.pagado || turno.estado_pago === 'pagado'
              const esParcial = !esPagado && turno.estado_pago === 'pago_parcial'
              const esCancelado = efectivoEstado === 'cancelado'
              const isUpdating = updatingEstado === turno.id
              const statusClass = efectivoEstado === 'realizado' ? 'atendido' : efectivoEstado === 'no_asistio' ? 'ausente' : 'cancelada'
              const estadoLabel = efectivoEstado === 'realizado' ? 'Atendido' : efectivoEstado === 'no_asistio' ? 'No asistió' : 'Cancelada'

              const d = parseISO(turno.fecha_hora)
              const diaSemana = DIAS_CORTOS[d.getDay()]
              const diaNum = d.getDate()
              const mesNombreTurno = MESES_NOMBRES[d.getMonth()].toLowerCase()
              const horaTurno = format(d, 'HH:mm')
              const duracion = turno.duracion_min ?? 50

              const montoTurno = turno.monto ?? 0
              const montoPagadoTurno = turno.monto_pagado ?? 0
              const montoPendienteTurno = montoTurno - montoPagadoTurno
              const monedaTurno = turno.moneda ?? monedaPaciente
              const symTurno = getCurrencySymbol(monedaTurno)

              const cardClass = ['ses-card', esPagado && 'paid', esCancelado && 'muted'].filter(Boolean).join(' ')

              return (
                <div key={turno.id} className={cardClass}>
                  <div className="ses-main">
                    <div className="ses-date">
                      <div className="ses-d"><b>{diaSemana} {diaNum}</b> {mesNombreTurno}</div>
                      <div className="ses-t">{horaTurno} hs · {duracion} min</div>
                    </div>
                    {efectivoEstado === 'no_asistio' && cobrarInasistencia && (
                      <span className="ses-tag">No asistió — se cobra por política</span>
                    )}
                    {esCancelado && (
                      <span className="ses-tag">Cancelada · sin cargo</span>
                    )}
                  </div>
                  <div className="ses-actions">
                    <div className={`status-drop${openDrop === turno.id ? ' open' : ''}`}>
                      <button
                        type="button"
                        className={`status-btn ${statusClass}`}
                        onClick={(e) => { e.stopPropagation(); if (!isUpdating) setOpenDrop(openDrop === turno.id ? null : turno.id) }}
                      >
                        <span className="sdot"></span>
                        {estadoLabel}
                        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                      <div className="drop-menu">
                        {(['realizado', 'no_asistio', 'cancelado'] as const).map((est) => {
                          const cl = est === 'realizado' ? 'atendido' : est === 'no_asistio' ? 'ausente' : 'cancelada'
                          const lbl = est === 'realizado' ? 'Atendido' : est === 'no_asistio' ? 'No asistió' : 'Cancelada'
                          const isActive = est === efectivoEstado
                          return (
                            <button
                              key={est}
                              type="button"
                              className={`drop-item${isActive ? ' active' : ''}`}
                              onClick={() => handleEstadoChange(turno.id, est)}
                            >
                              <span className={`sdot ${cl}`}></span>
                              {lbl}
                              {isActive && (
                                <svg className="chk" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {esCancelado ? (
                      <div className="pay-area">
                        <span className="no-charge">Sin cargo</span>
                      </div>
                    ) : esPagado ? (
                      <div className="pay-area">
                        <span className="amount"><span className="cur">{symTurno}</span>{fmtNum(montoTurno)}</span>
                        <span className="pay-chip pagado">
                          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                          Pagado
                        </span>
                      </div>
                    ) : esParcial ? (
                      <div className="pay-area">
                        <span className="pay-chip parcial">
                          Pagado {symTurno} {fmtNum(montoPagadoTurno)} · Debe {symTurno} {fmtNum(montoPendienteTurno)}
                        </span>
                      </div>
                    ) : (
                      <div className="pay-area">
                        <span className="amount"><span className="cur">{symTurno}</span>{fmtNum(montoTurno)}</span>
                        <span className="pay-chip pendiente">Pendiente</span>
                      </div>
                    )}

                    {!esPagado && !esCancelado && (
                      <button
                        type="button"
                        className="cobrar-btn"
                        onClick={() => setRegistrarPagoTurno(turnoToDeuda(turno))}
                      >
                        <svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        {esParcial ? 'Cobrar saldo' : 'Cobrar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {(todosPagados || mesPagado) && (
            <div className="paid-banner">
              <div className="icn">
                <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div className="txt">
                <b>Mes completamente pagado</b>
                <span>Todas las sesiones de este mes fueron cobradas.</span>
              </div>
            </div>
          )}

          {!(todosPagados || mesPagado) && cobrablesPendientes.length > 0 && (
            <div className="bill-foot">
              <div className="foot-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                Pendiente de cobro este mes:{' '}
                <b>{currSym} {fmtNum(montoPendienteNum)}</b>
                {' '}en {cobrablesPendientes.length} sesión{cobrablesPendientes.length !== 1 ? 'es' : ''}
              </div>
              <div className="foot-actions">
                <button type="button" className="fac-btn" onClick={() => setPagoParcialesOpen(true)}>
                  Pago parcial del mes
                </button>
                <div className={`confirm-wrap${showConfirm ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="fac-btn fac-btn-blue"
                    onClick={(e) => { e.stopPropagation(); setShowConfirm(v => !v) }}
                  >
                    <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                    Marcar mes como pagado
                  </button>
                  <div className="confirm-pop">
                    <div className="cp-title">
                      ¿Marcar {cobrablesPendientes.length} sesión{cobrablesPendientes.length !== 1 ? 'es' : ''} como pagadas?
                    </div>
                    <div className="cp-sub">
                      Se registrarán {currSym} {fmtNum(montoPendienteNum)} en efectivo con fecha de hoy.
                    </div>
                    <div className="cp-actions">
                      <button type="button" className="fac-btn" onClick={() => setShowConfirm(false)}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="fac-btn fac-btn-blue"
                        onClick={handleMarcarPagado}
                        disabled={pagando}
                      >
                        {pagando ? 'Procesando...' : 'Sí, marcar pagado'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

        {/* Pago parcial del mes SlideOver */}
        {(() => {
          const symParcial = monedaPaciente === 'USD' ? 'US$' : monedaPaciente === 'EUR' ? '€' : '$'
          const fmtN = (n: number) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
          const totalMes = montoTotal[monedaPaciente] ?? 0
          const cobradoMes = montoCobrado[monedaPaciente] ?? 0
          const pendienteMes = totalPendientePaciente
          const parcialH4: React.CSSProperties = { margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8A93A1' }
          const parcialFieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }
          const parcialLabelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#1F2937' }

          const parcialHeader = (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E7E9EE', display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'linear-gradient(180deg, #F4F7FE 0%, transparent 100%)', flexShrink: 0 }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: 'linear-gradient(145deg, #E3E9F6, #C9D3E9)', color: '#16389F', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '16px', letterSpacing: '-0.02em' }}>
                {paciente.nombre[0]}{paciente.apellido[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#0B1220', letterSpacing: '-0.015em' }}>
                  {paciente.nombre} {paciente.apellido}
                </div>
                <div style={{ fontSize: '12px', color: '#5B6472', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{MESES_NOMBRES[mes]} {anio}</span>
                  <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#AEB5C0', flexShrink: 0 }} />
                  <span>{cobrablesPendientes.length} sesión{cobrablesPendientes.length !== 1 ? 'es' : ''} pendiente{cobrablesPendientes.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <button
                onClick={() => { setPagoParcialesOpen(false); setMontoParcialInput('') }}
                style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid transparent', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                title="Cerrar"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1F2937" strokeWidth="1.8"><path d="M6 6l12 12M18 6l-12 12"/></svg>
              </button>
            </div>
          )

          const parcialFooter = (
            <div style={{ borderTop: '1px solid #E7E9EE', padding: '12px 16px', display: 'flex', gap: '8px', background: '#F6F7F9' }}>
              <button
                type="button"
                onClick={() => { setPagoParcialesOpen(false); setMontoParcialInput('') }}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', border: '1px solid #E7E9EE', background: '#FFFFFF', color: '#1F2937' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePagoParcial}
                disabled={!montoParcialInput || guardandoParcial || montoIngresado <= 0}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: !montoParcialInput || guardandoParcial || montoIngresado <= 0 ? 'not-allowed' : 'pointer', border: 'none', background: !montoParcialInput || guardandoParcial || montoIngresado <= 0 ? '#F1F3F6' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: !montoParcialInput || guardandoParcial || montoIngresado <= 0 ? '#AEB5C0' : 'white', boxShadow: !montoParcialInput || guardandoParcial || montoIngresado <= 0 ? 'none' : '0 4px 10px rgba(37,99,235,0.20)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                {guardandoParcial ? 'Registrando...' : 'Registrar cobro'}
              </button>
            </div>
          )

          return (
            <SlideOver open={pagoParcialesOpen} onClose={() => { setPagoParcialesOpen(false); setMontoParcialInput('') }} title="" header={parcialHeader} footer={parcialFooter} noPadding width="md">
              <div style={{ padding: '20px 22px' }}>

                <h4 style={parcialH4}>Resumen de la sesión</h4>
                <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>
                    <span>Monto total</span>
                    <span><span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500, marginRight: '3px' }}>{symParcial}</span>{fmtN(totalMes)} {monedaPaciente}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: '#1F2937' }}>Ya pagado</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}><span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500, marginRight: '3px' }}>{symParcial}</span>{fmtN(cobradoMes)} {monedaPaciente}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontVariantNumeric: 'tabular-nums', paddingTop: '8px', borderTop: '1px dashed #E7E9EE', fontWeight: 700, color: '#DC2626', fontSize: '15px' }}>
                    <span>Saldo pendiente</span>
                    <span style={{ background: '#FEE2E2', padding: '4px 10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500, marginRight: '3px' }}>{symParcial}</span>{fmtN(pendienteMes)} {monedaPaciente}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '22px' }}>
                  <h4 style={parcialH4}>Registrar nuevo cobro</h4>

                  <div style={parcialFieldStyle}>
                    <label style={parcialLabelStyle}>Monto cobrado <em style={{ color: '#DC2626', fontStyle: 'normal', fontWeight: 700, marginLeft: '2px' }}>*</em></label>
                    <div
                      style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E7E9EE', borderRadius: '8px', overflow: 'hidden' }}
                    >
                      <span style={{ padding: '0 10px', fontSize: '13px', color: '#5B6472', fontWeight: 500, background: '#F6F7F9', borderRight: '1px solid #E7E9EE', height: '38px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{symParcial}</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={montoParcialInput}
                        onChange={(e) => setMontoParcialInput(e.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                        style={{ flex: 1, border: 'none', outline: 'none', padding: '0 12px', height: '38px', fontSize: '15px', color: '#0B1220', background: 'transparent', minWidth: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
                      />
                      <span style={{ padding: '0 10px', fontSize: '13px', color: '#5B6472', fontWeight: 500, background: '#F6F7F9', borderLeft: '1px solid #E7E9EE', height: '38px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{monedaPaciente}</span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#8A93A1' }}>El saldo pendiente ya está precargado. Podés editarlo si es un pago parcial.</span>
                  </div>

                  <div style={parcialFieldStyle}>
                    <label style={parcialLabelStyle}>Medio de pago <em style={{ color: '#DC2626', fontStyle: 'normal', fontWeight: 700, marginLeft: '2px' }}>*</em></label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      {([
                        { value: 'efectivo' as const, label: 'Efectivo', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg> },
                        { value: 'transferencia' as const, label: 'Transferencia', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h13l-3-3M21 17H8l3 3"/></svg> },
                        { value: 'mercado_pago' as const, label: 'Mercado Pago', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg> },
                      ]).map(opt => {
                        const sel = pagoParcialesMedio === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPagoParcialesMedio(opt.value)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', border: `1px solid ${sel ? '#0B1220' : '#E7E9EE'}`, borderRadius: '8px', background: sel ? '#0B1220' : '#FFFFFF', fontSize: '13px', fontWeight: 500, color: sel ? 'white' : '#1F2937', cursor: 'pointer', transition: 'all .12s ease' }}
                          >
                            <span style={{ color: sel ? 'white' : '#5B6472', display: 'flex' }}>{opt.icon}</span>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={parcialFieldStyle}>
                    <label style={parcialLabelStyle}>Fecha de cobro <em style={{ color: '#DC2626', fontStyle: 'normal', fontWeight: 700, marginLeft: '2px' }}>*</em></label>
                    <input
                      type="date"
                      value={fechaParcialInput}
                      onChange={e => setFechaParcialInput(e.target.value)}
                      style={{ border: '1px solid #E7E9EE', borderRadius: '8px', padding: '0 12px', height: '38px', fontSize: '14px', color: '#0B1220', outline: 'none', fontVariantNumeric: 'tabular-nums', width: '100%' }}
                    />
                  </div>

                  {montoIngresado > 0 && (
                    <div style={{ marginTop: '4px', padding: '10px 12px', background: previewPagaCompleto ? '#DCFCE7' : '#FEF3C7', borderRadius: '8px', fontSize: '12.5px', color: previewPagaCompleto ? '#047857' : '#B45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {previewPagaCompleto ? (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                          Tras registrar, todas las sesiones quedarán <b>Pagadas</b>.</>
                      ) : (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/></svg>
                          Saldo restante tras este cobro: <b>{symParcial} {fmtN(previewSaldoTras)}</b>.</>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </SlideOver>
          )
        })()}

        {/* Planilla SlideOver */}
        <PlanillaOSSlide
          open={planillaOpen}
          onClose={() => setPlanillaOpen(false)}
          paciente={paciente}
          osConfig={osConfig}
          mes={mes}
          anio={anio}
          turnos={turnos}
          firmaProfesionalUrl={profesionalData?.firma_sello_url ?? undefined}
          profesionalNombre={profesionalData ? `${profesionalData.nombre} ${profesionalData.apellido}` : undefined}
          matricula={profesionalData?.matricula ?? undefined}
          matriculaTipo={profesionalData?.matricula_tipo ?? undefined}
          matriculaProvincia={profesionalData?.matricula_provincia ?? undefined}
        />

      {/* RegistrarPagoSlide — cobrar sesión individual */}
      <RegistrarPagoSlide
        open={!!registrarPagoTurno}
        onClose={() => setRegistrarPagoTurno(null)}
        turno={registrarPagoTurno}
        onSuccess={() => { setRegistrarPagoTurno(null); router.refresh() }}
      />
    </>
  )
}

