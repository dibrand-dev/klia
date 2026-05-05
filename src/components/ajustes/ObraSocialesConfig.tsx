'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProfesionalObraSocial } from '@/types/database'
import { OBRAS_SOCIALES } from '@/lib/obras-sociales'
import SlideOver from '@/components/ui/SlideOver'

type Template = { id: string; nombre_os: string; slug: string }

type FormOS = {
  nombre: string
  nombreLibre: string
  razon_social: string
  cuit_os: string
  domicilio_os: string
  condicion_iva_os: string
  condicion_venta: string
  codigo_practica: string
  descripcion_practica: string
  honorario_por_sesion: string
  planilla_template_id: string
}

const BLANK: FormOS = {
  nombre: '',
  nombreLibre: '',
  razon_social: '',
  cuit_os: '',
  domicilio_os: '',
  condicion_iva_os: 'IVA Responsable Inscripto',
  condicion_venta: 'Cuenta Corriente',
  codigo_practica: '',
  descripcion_practica: '',
  honorario_por_sesion: '',
  planilla_template_id: '',
}

const MATCH_OS_TEMPLATE: Record<string, string> = {
  'Hospital Italiano': 'hospital-italiano',
  'Obra Social de Choferes de Camiones': 'choferes-camiones',
  'OSPETELCO': 'ospetelco',
  'OMINT': 'omint',
}

const inputCls = 'w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors'
const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5'

