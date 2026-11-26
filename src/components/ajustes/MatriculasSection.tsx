'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { PAISES_PROVINCIAS } from '@/lib/geografica'
import type { Database } from '@/types/database'
import type { RefepsValidationResponse } from '@/types/sisa'

type ProfesionalMatricula = Database['public']['Tables']['profesional_matriculas']['Row']

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 12px', height: 38,
  font: 'inherit', fontSize: 14, color: 'var(--ink)',
  background: 'var(--surface)', outline: 'none', width: '100%',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted-2)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
}
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 16 }

function Chip({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'muted' }) {
  const colors = {
    ok: { bg: 'var(--ok-soft)', fg: 'var(--ok)' },
    warn: { bg: 'var(--amber-soft)', fg: 'var(--amber-ink)' },
    muted: { bg: 'var(--surface-2)', fg: 'var(--muted)' },
  }[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px',
      borderRadius: 100, fontSize: 11, fontWeight: 600,
      background: colors.bg, color: colors.fg, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

function etiquetaTipo(tipo: string | null): string {
  return tipo === 'provincial' ? 'Provincial' : tipo === 'nacional' ? 'Nacional' : 'Sin clasificar'
}

function formatearNumero(m: ProfesionalMatricula): string {
  if (m.tipo === 'provincial') return `MP ${m.numero}`
  if (m.tipo === 'nacional') return `MN ${m.numero}`
  return m.numero
}

const ESTADO_REFEPS_MENSAJE: Record<string, { texto: string; tono: 'ok' | 'warn' | 'muted' }> = {
  habilitada: { texto: 'Matrícula verificada y habilitada en el REFEPS.', tono: 'ok' },
  no_habilitada: { texto: 'Encontramos tu matrícula en el REFEPS, pero figura no habilitada.', tono: 'warn' },
  sin_ficha: { texto: 'No encontramos tu ficha en el REFEPS con ese DNI.', tono: 'warn' },
  no_coincide: { texto: 'El número de matrícula no coincide con los registros encontrados para ese DNI.', tono: 'warn' },
  // Un error del Bus nunca se muestra como "no habilitado" — es un problema
  // de conexión, no un dato real sobre la matrícula.
  error_servicio: { texto: 'No pudimos conectarnos con el REFEPS en este momento. Probá de nuevo más tarde.', tono: 'muted' },
}

export default function MatriculasSection({ profesionalId, dniInicial, matriculasIniciales }: {
  profesionalId: string
  dniInicial: string | null
  matriculasIniciales: ProfesionalMatricula[]
}) {
  const [matriculas, setMatriculas] = useState<ProfesionalMatricula[]>(matriculasIniciales)

  async function refetch() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profesional_matriculas')
      .select('*')
      .eq('profesional_id', profesionalId)
      .order('created_at', { ascending: true })
    if (data) setMatriculas(data)
  }

  // ── Editor (cargar / editar / indicar tipo) ───────────────────────────
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [editorTipoFijo, setEditorTipoFijo] = useState<'provincial' | 'nacional' | null>(null)
  const [editorTipo, setEditorTipo] = useState<'provincial' | 'nacional' | ''>('')
  const [editorProvincia, setEditorProvincia] = useState('')
  const [editorNumero, setEditorNumero] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [confirmEliminarId, setConfirmEliminarId] = useState<string | null>(null)
  const [eliminarLoading, setEliminarLoading] = useState(false)

  function abrirCargar(tipo: 'provincial' | 'nacional') {
    setEditorId(null)
    setEditorTipoFijo(tipo)
    setEditorTipo(tipo)
    setEditorProvincia('')
    setEditorNumero('')
    setEditorError(null)
    setEditorOpen(true)
  }

  function abrirEditar(m: ProfesionalMatricula) {
    setEditorId(m.id)
    // Si ya tiene tipo, queda fijo (no se puede pasar de provincial a
    // nacional editando); si no tiene tipo ("Indicar tipo"), se puede elegir.
    setEditorTipoFijo(m.tipo === 'provincial' || m.tipo === 'nacional' ? m.tipo : null)
    setEditorTipo((m.tipo as 'provincial' | 'nacional' | null) ?? '')
    setEditorProvincia(m.provincia ?? '')
    setEditorNumero(m.numero)
    setEditorError(null)
    setEditorOpen(true)
  }

  async function guardarEditor(e: React.FormEvent) {
    e.preventDefault()
    setEditorError(null)
    if (!editorTipo) { setEditorError('Seleccioná el tipo de matrícula.') ; return }
    if (editorTipo === 'provincial' && !editorProvincia) { setEditorError('Seleccioná la provincia.'); return }
    if (!editorNumero.trim()) { setEditorError('Ingresá el número de matrícula.'); return }

    setEditorLoading(true)
    const supabase = createClient()
    const payload = {
      tipo: editorTipo,
      provincia: editorTipo === 'provincial' ? editorProvincia : null,
      numero: editorNumero.trim(),
    }
    const { error } = editorId
      ? await supabase.from('profesional_matriculas').update(payload).eq('id', editorId)
      : await supabase.from('profesional_matriculas').insert({ ...payload, profesional_id: profesionalId, origen: 'manual', verificada: false })

    setEditorLoading(false)
    if (error) { setEditorError('No se pudo guardar. ' + error.message); return }
    await refetch()
    setEditorOpen(false)
  }

  async function confirmarEliminar() {
    if (!confirmEliminarId) return
    setEliminarLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('profesional_matriculas').delete().eq('id', confirmEliminarId)
    setEliminarLoading(false)
    setConfirmEliminarId(null)
    if (!error) {
      await refetch()
      setEditorOpen(false)
    }
  }

  async function marcarPrincipal(id: string) {
    const supabase = createClient()
    await supabase.rpc('marcar_matricula_principal', { p_matricula_id: id })
    await refetch()
  }

  // ── Verificar con REFEPS ───────────────────────────────────────────────
  const principal = matriculas.find((m) => m.es_principal) ?? null
  const [verOpen, setVerOpen] = useState(false)
  const [verDni, setVerDni] = useState(dniInicial ?? '')
  const [verNumero, setVerNumero] = useState(principal?.numero ?? '')
  const [verConsentimiento, setVerConsentimiento] = useState(false)
  const [verLoading, setVerLoading] = useState(false)
  const [verError, setVerError] = useState<string | null>(null)
  const [verResultado, setVerResultado] = useState<{ texto: string; tono: 'ok' | 'warn' | 'muted' } | null>(null)

  function abrirVerificar() {
    setVerDni(dniInicial ?? '')
    setVerNumero(principal?.numero ?? '')
    setVerConsentimiento(false)
    setVerError(null)
    setVerResultado(null)
    setVerOpen(true)
  }

  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault()
    setVerError(null)
    setVerResultado(null)
    if (!verDni.trim() || !verNumero.trim()) { setVerError('Completá el DNI y el número de matrícula.'); return }
    if (!verConsentimiento) { setVerError('Tenés que aceptar el consentimiento para consultar el REFEPS.'); return }

    setVerLoading(true)
    try {
      const res = await fetch('/api/v1/refeps/validate-professional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: verDni.trim(), matricula: verNumero.trim(), consentimiento: true }),
      })
      if (res.status === 429) {
        const json = await res.json().catch(() => ({}))
        setVerError(json.error ?? 'Demasiados intentos. Esperá un rato y volvé a intentar.')
        return
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setVerError(json.error ?? 'No se pudo verificar la matrícula.')
        return
      }
      const data = await res.json() as RefepsValidationResponse
      setVerResultado(ESTADO_REFEPS_MENSAJE[data.estado] ?? { texto: 'Verificación completada.', tono: 'muted' })
      if (data.estado === 'habilitada' || data.estado === 'no_habilitada') {
        await refetch()
      }
    } catch {
      setVerError('No se pudo conectar con el servidor. Probá de nuevo.')
    } finally {
      setVerLoading(false)
    }
  }

  // ── Resumen para el header del acordeón ───────────────────────────────
  const hayVerificada = matriculas.some((m) => m.verificada)
  const estadoGeneral: { text: string; tone: 'ok' | 'warn' } = matriculas.length === 0
    ? { text: 'Falta cargar', tone: 'warn' }
    : hayVerificada
    ? { text: 'Verificada', tone: 'ok' }
    : { text: 'Sin verificar', tone: 'warn' }

  const descAccordion = matriculas.length === 0
    ? 'Sin cargar'
    : `${matriculas.filter((m) => m.tipo).map((m) => formatearNumero(m)).join(' · ')}${matriculas.some((m) => !m.tipo) ? ' · sin clasificar' : ''} · ${hayVerificada ? 'Verificada' : 'Sin verificar'}`

  const sinClasificar = matriculas.filter((m) => !m.tipo)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{descAccordion}</span>
        <Chip text={estadoGeneral.text} tone={estadoGeneral.tone} />
      </div>

      {/* Banner de verificación */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '12px 14px', borderRadius: 10, marginTop: 10, marginBottom: 16,
        background: hayVerificada ? 'var(--ok-soft)' : 'var(--accent-soft-2)',
        border: `1px solid ${hayVerificada ? 'var(--ok)' : 'var(--accent-soft)'}`,
      }}>
        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: hayVerificada ? 'var(--ok)' : 'var(--accent)', strokeWidth: 2, fill: 'none', flexShrink: 0 }}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" />
        </svg>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
            {hayVerificada ? 'Matrícula verificada con REFEPS' : matriculas.length === 0 ? 'Cargá al menos una matrícula' : 'Verificá tu matrícula con REFEPS'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            {hayVerificada
              ? 'Con tu DNI traemos todas las matrículas que tenés. Alcanza con una para verificar tu perfil.'
              : 'Completamos tu perfil automáticamente y habilitás las recetas electrónicas. Alcanza con la provincial o la nacional.'}
          </div>
        </div>
        <button type="button" onClick={abrirVerificar} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--ink)', color: 'white', whiteSpace: 'nowrap' }}>
          {hayVerificada ? 'Volver a verificar' : 'Verificar con REFEPS'}
        </button>
      </div>

      {/* Filas Provincial / Nacional */}
      {(['provincial', 'nacional'] as const).map((tipo) => {
        const filas = matriculas.filter((m) => m.tipo === tipo)
        if (filas.length === 0) {
          return (
            <div key={tipo} style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{etiquetaTipo(tipo)}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 10px' }}>No cargada · opcional si cargaste la otra</div>
              <button type="button" onClick={() => abrirCargar(tipo)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}>
                + Cargar matrícula {tipo}
              </button>
            </div>
          )
        }
        return filas.map((m) => (
          <FilaMatricula key={m.id} m={m} onEditar={() => abrirEditar(m)} onEliminar={() => setConfirmEliminarId(m.id)} onMarcarPrincipal={() => marcarPrincipal(m.id)} />
        ))
      })}

      {/* Filas sin clasificar (propuesta: ver resumen de la entrega) */}
      {sinClasificar.map((m) => (
        <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sin clasificar</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 2, fontFamily: 'monospace' }}>{m.numero}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Chip text={m.verificada ? 'Verificada' : 'Sin verificar'} tone={m.verificada ? 'ok' : 'warn'} />
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => abrirEditar(m)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              Indicar tipo
            </button>
          </div>
        </div>
      ))}

      <p style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 14, lineHeight: 1.5 }}>
        La principal es la que sale en recetas y certificados. Si REFEPS trae más de una provincial, aparecen todas.
      </p>

      {/* SlideOver: Verificar con REFEPS */}
      <SlideOver
        open={verOpen}
        onClose={() => { if (!verLoading) setVerOpen(false) }}
        title="Verificar con REFEPS"
        width="sm"
        footer={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            {verError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{verError}</span>}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setVerOpen(false)} disabled={verLoading} style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}>
              Cerrar
            </button>
            <button type="submit" form="form-verificar-refeps" disabled={verLoading} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: verLoading ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--ink)', color: 'white', opacity: verLoading ? 0.7 : 1 }}>
              {verLoading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
        )}
      >
        <form id="form-verificar-refeps" onSubmit={handleVerificar}>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 16px' }}>
            Consultamos el registro del Ministerio de Salud de la Nación con tu DNI y un número de matrícula que coincida. Si tenés más de una matrícula, traemos todas.
          </p>
          <div style={fieldStyle}>
            <label style={labelStyle}>DNI</label>
            <input style={inputStyle} type="text" inputMode="numeric" value={verDni} onChange={(e) => setVerDni(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 27704316" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Número de matrícula a verificar</label>
            <input style={inputStyle} type="text" value={verNumero} onChange={(e) => setVerNumero(e.target.value)} placeholder="Ej: 123456" />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer', lineHeight: 1.5 }}>
            <input type="checkbox" checked={verConsentimiento} onChange={(e) => setVerConsentimiento(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1, cursor: 'pointer', flexShrink: 0 }} />
            Autorizo a consultar mis datos de matrícula en el Registro Federal de Establecimientos y Profesionales de Salud (REFEPS).
          </label>

          {verResultado && (
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
              background: verResultado.tono === 'ok' ? 'var(--ok-soft)' : verResultado.tono === 'warn' ? 'var(--amber-soft)' : 'var(--surface-2)',
              color: verResultado.tono === 'ok' ? 'var(--ok)' : verResultado.tono === 'warn' ? 'var(--amber-ink)' : 'var(--muted)',
            }}>
              {verResultado.texto}
            </div>
          )}
        </form>
      </SlideOver>

      {/* SlideOver: Cargar / editar matrícula */}
      <SlideOver
        open={editorOpen}
        onClose={() => { if (!editorLoading) setEditorOpen(false) }}
        title={editorId ? 'Editar matrícula' : `Cargar matrícula ${editorTipoFijo ?? ''}`}
        width="sm"
        footer={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            {editorId && (
              <button type="button" onClick={() => setConfirmEliminarId(editorId)} style={{ background: 'none', border: 'none', color: '#DC2626', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
                Eliminar
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setEditorOpen(false)} disabled={editorLoading} style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}>
              Cancelar
            </button>
            <button type="submit" form="form-editor-matricula" disabled={editorLoading} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: editorLoading ? 'not-allowed' : 'pointer', border: 'none', background: 'var(--ink)', color: 'white', opacity: editorLoading ? 0.7 : 1 }}>
              {editorLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      >
        <form id="form-editor-matricula" onSubmit={guardarEditor}>
          {editorError && (
            <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
              {editorError}
            </div>
          )}
          <div style={fieldStyle}>
            <label style={labelStyle}>Tipo de matrícula</label>
            {editorTipoFijo ? (
              <input style={{ ...inputStyle, background: 'var(--surface-2)', color: 'var(--muted)' }} value={etiquetaTipo(editorTipoFijo)} readOnly />
            ) : (
              <select style={inputStyle} value={editorTipo} onChange={(e) => setEditorTipo(e.target.value as 'provincial' | 'nacional')}>
                <option value="">Seleccioná el tipo</option>
                <option value="provincial">Provincial</option>
                <option value="nacional">Nacional</option>
              </select>
            )}
          </div>
          {editorTipo === 'provincial' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Provincia</label>
              <select style={inputStyle} value={editorProvincia} onChange={(e) => setEditorProvincia(e.target.value)}>
                <option value="">Seleccioná la provincia</option>
                {(PAISES_PROVINCIAS['Argentina'] ?? []).map((prov) => <option key={prov} value={prov}>{prov}</option>)}
              </select>
            </div>
          )}
          <div style={fieldStyle}>
            <label style={labelStyle}>Número de matrícula</label>
            <input style={inputStyle} type="text" value={editorNumero} onChange={(e) => setEditorNumero(e.target.value)} placeholder="Ej: 12345" />
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={!!confirmEliminarId}
        title="Eliminar matrícula"
        message="Esta acción no se puede deshacer."
        confirmLabel={eliminarLoading ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
        onConfirm={confirmarEliminar}
        onCancel={() => setConfirmEliminarId(null)}
      />
    </>
  )
}

