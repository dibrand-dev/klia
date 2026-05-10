'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PAISES, PLANES_POR_OS } from '@/lib/data/salud-ar'
import type { ProfesionalObraSocial } from '@/types/database'
import MonedaSelector from '@/components/ui/MonedaSelector'
import type { Moneda } from '@/lib/monedas'

const inputCls =
  'w-full bg-surface-container-high border border-outline-variant/15 text-on-surface rounded-lg px-4 py-3 text-sm focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none'
const labelCls =
  'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-2'

const EMPTY_FORM = {
  nombre: '',
  apellido: '',
  dni: '',
  fecha_nacimiento: '',
  telefono: '',
  email: '',
  genero: '',
  nacionalidad: '',
  estado_civil: '',
  domicilio: '',
  ocupacion: '',
  contacto_emergencia_nombre: '',
  contacto_emergencia_telefono: '',
  obra_social: '',
  plan_obra_social: '',
  os_nombre_libre: '',
  os_plan_libre: '',
  os_config_id: '',
  numero_afiliado: '',
  numero_autorizacion: '',
  autorizacion_vigencia_desde: '',
  autorizacion_vigencia_hasta: '',
  modalidad_tratamiento: '',
  frecuencia_sesiones: '',
  honorarios: '',
  motivo_consulta: '',
  notas: '',
  codigo_diagnostico: '',
  gravedad_estimada: '',
}

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

type MedicacionForm = { farmaco: string; dosis: string; frecuencia: string; prescriptor: string }
const EMPTY_MED: MedicacionForm = { farmaco: '', dosis: '', frecuencia: '', prescriptor: '' }