function formatPrecio(n: number | null) {
  if (!n) return '$0'
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function OSRowMenu({ onEdit, onToggle, activa }: { onEdit: () => void; onToggle: () => void; activa: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 min-w-[160px] z-20 py-1">
            <button onClick={() => { setOpen(false); onEdit() }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Editar</button>
            <button onClick={() => { setOpen(false); onToggle() }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              {activa ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function ObraSocialesConfig({ initialList, terapeutaId }: {
  initialList: ProfesionalObraSocial[]
  terapeutaId: string
}) {
  const [list, setList] = useState<ProfesionalObraSocial[]>(initialList)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editing, setEditing] = useState<ProfesionalObraSocial | null>(null)
  const [form, setForm] = useState<FormOS>(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    createClient()
      .from('planilla_templates')
      .select('id, nombre_os, slug')
      .eq('activa', true)
      .order('nombre_os')
      .then(({ data }) => setTemplates(data ?? []))
  }, [])

  useEffect(() => {
    if (editing) {
      const enLista = OBRAS_SOCIALES.includes(editing.nombre)
      setForm({
        nombre: enLista ? editing.nombre : '__otra__',
        nombreLibre: enLista ? '' : editing.nombre,
        razon_social: editing.razon_social ?? '',
        cuit_os: editing.cuit_os ?? '',
        domicilio_os: editing.domicilio_os ?? '',
        condicion_iva_os: editing.condicion_iva_os,
        condicion_venta: editing.condicion_venta,
        codigo_practica: editing.codigo_practica ?? '',
        descripcion_practica: editing.descripcion_practica ?? '',
        honorario_por_sesion: editing.honorario_por_sesion?.toString() ?? '',
        planilla_template_id: editing.planilla_template_id ?? '',
      })
    } else {
      setForm(BLANK)
    }
  }, [editing])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'nombre' && value !== '__otra__' && !editing?.planilla_template_id) {
        const slug = MATCH_OS_TEMPLATE[value]
        const matched = slug ? templates.find(t => t.slug === slug) : null
        next.planilla_template_id = matched?.id ?? prev.planilla_template_id
      }
      return next
    })
  }

  function openNueva() { setEditing(null); setError(null); setSlideOpen(true) }
  function openEditar(os: ProfesionalObraSocial) { setEditing(os); setError(null); setSlideOpen(true) }

  async function handleSave() {
    const nombreFinal = form.nombre === '__otra__' ? form.nombreLibre.trim() : form.nombre
    if (!nombreFinal) { setError('El nombre es obligatorio'); return }
    if (!form.honorario_por_sesion) { setError('El honorario es obligatorio'); return }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const honorario = parseFloat(form.honorario_por_sesion)

    const payload = {
      nombre: nombreFinal,
      razon_social: form.razon_social.trim() || null,
      cuit_os: form.cuit_os.trim() || null,
      domicilio_os: form.domicilio_os.trim() || null,
      condicion_iva_os: form.condicion_iva_os,
      condicion_venta: form.condicion_venta,
      codigo_practica: form.codigo_practica.trim() || null,
      descripcion_practica: form.descripcion_practica.trim() || null,
      honorario_por_sesion: honorario,
      planilla_template_id: form.planilla_template_id || null,
    }

    if (editing) {
      const { data, error: err } = await supabase
        .from('profesional_obras_sociales')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      if (honorario !== editing.honorario_por_sesion) {
        await supabase.from('os_honorarios_historial').insert({
          os_config_id: editing.id,
          honorario,
          vigente_desde: new Date().toISOString().slice(0, 10),
        })
      }
      setList(prev => prev.map(o => o.id === editing.id ? data : o))
    } else {
      const { data, error: err } = await supabase
        .from('profesional_obras_sociales')
        .insert({ ...payload, terapeuta_id: terapeutaId })
        .select()
        .single()
      if (err) { setError(err.message); setSaving(false); return }
      await supabase.from('os_honorarios_historial').insert({
        os_config_id: data.id,
        honorario,
        vigente_desde: new Date().toISOString().slice(0, 10),
      })
      setList(prev => [...prev, data])
    }
    setSaving(false)
    setSlideOpen(false)
  }

  async function handleToggle(os: ProfesionalObraSocial) {
    const supabase = createClient()
    await supabase.from('profesional_obras_sociales').update({ activa: !os.activa }).eq('id', os.id)
    setList(prev => prev.map(o => o.id === os.id ? { ...o, activa: !o.activa } : o))
  }

  const templateById = Object.fromEntries(templates.map(t => [t.id, t]))

  return (
    <>
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? 'Editar obra social' : 'Nueva obra social'}
        width="md"
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className={labelCls}>Nombre de la obra social <span className="text-red-500">*</span></label>
            <select name="nombre" value={form.nombre} onChange={handleChange} className={inputCls}>
              <option value="">Seleccioná una obra social...</option>
              {OBRAS_SOCIALES.map(os => (
                <option key={os} value={os}>{os}</option>
              ))}
              <option value="__otra__">Otra (escribir manualmente)</option>
            </select>
          </div>

          {form.nombre === '__otra__' && (
            <div>
              <label className={labelCls}>Escribí el nombre <span className="text-red-500">*</span></label>
              <input
                name="nombreLibre"
                value={form.nombreLibre}
                onChange={handleChange}
                placeholder="Nombre de la obra social..."
                className={inputCls}
                autoFocus
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Razón social completa</label>
            <input name="razon_social" value={form.razon_social} onChange={handleChange} placeholder="Institución del Diagnóstico S.A." className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>CUIT de la obra social</label>
              <input name="cuit_os" value={form.cuit_os} onChange={handleChange} placeholder="30-12345678-9" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Domicilio</label>
              <input name="domicilio_os" value={form.domicilio_os} onChange={handleChange} placeholder="Av. Rivadavia 1234" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Condición IVA</label>
              <select name="condicion_iva_os" value={form.condicion_iva_os} onChange={handleChange} className={inputCls}>
                <option>IVA Responsable Inscripto</option>
                <option>IVA Exento</option>
                <option>Monotributo</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Condición de venta</label>
              <select name="condicion_venta" value={form.condicion_venta} onChange={handleChange} className={inputCls}>
                <option>Cuenta Corriente</option>
                <option>Contado</option>
              </select>
            </div>
          </div>

          <div className="border-t border-outline-variant/20 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Datos de práctica</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Código de práctica</label>
                <input name="codigo_practica" value={form.codigo_practica} onChange={handleChange} placeholder="981031" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Descripción de práctica</label>
                <input name="descripcion_practica" value={form.descripcion_practica} onChange={handleChange} placeholder="PRESTACION DE APOYO" className={inputCls} />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>Honorario por sesión (ARS) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">$</span>
                <input
                  name="honorario_por_sesion"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.honorario_por_sesion}
                  onChange={handleChange}
                  placeholder="17722.15"
                  className={`${inputCls} pl-6`}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant/20 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Planilla de asistencia</p>
            <label className={labelCls}>Plantilla de planilla</label>
            <select name="planilla_template_id" value={form.planilla_template_id} onChange={handleChange} className={inputCls}>
              <option value="">Sin plantilla configurada</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.nombre_os}</option>
              ))}
            </select>
            {form.planilla_template_id ? (
              <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                <span>✅</span> Planilla configurada · al generar usará esta plantilla automáticamente
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant/60 mt-1.5">
                Sin plantilla, no se podrá generar planilla de asistencia para esta OS.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setSlideOpen(false)} disabled={saving} className="btn-secondary flex-1 py-2.5">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 disabled:opacity-70">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </SlideOver>

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-14 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">health_and_safety</span>
            <p className="text-sm">No hay obras sociales configuradas.</p>
            <p className="text-xs mt-1 opacity-60">Agregá la primera para comenzar a liquidar.</p>
          </div>
        ) : (
          list.map(os => {
            const tmpl = os.planilla_template_id ? templateById[os.planilla_template_id] : null
            return (
              <div key={os.id} className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-on-surface">{os.nombre}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${os.activa ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {os.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Código: {os.codigo_practica || '—'} · {formatPrecio(os.honorario_por_sesion)}/sesión
                    {tmpl
                      ? <span className="text-emerald-600"> · 📄 Planilla: {tmpl.nombre_os}</span>
                      : <span className="text-amber-600"> · ⚠️ Sin plantilla de planilla</span>
                    }
                  </p>
                </div>
                <button
                  onClick={() => openEditar(os)}
                  className="text-xs text-primary hover:underline font-medium px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Editar
                </button>
                <OSRowMenu onEdit={() => openEditar(os)} onToggle={() => handleToggle(os)} activa={os.activa} />
              </div>
            )
          })
        )}

        <button
          onClick={openNueva}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant/30 rounded-2xl text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Agregar obra social
        </button>
      </div>
    </>
  )
}