function FilaMatricula({ m, onEditar, onEliminar, onMarcarPrincipal }: {
  m: ProfesionalMatricula
  onEditar: () => void
  onEliminar: () => void
  onMarcarPrincipal: () => void
}) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  return (
    <div style={{
      border: `1px solid ${m.es_principal ? 'var(--ink)' : 'var(--border)'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 10, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid var(--border)', borderRadius: 100, padding: '2px 8px' }}>
          {etiquetaTipo(m.tipo)}
        </span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{formatearNumero(m)}</span>
      </div>
      {(m.profesion_nombre || m.provincia) && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
          {[m.profesion_nombre, m.tipo === 'provincial' ? m.provincia : null].filter(Boolean).join(' · ')}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <Chip text={m.verificada ? 'Verificada' : 'Sin verificar'} tone={m.verificada ? 'ok' : 'warn'} />
        <div style={{ flex: 1 }} />
        {m.es_principal ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>★ Principal</span>
        ) : (
          <button type="button" onClick={onMarcarPrincipal} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
            Marcar como principal
          </button>
        )}
        {m.origen === 'manual' && (
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setMenuAbierto((v) => !v)} aria-label="Más acciones" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-2)', borderRadius: 6 }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor' }}>
                <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            {menuAbierto && (
              <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 10, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(14,20,48,.14)', padding: 4 }}>
                <button type="button" onClick={() => { setMenuAbierto(false); onEditar() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: 'none', background: 'none', fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                  Editar
                </button>
                <button type="button" onClick={() => { setMenuAbierto(false); onEliminar() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: 'none', background: 'none', fontSize: 13, color: '#DC2626', cursor: 'pointer' }}>
                  Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
