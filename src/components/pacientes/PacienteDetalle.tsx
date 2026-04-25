'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, differenceInYears } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn, formatNombreCompleto } from '@/lib/utils'
import type { Paciente, MedicacionPaciente, Interconsulta } from '@/types/database'
import type { PacienteTabKey } from './PacienteTabs'
import { PAISES, OBRAS_SOCIALES_AR, PLANES_POR_OS } from '@/lib/data/salud-ar'

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
    numero_afiliado: p.numero_afiliado ?? '',
    numero_autorizacion: p.numero_autorizacion ?? '',
    modalidad_tratamiento: p.modalidad_tratamiento ?? '',
    frecuencia_sesiones: p.frecuencia_sesiones ?? '',
    honorarios: p.honorarios != null ? String(p.honorarios) : '',
    motivo_consulta: p.motivo_consulta ?? '',
    notas: p.notas ?? '',
    codigo_diagnostico: p.codigo_diagnostico ?? '',
    gravedad_estimada: p.gravedad_estimada ?? '',
  }
}

type MedicacionEdit = { farmaco: string; dosis: string; frecuencia: string; prescriptor: string }
const EMPTY_MED: MedicacionEdit = { farmaco: '', dosis: '', frecuencia: '', prescriptor: '' }

function toMedicacionEdit(m: MedicacionPaciente): MedicacionEdit {
  return { farmaco: m.farmaco, dosis: m.dosis ?? '', frecuencia: m.frecuencia ?? '', prescriptor: m.prescriptor ?? '' }
}

export default function PacienteDetalle({
  paciente,
  medicacionesIniciales = [],
  interconsultas = [],
  initialEdit = false,
  activeTab = 'datos',
}: {
  paciente: Paciente
  medicacionesIniciales?: MedicacionPaciente[]
  interconsultas?: Interconsulta[]
  initialEdit?: boolean
  activeTab?: PacienteTabKey
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(initialEdit)
  const [form, setForm] = useState(() => buildForm(paciente))
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
    setForm((prev) => ({
      ...prev,
      obra_social: e.target.value,
      plan_obra_social: '',
      os_nombre_libre: '',
      os_plan_libre: '',
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
        numero_afiliado: form.numero_afiliado || null,
        numero_autorizacion: form.numero_autorizacion || null,
        modalidad_tratamiento: form.modalidad_tratamiento || null,
        frecuencia_sesiones: form.frecuencia_sesiones || null,
        honorarios: form.honorarios ? parseFloat(form.honorarios) : null,
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
            <div>
              <label className={labelCls}>Obra Social / Prepaga</label>
              <select name="obra_social" value={form.obra_social} onChange={handleObraChange} className={inputCls}>
                <option value="">Sin obra social</option>
                {OBRAS_SOCIALES_AR.map((o) => <option key={o} value={o}>{o}</option>)}
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
                  <input name="os_plan_libre" type="text" value={form.os_plan_libre} onChange={handleChange} placeholder="Ej: Plan 310, Básico..." className={inputCls} />
                </div>
              </>
            ) : (
              <div>
                <label className={labelCls}>Plan</label>
                <input name="plan_obra_social" type="text" value={form.plan_obra_social} onChange={handleChange} placeholder={planesDisponibles.length ? 'Seleccionar o escribir...' : '310, Bronce, Gold...'} list="pd-planes" autoComplete="off" className={inputCls} />
              </div>
            )}
            <div>
              <label className={labelCls}>N° de Afiliado</label>
              <input name="numero_afiliado" type="text" value={form.numero_afiliado} onChange={handleChange} placeholder="123456789" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Número de Autorización</label>
              <input name="numero_autorizacion" type="text" value={form.numero_autorizacion} onChange={handleChange} placeholder="AUT-001234" className={inputCls} />
            </div>
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
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-medium pointer-events-none">ARS</span>
                <CurrencyInput
                  value={form.honorarios}
                  onChange={(val) => setForm((prev) => ({ ...prev, honorarios: val }))}
                  className={cn(inputCls, 'pl-12')}
                />
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
              paciente.honorarios != null ? `ARS ${paciente.honorarios.toLocaleString('es-AR')}` : '—',
            ],
            ['Diagnóstico', paciente.codigo_diagnostico || '—'],
            ['Gravedad', paciente.gravedad_estimada || '—'],
          ]}
        />
      </KlinCard>
    </div>
  )
}

function ResumenTab({ paciente, medicaciones }: { paciente: Paciente; medicaciones: MedicacionPaciente[] }) {
  const evolucion = paciente.notas || null
  const motivo = paciente.motivo_consulta || null

  return (
    <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
            Motivo de Consulta
          </h3>
          {motivo ? (
            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {motivo}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant">Sin datos registrados.</p>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
            Evolución del tratamiento
          </h3>
          {evolucion ? (
            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {evolucion}
            </p>
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
    documentos: {
      title: 'Documentos y adjuntos',
      body: 'Consentimientos informados, estudios, informes. Próximamente.',
    },
    facturacion: {
      title: 'Facturación',
      body: 'Historial de pagos y estado de cuenta. Próximamente.',
    },
    interconsultas: { title: 'Interconsultas', body: '' },
  }
  const c = config[tab]
  return (
    <div className="mt-6 border border-dashed border-outline-variant/30 rounded-xl bg-surface-container-lowest p-10 text-center">
      <h3 className="text-[22px] font-bold text-on-surface mb-1.5 tracking-tight">{c.title}</h3>
      <p className="text-[13.5px] text-on-surface-variant m-0">{c.body}</p>
    </div>
  )
}
