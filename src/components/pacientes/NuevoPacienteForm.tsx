'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PAISES, PLANES_POR_OS } from '@/lib/data/salud-ar'
import type { ProfesionalObraSocial } from '@/types/database'
import MonedaSelector from '@/components/ui/MonedaSelector'
import type { Moneda } from '@/lib/monedas'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { useCie10 } from '@/lib/hooks/useCie10'
import type { DatosContactoPaciente } from '@/types/database'
import './nuevo-paciente.css'

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

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    // bottom-24 (no bottom-6) por debajo de md: la action-bar fija de esta pantalla ocupa esa
    // franja en mobile — con bottom-6 el toast quedaba superpuesto arriba de Cancelar/Guardar.
    <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
      {msg}
    </div>
  )
}

export default function NuevoPacienteForm({ terapeutaId, obrasSociales = [], profObrasSociales = [], esColaborador = false }: { terapeutaId: string; obrasSociales?: string[]; profObrasSociales?: ProfesionalObraSocial[]; esColaborador?: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [monedaPreferida, setMonedaPreferida] = useState<Moneda>('ARS')
  const [medicaciones, setMedicaciones] = useState<MedicacionForm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const actionBarRef = useRef<HTMLDivElement>(null)
  const { cie10, cargarCie10 } = useCie10()

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

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

    try {
      const supabase = createClient()
      const esOtra = form.obra_social === 'Otra'

      const datosContacto: DatosContactoPaciente = {
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
      }

      let newPacienteId: string | null = null
      let dbError: { message: string } | null = null

      if (esColaborador) {
        const { data, error } = await supabase.rpc('crear_paciente_colaborador', {
          p_datos: datosContacto,
        })
        newPacienteId = data ?? null
        dbError = error
      } else {
        const { data, error } = await supabase
          .from('pacientes')
          .insert({
            terapeuta_id: terapeutaId,
            ...datosContacto,
            motivo_consulta: form.motivo_consulta || null,
            notas: form.notas || null,
            codigo_diagnostico: form.codigo_diagnostico || null,
            gravedad_estimada: form.gravedad_estimada || null,
            activo: true,
          })
          .select('id')
          .single()
        newPacienteId = data?.id ?? null
        dbError = error
      }

      if (dbError || !newPacienteId) {
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

      let medError: { message: string } | null = null
      const medsFiltradas = medicaciones.filter((m) => m.farmaco.trim())
      if (medsFiltradas.length > 0) {
        const { error } = await supabase.from('medicacion_paciente').insert(
          medsFiltradas.map((m) => ({
            terapeuta_id: terapeutaId,
            paciente_id: newPacienteId,
            farmaco: m.farmaco.trim(),
            dosis: m.dosis || null,
            frecuencia: m.frecuencia || null,
            prescriptor: m.prescriptor || null,
          }))
        )
        medError = error
        if (medError) {
          console.error('Error al guardar medicaciones:', medError)
          showToast('Paciente guardado, pero hubo un problema al guardar la medicación')
        }
      }

      if (!medError) {
        showToast('Paciente guardado correctamente')
      }
      setTimeout(() => {
        // Orden importa: refresh() invalida el cache de la ruta actual, no la de destino.
        // Hay que navegar primero y refrescar después para que /pacientes (Router Cache
        // del cliente) no sirva la lista stale sin el paciente recién creado.
        router.push('/pacientes')
        router.refresh()
      }, 1200)
    } catch (err) {
      console.error('Error al guardar paciente:', err)
      setError('No se pudo guardar el paciente. Intentá de nuevo.')
      setLoading(false)
    }
  }

  // Action bar vs. teclado virtual (mobile). Con <meta interactive-widget="resizes-content">
  // Chrome/Android redimensiona el viewport al abrir el teclado, así que `bottom:0` reacomoda
  // solo. iOS Safari NO soporta ese meta tag: el layout viewport no cambia, solo el
  // visualViewport, y una barra fixed puede quedar flotando sobre el teclado en vez de pegada
  // arriba de él. Mitigación: escuchamos visualViewport.resize/scroll y reposicionamos la barra
  // con un `bottom` calculado igual al borde inferior visible, en vez de confiar en bottom:0.
  // LIMITACIÓN CONOCIDA: validar en Safari iOS real (el simulator no siempre lo reproduce
  // fiel); si persiste flicker, evaluar escuchar focusin/focusout en los inputs para ocultar
  // la barra mientras el campo activo tiene foco.
  useEffect(() => {
    const actionBar = actionBarRef.current
    if (!actionBar || !window.visualViewport) return
    const vv = window.visualViewport
    function reposition() {
      const offsetBottom = window.innerHeight - (vv!.height + vv!.offsetTop)
      actionBar!.style.bottom = Math.max(0, offsetBottom) + 'px'
    }
    vv.addEventListener('resize', reposition)
    vv.addEventListener('scroll', reposition)
    reposition()
    return () => {
      vv.removeEventListener('resize', reposition)
      vv.removeEventListener('scroll', reposition)
    }
  }, [])

  const mostrarOtra = form.obra_social === 'Otra'
  const mostrarDatosOS = form.obra_social !== '' && form.obra_social !== 'Otra'

  return (
    <div className={`npf-scope ${GeistSans.variable} ${GeistMono.variable}`}>
      {/* Header */}
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Volver" onClick={() => router.back()}>
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1>Alta de Paciente</h1>
        <div className="topbar-actions">
          <button type="button" className="btn ghost" onClick={() => router.back()}>Cancelar</button>
          <button type="button" className="btn primary" onClick={handleSubmit} disabled={loading}>
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
      <datalist id="npf-cie10">
        {cie10.map((c) => <option key={c.codigo} value={c.codigo}>{c.descripcion}</option>)}
      </datalist>

      <main className="form-scroll">
        <div className="container">
          {error && (
            <div style={{ background: '#FFF4F2', border: '1px solid var(--coral-bg)', color: 'var(--coral-hover)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* Sección 1 — Datos de Identidad */}
          <section className="card" id="sec-identidad">
            <div className="sec-head"><h2>Datos de Identidad</h2></div>
            <div className="grid">
              <div className="field">
                <label>Nombre<em>*</em></label>
                <input name="nombre" type="text" value={form.nombre} onChange={handleChange} placeholder="María" />
              </div>
              <div className="field">
                <label>Apellido<em>*</em></label>
                <input name="apellido" type="text" value={form.apellido} onChange={handleChange} placeholder="García" />
              </div>
              <div className="field">
                <label>DNI</label>
                <input name="dni" type="text" className="mono" value={form.dni} onChange={handleChange} placeholder="12.345.678" />
              </div>
              <div className="field">
                <label>Fecha de Nacimiento</label>
                <input name="fecha_nacimiento" type="date" value={form.fecha_nacimiento} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input name="telefono" type="tel" className="mono" value={form.telefono} onChange={handleChange} placeholder="+54 11 1234-5678" />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="paciente@email.com" />
                {!form.email && (
                  <span className="hint warn">
                    <svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9L2.8 17a1.6 1.6 0 0 0 1.4 2.4h15.6a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0z" /></svg>
                    Sin email no se envían recordatorios automáticos de turnos
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Sección 2 — Información Personal */}
          <section className="card" id="sec-personal">
            <div className="sec-head"><h2>Información Personal</h2></div>
            <div className="grid">
              <div className="field">
                <label>Género</label>
                <select name="genero" value={form.genero} onChange={handleChange}>
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="NB">No Binario</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="field">
                <label>Nacionalidad</label>
                <input name="nacionalidad" type="text" value={form.nacionalidad} onChange={handleChange} placeholder="Argentina" list="npf-paises" autoComplete="off" />
              </div>
              <div className="field">
                <label>Estado Civil</label>
                <select name="estado_civil" value={form.estado_civil} onChange={handleChange}>
                  <option value="">Seleccionar...</option>
                  <option value="Soltero/a">Soltero/a</option>
                  <option value="Casado/a">Casado/a</option>
                  <option value="Divorciado/a">Divorciado/a</option>
                  <option value="Viudo/a">Viudo/a</option>
                  <option value="En pareja">En pareja</option>
                </select>
              </div>
              <div className="field">
                <label>Ocupación</label>
                <input name="ocupacion" type="text" value={form.ocupacion} onChange={handleChange} placeholder="Docente, ingeniero..." />
              </div>
              <div className="field span-2">
                <label>Domicilio</label>
                <input name="domicilio" type="text" value={form.domicilio} onChange={handleChange} placeholder="Av. Corrientes 1234, CABA" />
              </div>
            </div>
            <div className="subblock">
              <div className="subblock-title">Contacto de emergencia</div>
              <div className="grid">
                <div className="field">
                  <label>Nombre Completo</label>
                  <input name="contacto_emergencia_nombre" type="text" value={form.contacto_emergencia_nombre} onChange={handleChange} placeholder="Juan García" />
                </div>
                <div className="field">
                  <label>Teléfono</label>
                  <input name="contacto_emergencia_telefono" type="tel" className="mono" value={form.contacto_emergencia_telefono} onChange={handleChange} placeholder="+54 11 1234-5678" />
                </div>
              </div>
            </div>
          </section>

          {/* Sección 3 — Obra Social y Tratamiento */}
          <section className="card" id="sec-obra">
            <div className="sec-head"><h2>Obra Social y Tratamiento</h2></div>
            <div className="grid">
              <div className="field span-2">
                <label>Obra Social / Prepaga</label>
                <select name="obra_social" value={form.obra_social} onChange={handleObraChange}>
                  <option value="">Sin obra social / Particular</option>
                  {obrasSociales.map((o) => <option key={o} value={o}>{o}</option>)}
                  <option value="Otra">Otra (no figura en la lista)</option>
                </select>
              </div>
            </div>

            <div className={`collapsible ${mostrarOtra ? 'open' : ''}`}>
              <div className="collapsible-inner">
                <div className="grid">
                  <div className="field">
                    <label>Nombre de la obra social<em>*</em></label>
                    <input name="os_nombre_libre" type="text" value={form.os_nombre_libre} onChange={handleChange} placeholder="Ej: OSJERA, IOSE Regional..." />
                  </div>
                  <div className="field">
                    <label>Plan</label>
                    <input name="os_plan_libre" type="text" value={form.os_plan_libre} onChange={handleChange} placeholder="Plan 310, Básico... (opcional)" />
                  </div>
                </div>
              </div>
            </div>

            <div className={`collapsible ${mostrarDatosOS ? 'open' : ''}`}>
              <div className="collapsible-inner">
                <div className="grid">
                  <div className="field">
                    <label>Plan</label>
                    <input name="plan_obra_social" type="text" value={form.plan_obra_social} onChange={handleChange} placeholder={planesDisponibles.length ? 'Seleccionar o escribir...' : '310, Bronce, Gold...'} list="npf-planes" autoComplete="off" />
                  </div>
                  <div className="field">
                    <label>N° de Afiliado</label>
                    <input name="numero_afiliado" type="text" className="mono" value={form.numero_afiliado} onChange={handleChange} placeholder="123456789" />
                  </div>
                  <div className="field">
                    <label>N° de Autorización</label>
                    <input name="numero_autorizacion" type="text" className="mono" value={form.numero_autorizacion} onChange={handleChange} placeholder="5917639" />
                  </div>
                  <div className="field">
                    <label>Vigencia desde</label>
                    <input name="autorizacion_vigencia_desde" type="date" value={form.autorizacion_vigencia_desde} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>Vigencia hasta</label>
                    <input name="autorizacion_vigencia_hasta" type="date" value={form.autorizacion_vigencia_hasta} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid" style={{ marginTop: 16 }}>
              <div className="field">
                <label>Modalidad</label>
                <select name="modalidad_tratamiento" value={form.modalidad_tratamiento} onChange={handleChange}>
                  <option value="">Seleccionar...</option>
                  <option value="presencial">Presencial</option>
                  <option value="videollamada">Videollamada</option>
                  <option value="telefonica">Telefónica</option>
                </select>
              </div>
              <div className="field">
                <label>Frecuencia</label>
                <select name="frecuencia_sesiones" value={form.frecuencia_sesiones} onChange={handleChange}>
                  <option value="">Seleccionar...</option>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                  <option value="a_demanda">A demanda</option>
                </select>
              </div>
              <div className="field">
                <label>Honorarios por sesión</label>
                <CurrencyInput
                  value={form.honorarios}
                  onChange={(val) => setForm((prev) => ({ ...prev, honorarios: val }))}
                  className="mono"
                />
              </div>
              <div className="field">
                <label>Moneda de cobro preferida</label>
                <MonedaSelector value={monedaPreferida} onChange={setMonedaPreferida} variant="toggle" />
              </div>
            </div>
          </section>

          {/* Sección 4 — Resumen Clínico */}
          <section className="card" id="sec-clinico">
            <div className="sec-head"><h2>Resumen Clínico</h2><span className="tag-clinico">Clínico</span></div>
            <div className="grid">
              <div className="field span-2">
                <label>Motivo de Consulta</label>
                <textarea
                  name="motivo_consulta"
                  className="short"
                  value={form.motivo_consulta}
                  onChange={handleChange}
                  rows={4}
                  placeholder="¿Por qué consulta? Motivo de derivación, problemática principal..."
                />
              </div>
              <div className="field span-2">
                <label>Notas de Evolución</label>
                <textarea
                  name="notas"
                  className="tall"
                  value={form.notas}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Evolución del tratamiento, observaciones generales..."
                />
              </div>
              <div className="field">
                <label>Código Diagnóstico CIE / DSM</label>
                <input name="codigo_diagnostico" type="text" className="mono" value={form.codigo_diagnostico} onChange={handleChange} onFocus={cargarCie10} placeholder="F41.1, 300.02..." list="npf-cie10" autoComplete="off" />
              </div>
              <div className="field">
                <label>Gravedad Estimada</label>
                <select name="gravedad_estimada" value={form.gravedad_estimada} onChange={handleChange}>
                  <option value="">Seleccionar...</option>
                  <option value="leve">Leve</option>
                  <option value="moderada">Moderada</option>
                  <option value="grave">Grave</option>
                </select>
              </div>
            </div>
          </section>

          {/* Sección 5 — Medicación */}
          <section className="card" id="sec-medicacion">
            <div className="sec-head"><h2>Medicación</h2><span className="tag-clinico">Clínico</span></div>

            <div className="med-list">
              {medicaciones.length === 0 ? (
                <div className="med-empty">
                  <svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(45 12 12)" /><path d="M8 8l8 8" /></svg>
                  <span>No hay medicación cargada</span>
                </div>
              ) : (
                medicaciones.map((med, idx) => (
                  <div key={idx} className="med-row">
                    <div className="med-row-top">
                      <div className="field">
                        <label>Fármaco<em>*</em></label>
                        <input type="text" value={med.farmaco} onChange={(e) => updateMedicacion(idx, 'farmaco', e.target.value)} placeholder="Fluoxetina" />
                      </div>
                      <button type="button" className="med-del" aria-label="Eliminar medicamento" onClick={() => removeMedicacion(idx)}>
                        <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                      </button>
                    </div>
                    <div className="med-row-bottom">
                      <div className="field">
                        <label>Dosis</label>
                        <input type="text" className="mono" value={med.dosis} onChange={(e) => updateMedicacion(idx, 'dosis', e.target.value)} placeholder="20mg" />
                      </div>
                      <div className="field">
                        <label>Frecuencia</label>
                        <input type="text" value={med.frecuencia} onChange={(e) => updateMedicacion(idx, 'frecuencia', e.target.value)} placeholder="1 vez al día" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button type="button" className="btn-add" onClick={addMedicacion}>
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              Agregar medicamento
            </button>
          </section>
        </div>
        <div className="bottom-spacer" />
      </main>

      {/* Action bar fija (mobile) — reposicionada con visualViewport, ver useEffect arriba */}
      <div className="action-bar" ref={actionBarRef}>
        <button type="button" className="btn ghost" onClick={() => router.back()}>Cancelar</button>
        <button type="button" className="btn primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Paciente'}
        </button>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