export default function NuevoPacienteForm({ terapeutaId, obrasSociales = [], profObrasSociales = [] }: { terapeutaId: string; obrasSociales?: string[]; profObrasSociales?: ProfesionalObraSocial[] }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [monedaPreferida, setMonedaPreferida] = useState<Moneda>('ARS')
  const [medicaciones, setMedicaciones] = useState<MedicacionForm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planesDisponibles = PLANES_POR_OS[form.obra_social] ?? []

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

  function addMedicacion() {
    setMedicaciones((prev) => [...prev, { ...EMPTY_MED }])
  }

  function removeMedicacion(idx: number) {
    setMedicaciones((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateMedicacion(idx: number, field: keyof MedicacionForm, value: string) {
    setMedicaciones((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))
  }

  async function handleSubmit() {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError('Nombre y apellido son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const esOtra = form.obra_social === 'Otra'
    const { data: newPaciente, error: dbError } = await supabase
      .from('pacientes')
      .insert({
        terapeuta_id: terapeutaId,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
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
        obra_social: esOtra ? 'Otra' : (form.obra_social || null),
        plan_obra_social: esOtra ? null : (form.plan_obra_social || null),
        os_nombre_libre: esOtra ? (form.os_nombre_libre.trim() || null) : null,
        os_plan_libre: esOtra ? (form.os_plan_libre.trim() || null) : null,
        os_pendiente_validacion: esOtra,
        os_config_id: form.os_config_id && form.os_config_id !== 'otra' ? form.os_config_id : null,
        numero_afiliado: form.numero_afiliado || null,
        numero_autorizacion: form.numero_autorizacion || null,
        autorizacion_vigencia_desde: form.autorizacion_vigencia_desde || null,
        autorizacion_vigencia_hasta: form.autorizacion_vigencia_hasta || null,
        modalidad_tratamiento: form.modalidad_tratamiento || null,
        frecuencia_sesiones: form.frecuencia_sesiones || null,
        honorarios: form.honorarios ? parseFloat(form.honorarios) : null,
        moneda_preferida: monedaPreferida,
        motivo_consulta: form.motivo_consulta || null,
        notas: form.notas || null,
        codigo_diagnostico: form.codigo_diagnostico || null,
        gravedad_estimada: form.gravedad_estimada || null,
        activo: true,
      })
      .select('id')
      .single()

    if (dbError || !newPaciente) {
      console.error('Supabase insert error:', dbError)
      setError('Error al guardar el paciente. Intentá de nuevo.')
      setLoading(false)
      return
    }

    if (esOtra && form.os_nombre_libre.trim()) {
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


    const medsFiltradas = medicaciones.filter((m) => m.farmaco.trim())
    if (medsFiltradas.length > 0) {
      await supabase.from('medicacion_paciente').insert(
        medsFiltradas.map((m) => ({
          terapeuta_id: terapeutaId,
          paciente_id: newPaciente.id,
          farmaco: m.farmaco.trim(),
          dosis: m.dosis || null,
          frecuencia: m.frecuencia || null,
          prescriptor: m.prescriptor || null,
        }))
      )
    }

    router.push('/pacientes')
    router.refresh()
  }

  return (
    <>
      {/* TopAppBar */}
      <header className="flex items-center justify-between px-8 h-16 bg-[#f7f9fb] sticky top-0 z-30 border-b border-[#e8eaf0]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h2 className="font-bold text-lg text-[#001a48]">Alta de Paciente</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-lg shadow-[0_8px_24px_rgba(0,26,72,0.06)] hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? 'Guardando...' : 'Guardar Paciente'}
          </button>
        </div>
      </header>

      {/* Datalists */}
      <datalist id="npf-paises">
        {PAISES.map((p) => <option key={p} value={p} />)}
      </datalist>
      <datalist id="npf-planes">
        {planesDisponibles.map((p) => <option key={p} value={p} />)}
      </datalist>

      {/* Form canvas */}
      <div className="p-8 max-w-5xl mx-auto w-full flex flex-col gap-8 pb-24">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Card 0 — Datos de identidad */}
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_rgba(0,26,72,0.06)]">
          <h3 className="font-semibold text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
            Datos de Identidad
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>
                Nombre <span className="text-error">*</span>
              </label>
              <input name="nombre" type="text" value={form.nombre} onChange={handleChange} placeholder="María" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                Apellido <span className="text-error">*</span>
              </label>
              <input name="apellido" type="text" value={form.apellido} onChange={handleChange} placeholder="García" className={inputCls} />
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
        </div>

        {/* Card 1 — Información Personal */}
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_rgba(0,26,72,0.06)]">
          <h3 className="font-semibold text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">person</span>
            Información Personal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <input
                name="nacionalidad"
                type="text"
                value={form.nacionalidad}
                onChange={handleChange}
                placeholder="Argentina"
                list="npf-paises"
                className={inputCls}
                autoComplete="off"
              />
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
            <div className="col-span-1 md:col-span-2">
              <label className={labelCls}>Domicilio</label>
              <input name="domicilio" type="text" value={form.domicilio} onChange={handleChange} placeholder="Av. Corrientes 1234, CABA" className={inputCls} />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-4 border-t border-outline-variant/20">
              <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-4">
                Contacto de emergencia
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>

        {/* Card 2 — Obra Social y Tratamiento */}
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_rgba(0,26,72,0.06)]">
          <h3 className="font-semibold text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">health_and_safety</span>
            Obra Social y Tratamiento
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="md:col-span-2 lg:col-span-3">
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
                  <input name="plan_obra_social" type="text" value={form.plan_obra_social} onChange={handleChange} placeholder={planesDisponibles.length ? 'Seleccionar o escribir...' : '310, Bronce, Gold...'} list="npf-planes" className={inputCls} autoComplete="off" />
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
              <CurrencyInput
                value={form.honorarios}
                onChange={(val) => setForm((prev) => ({ ...prev, honorarios: val }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Moneda de cobro preferida</label>
              <MonedaSelector value={monedaPreferida} onChange={setMonedaPreferida} className="w-full" />
            </div>
          </div>
        </div>

        {/* Card 3 — Resumen Clínico */}
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_rgba(0,26,72,0.06)]">
          <h3 className="font-semibold text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">clinical_notes</span>
            Resumen Clínico
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className={labelCls}>Motivo de Consulta</label>
              <textarea
                name="motivo_consulta"
                value={form.motivo_consulta}
                onChange={handleChange}
                rows={4}
                placeholder="¿Por qué consulta? Motivo de derivación, problemática principal..."
                className={`${inputCls} resize-none min-h-[100px]`}
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className={labelCls}>Notas de Evolución</label>
              <textarea
                name="notas"
                value={form.notas}
                onChange={handleChange}
                rows={6}
                placeholder="Evolución del tratamiento, observaciones generales..."
                className={`${inputCls} resize-none min-h-[150px]`}
              />
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
        </div>

        {/* Card 4 — Medicación */}
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_8px_24px_rgba(0,26,72,0.06)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">medication</span>
              Medicación
            </h3>
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
            <div className="text-center py-8 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2 block opacity-25">medication</span>
              <p className="text-sm">Sin medicación registrada</p>
              <p className="text-xs opacity-70 mt-1">Hacé clic en &quot;Agregar medicamento&quot; para sumar uno</p>
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
                  <div className="pr-8">
                    <label className={labelCls}>Frecuencia</label>
                    <input type="text" value={med.frecuencia} onChange={(e) => updateMedicacion(idx, 'frecuencia', e.target.value)} placeholder="1 vez al día" className={inputCls} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
