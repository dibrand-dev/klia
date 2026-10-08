'use client'

import { useState } from 'react'
import type { TipoTurno } from '@/types/database'
import SlideOver from '@/components/ui/SlideOver'
import MontoInput from '@/components/ui/MontoInput'
import { getTerminologia } from '@/hooks/useTerminologia'
import { parsearMontoInput, formatearMontoInputInicial } from '@/lib/monedas'
import './tipos-turno.css'

export type SedeTipoTurno = {
  id: string
  nombre: string
  direccion: string | null
  es_online: boolean
  color: string
}

export type TipoTurnoConSedes = TipoTurno & { sucursal_ids: string[] }

interface Props {
  plan: string
  habilitado: boolean
  tiposIniciales: TipoTurnoConSedes[]
  terminologia?: 'sesion' | 'consulta'
  sedes: SedeTipoTurno[]
}

const PLAN_NAME: Record<string, string> = { esencial: 'Esencial', profesional: 'Profesional', premium: 'Premium', bonificado: 'Bonificado' }
const SYM: Record<string, string> = { ARS: '$', USD: 'US$', EUR: '€' }
const MONEDAS = ['ARS', 'USD', 'EUR'] as const

function money(precio: number | null, moneda: string): string {
  return precio != null && precio > 0 ? `${SYM[moneda] ?? '$'} ${Number(precio).toLocaleString('es-AR')}` : 'Sin costo'
}

const ICON_LOCK = (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}>
    <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
)
const ICON_PLUS = (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const ICON_TIPO = (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
    <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h4M8 17h7" />
  </svg>
)
const ICON_PIN = (
  <svg viewBox="0 0 24 24"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
)
const ICON_CAM = (
  <svg viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="12" height="11" rx="2" /><path d="M14.5 11l7-3.5v9l-7-3.5z" /></svg>
)
const ICON_WARN = (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
)

type Draft = {
  nombre: string
  descripcion: string
  duracion_min: string
  precio: string
  moneda: string
  visible_en_booking: boolean
  activo: boolean
  sucursal_ids: string[]
}

function draftVacio(sedes: SedeTipoTurno[]): Draft {
  return {
    nombre: '', descripcion: '', duracion_min: '', precio: '', moneda: 'ARS', visible_en_booking: true, activo: true,
    sucursal_ids: sedes.length > 1 ? [] : sedes.length === 1 ? [sedes[0].id] : [],
  }
}

function draftDeTipo(t: TipoTurnoConSedes): Draft {
  return {
    nombre: t.nombre,
    descripcion: t.descripcion ?? '',
    duracion_min: String(t.duracion_min),
    precio: formatearMontoInputInicial(t.precio),
    moneda: t.moneda,
    visible_en_booking: t.visible_en_booking,
    activo: t.activo,
    sucursal_ids: [...t.sucursal_ids],
  }
}

// sedesTxt/sedeTag — extraídos de "Ajustes - Tipos de turno v2 - sedes.html"
function sedesTxt(ids: string[], sedes: SedeTipoTurno[]): string {
  const sel = sedes.filter((s) => ids.includes(s.id))
  if (!sel.length) return 'Sin sedes'
  if (sel.length === sedes.length) return 'Todas las sedes'
  const nombres = sel.map((s) => s.nombre)
  return nombres.length > 2 ? `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}` : nombres.join(', ')
}

function SedeTag({ ids, sedes }: { ids: string[]; sedes: SedeTipoTurno[] }) {
  const sel = sedes.filter((s) => ids.includes(s.id))
  if (sel.length === 1 && sel[0].es_online) {
    return <span className="tt-tag-onl">{ICON_CAM}Online</span>
  }
  return <span className="tt-tag-sd" title={sel.map((s) => s.nombre).join(' · ')}>{ICON_PIN}{sedesTxt(ids, sedes)}</span>
}

export default function TiposTurnoSection({ plan, habilitado, tiposIniciales, terminologia, sedes }: Props) {
  const t = getTerminologia(terminologia)
  const multiSede = sedes.length > 1
  const [lista, setLista] = useState<TipoTurnoConSedes[]>(tiposIniciales)
  const [upsellVisible, setUpsellVisible] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null) // null = cerrado, 'new' = alta
  const [draft, setDraft] = useState<Draft>(draftVacio(sedes))
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorNombre, setErrorNombre] = useState<string | null>(null)

  const activos = lista.filter((x) => x.activo).length

  function abrirNuevo() {
    setEditandoId('new')
    setDraft(draftVacio(sedes))
    setTouched(false)
    setErrorNombre(null)
  }

  function abrirEditar(tipo: TipoTurnoConSedes) {
    setEditandoId(tipo.id)
    setDraft(draftDeTipo(tipo))
    setTouched(false)
    setErrorNombre(null)
  }

  function cerrar() {
    setEditandoId(null)
    setErrorNombre(null)
  }

  function toggleSede(id: string) {
    setDraft((p) => ({
      ...p,
      sucursal_ids: p.sucursal_ids.includes(id) ? p.sucursal_ids.filter((x) => x !== id) : [...p.sucursal_ids, id],
    }))
  }

  function marcarTodas() {
    setDraft((p) => ({
      ...p,
      sucursal_ids: p.sucursal_ids.length === sedes.length ? [] : sedes.map((s) => s.id),
    }))
  }

  const nombreOk = draft.nombre.trim().length > 0
  const duracionOk = Number(draft.duracion_min) >= 5
  const sedesOk = !multiSede || draft.sucursal_ids.length > 0
  const descLen = draft.descripcion.length
  const descNear = descLen >= 450 && descLen < 500
  const descMax = descLen >= 500

  async function guardar() {
    setTouched(true)
    if (!nombreOk || !duracionOk || !sedesOk) return
    setLoading(true)
    setErrorNombre(null)

    const body = {
      nombre: draft.nombre,
      descripcion: draft.descripcion,
      duracion_min: Number(draft.duracion_min),
      precio: parsearMontoInput(draft.precio),
      moneda: draft.moneda,
      visible_en_booking: draft.visible_en_booking,
      activo: draft.activo,
      sucursal_ids: draft.sucursal_ids,
    }

    try {
      const res = editandoId === 'new'
        ? await fetch('/api/tipos-turno', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/tipos-turno/${editandoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

      const data = await res.json() as { tipo_turno?: TipoTurnoConSedes; error?: string }

      if (!res.ok || !data.tipo_turno) {
        if (res.status === 409) {
          setErrorNombre(data.error ?? 'Ya tenés un tipo con ese nombre (puede estar inactivo)')
        } else {
          setErrorNombre(data.error ?? 'No se pudo guardar el tipo de turno')
        }
        setLoading(false)
        return
      }

      setLista((prev) => {
        if (editandoId === 'new') return [...prev, data.tipo_turno!]
        return prev.map((x) => (x.id === data.tipo_turno!.id ? data.tipo_turno! : x))
      })
      setLoading(false)
      cerrar()
    } catch {
      setErrorNombre('No se pudo guardar el tipo de turno. Intentá de nuevo.')
      setLoading(false)
    }
  }

  function renderRow(tipo: TipoTurnoConSedes, soloLectura: boolean) {
    return (
      <div key={tipo.id} className={`tt-row ${!tipo.activo ? 'tt-off' : ''}`}>
        <div className="tt-nm">
          <b>{tipo.nombre}</b>
          <div className="tt-tags">
            {soloLectura ? (
              <span className="tt-tag locked">Bloqueado</span>
            ) : (
              <>
                <span className={`tt-tag ${tipo.activo ? 'on' : ''}`}>
                  {tipo.activo ? <><span className="tt-dot" />Activo</> : 'Inactivo'}
                </span>
                <span className={`tt-tag ${tipo.visible_en_booking ? 'pub' : ''}`}>
                  {tipo.visible_en_booking ? 'Visible en reserva' : 'Solo en agenda'}
                </span>
                {multiSede && <SedeTag ids={tipo.sucursal_ids} sedes={sedes} />}
              </>
            )}
          </div>
        </div>
        <div className="tt-vs">
          <div className="tt-v"><small>Duración</small>{tipo.duracion_min} min</div>
          <div className={`tt-v ${tipo.precio && tipo.precio > 0 ? '' : 'free'}`}><small>Precio</small>{money(tipo.precio, tipo.moneda)}</div>
        </div>
        <div className="tt-acts">
          {!soloLectura && (
            <button type="button" className="btn btn-sm" onClick={() => abrirEditar(tipo)}>Editar</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="tt-sec-hdr">
        <div className="tt-icn">{ICON_TIPO}</div>
        <div className="tt-info">
          <h2>Tipos de turno</h2>
          <p>Se usan al agendar desde tu agenda y, si los hacés visibles, en tu link público de reservas.</p>
        </div>
        <span className="tt-plan-pill">Plan <b>{PLAN_NAME[plan] ?? plan}</b></span>
      </div>

      <div className="tt-grp">
        <div className="tt-grp-h">Tipos base<span>Incluidos en KLIA · no se editan ni se borran</span></div>
        <div className="tt-list">
          <div className="tt-row tt-fixed">
            <div className="tt-nm">
              <b>{t.Sesion}</b>
              {multiSede && <div className="tt-tags"><span className="tt-tag-sd">{ICON_PIN}Todas las sedes</span></div>}
            </div>
            <div className="tt-v free" style={{ gridColumn: 'span 2' }}>Se define al agendar</div>
            <div className="tt-acts"><span className="tt-ro">{ICON_LOCK}Fijo</span></div>
          </div>
          <div className="tt-row tt-fixed">
            <div className="tt-nm">
              <b>Entrevista</b>
              {multiSede && <div className="tt-tags"><span className="tt-tag-sd">{ICON_PIN}Todas las sedes</span></div>}
            </div>
            <div className="tt-v free" style={{ gridColumn: 'span 2' }}>Se define al agendar</div>
            <div className="tt-acts"><span className="tt-ro">{ICON_LOCK}Fijo</span></div>
          </div>
        </div>
      </div>

      <div className="tt-grp">
        <div className="tt-grp-h">
          Tus tipos
          <span>{habilitado && lista.length > 0 ? `${lista.length} ${lista.length === 1 ? 'tipo' : 'tipos'} · ${activos} activos` : ''}</span>
        </div>

        {!habilitado ? (
          <>
            <div className="tt-add-lock">
              <div className="tt-txt">
                <b>No incluido en tu plan</b>
                Los tipos de turno propios están disponibles en Profesional y Premium.
              </div>
              <button type="button" className="btn is-locked" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }}>
                {ICON_LOCK}Agregar tipo
              </button>
            </div>
            {upsellVisible && (
              <div className="tt-upsell">
                <div className="tt-ic">
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
                    <path d="M12 3l2.6 5.6 6.1.8-4.4 4.3 1 6.1-5.3-2.9-5.3 2.9 1-6.1L3.3 9.4l6.1-.8z" />
                  </svg>
                </div>
                <div>
                  <h4>Creá tus propios tipos de turno con Profesional</h4>
                  <p>Cada uno con su nombre, duración y precio, y elegí cuáles ofrecer en tu reserva pública. {t.Sesion} y Entrevista siguen igual.</p>
                  <div className="tt-acts" style={{ marginTop: 11, display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <a href="/ajustes#plan" className="btn btn-violet btn-sm" style={{ textDecoration: 'none' }}>Ver planes</a>
                    <button type="button" className="btn btn-sm" onClick={() => setUpsellVisible(false)}>Ahora no</button>
                  </div>
                </div>
              </div>
            )}
            {lista.length > 0 && (
              <div className="tt-list" style={{ marginTop: 12 }}>
                {lista.map((tipo) => renderRow(tipo, true))}
              </div>
            )}
          </>
        ) : lista.length === 0 ? (
          <div className="tt-empty">
            <div className="tt-ic">
              <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
                <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M12 13v5M9.5 15.5h5" />
              </svg>
            </div>
            <h4>Todavía no creaste tipos propios</h4>
            <p>Sumá consultas con su propia duración y precio, por ejemplo &ldquo;Examen antropométrico completo&rdquo;.</p>
            <button type="button" className="btn btn-primary" onClick={abrirNuevo}>{ICON_PLUS}Agregar tipo</button>
          </div>
        ) : (
          <>
            <div className="tt-list">{lista.map((tipo) => renderRow(tipo, false))}</div>
            <div className="tt-add-row">
              <button type="button" className="btn" onClick={abrirNuevo}>{ICON_PLUS}Agregar tipo</button>
            </div>
          </>
        )}
      </div>

      <SlideOver
        open={editandoId !== null}
        onClose={cerrar}
        title={editandoId === 'new' ? 'Nuevo tipo de turno' : 'Editar tipo de turno'}
        width="compact"
        header={(
          // Header propio — el default de SlideOver aplica `capitalize truncate`
          // al subtítulo (Title Case + corte), que no corresponde para una
          // oración como "Disponible en tu agenda al guardar". Solo para este
          // SlideOver, no se toca el componente para el resto de la app.
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ minWidth: 0, paddingRight: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                {editandoId === 'new' ? 'Nuevo tipo de turno' : 'Editar tipo de turno'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                {editandoId === 'new' ? 'Disponible en tu agenda al guardar' : 'Los turnos ya agendados conservan su duración y monto'}
              </p>
            </div>
            <button type="button" onClick={cerrar} className="so-close-custom" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'var(--ink-2)', strokeWidth: 1.9, fill: 'none' }}><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        footer={(
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardar} disabled={loading}>
              {loading ? 'Guardando…' : editandoId === 'new' ? 'Guardar tipo' : 'Guardar cambios'}
            </button>
          </div>
        )}
      >
        <div className="tt-field">
          <label htmlFor="ttFName">Nombre<em>*</em></label>
          <input
            id="ttFName" type="text" maxLength={60}
            className={touched && !nombreOk ? 'tt-bad' : ''}
            placeholder="Ej. Examen antropométrico completo"
            value={draft.nombre}
            onChange={(e) => { setDraft((p) => ({ ...p, nombre: e.target.value })); setErrorNombre(null) }}
          />
          {errorNombre && <span className="tt-err">{errorNombre}</span>}
          {touched && !nombreOk && !errorNombre && <span className="tt-err">Ponele un nombre al tipo de turno.</span>}
          <span className="tt-hint">Así lo ves en la agenda y lo ve el paciente al reservar.</span>
        </div>

        <div className="tt-field">
          <div className="tt-lbl-row">
            <label htmlFor="ttFDesc">Descripción<span className="tt-opt">Opcional</span></label>
            <span className={`tt-cnt ${descNear ? 'near' : ''} ${descMax ? 'max' : ''}`} aria-live="polite">{descLen}/500</span>
          </div>
          <textarea
            id="ttFDesc" rows={3} maxLength={500}
            className={descMax ? 'tt-max' : ''}
            placeholder="Contale al paciente de qué trata este turno"
            value={draft.descripcion}
            onChange={(e) => setDraft((p) => ({ ...p, descripcion: e.target.value.slice(0, 500) }))}
          />
          {descMax && <span className="tt-err">Llegaste al máximo de 500 caracteres.</span>}
          <span className="tt-hint">Se muestra a tus pacientes al reservar.</span>
        </div>

        <div className="tt-field">
          <label htmlFor="ttFDur">Duración<em>*</em></label>
          <div className={`tt-ig ${touched && !duracionOk ? 'tt-bad' : ''}`} style={{ maxWidth: 180 }}>
            <input
              id="ttFDur" type="number" min={5} step={5} inputMode="numeric" placeholder="60"
              value={draft.duracion_min}
              onChange={(e) => setDraft((p) => ({ ...p, duracion_min: e.target.value }))}
            />
            <span className="tt-sfx">min</span>
          </div>
          {touched && !duracionOk && <span className="tt-err">Indicá una duración de al menos 5 minutos.</span>}
        </div>

        <div className="tt-row2">
          <div className="tt-field">
            <label htmlFor="ttFPrice">Precio</label>
            <div className="tt-ig">
              <span className="tt-pfx">{SYM[draft.moneda] ?? '$'}</span>
              <MontoInput
                name="ttFPrice"
                value={draft.precio}
                onChange={(raw) => setDraft((p) => ({ ...p, precio: raw }))}
                placeholder={draft.moneda === 'ARS' ? 'Ej: 15000' : 'Ej: 150,00'}
                sinSimbolo
              />
            </div>
          </div>
          <div className="tt-field">
            <label htmlFor="ttFCur">Moneda</label>
            <select id="ttFCur" value={draft.moneda} onChange={(e) => setDraft((p) => ({ ...p, moneda: e.target.value }))}>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="tt-field" style={{ marginTop: -12 }}>
          <span className="tt-hint">Dejalo vacío o en 0 si no tiene costo. Es el mismo en todas las sedes.</span>
        </div>

        {multiSede && (
          <div className="tt-field">
            <div className="tt-lbl-row">
              <label>Sedes donde se ofrece<em>*</em></label>
              <button type="button" className="tt-lnk" onClick={marcarTodas}>
                {draft.sucursal_ids.length === sedes.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            </div>
            <div className={`tt-sl-list ${touched && !sedesOk ? 'tt-bad' : ''}`} role="group" aria-label="Sedes donde se ofrece">
              {sedes.map((s) => {
                const on = draft.sucursal_ids.includes(s.id)
                return (
                  <label key={s.id} className={`tt-sl-row ${on ? 'on' : ''}`}>
                    <input type="checkbox" className="tt-cb" checked={on} onChange={() => toggleSede(s.id)} />
                    <span className="tt-dt" style={{ background: s.color }} />
                    <span className="tt-b"><b>{s.nombre}</b><small>{s.direccion}</small></span>
                    {s.es_online && <span className="tt-tag-onl">{ICON_CAM}Online</span>}
                  </label>
                )
              })}
            </div>
            {touched && !sedesOk && (
              <span className="tt-err with-ic">{ICON_WARN}Elegí al menos una sede para poder guardar.</span>
            )}
            <span className="tt-hint">Para ofrecerlo por videollamada, marcá la sede Online. Duración y precio son los mismos en todas.</span>
          </div>
        )}

        <div className="tt-toggle">
          <div className="tt-t-info">
            <div className="tt-t-name">Visible en reserva pública</div>
            <div className="tt-t-desc">Tus pacientes pueden elegirlo al reservar desde tu link.</div>
          </div>
          <button
            type="button" className="tt-switch" data-on={draft.visible_en_booking} role="switch" aria-checked={draft.visible_en_booking}
            onClick={() => setDraft((p) => ({ ...p, visible_en_booking: !p.visible_en_booking }))}
          />
        </div>
        <div className="tt-toggle">
          <div className="tt-t-info">
            <div className="tt-t-name">Activo</div>
            <div className="tt-t-desc">Si lo desactivás, deja de aparecer al crear turnos. Los turnos ya agendados no cambian.</div>
          </div>
          <button
            type="button" className="tt-switch" data-on={draft.activo} role="switch" aria-checked={draft.activo}
            onClick={() => setDraft((p) => ({ ...p, activo: !p.activo }))}
          />
        </div>

        <div className={`tt-preview ${draft.descripcion.trim() ? 'tt-has-pd' : ''}`} style={{ opacity: draft.visible_en_booking ? 1 : 0.6 }}>
          <div style={{ minWidth: 0 }}>
            <div className="tt-pl">{draft.visible_en_booking ? 'Así lo ve el paciente' : 'No se muestra en tu reserva pública'}</div>
            <div className="tt-pn">{draft.nombre.trim() || 'Nombre del tipo'}</div>
            {draft.descripcion.trim() && <div className="tt-pd">{draft.descripcion.trim()}</div>}
            <div className="tt-pm">
              {draft.duracion_min ? `${draft.duracion_min} min` : '— min'}
              {multiSede ? ` · ${draft.sucursal_ids.length === 1 && sedes.find((s) => s.id === draft.sucursal_ids[0])?.es_online ? 'Por videollamada' : sedesTxt(draft.sucursal_ids, sedes)}` : ''}
            </div>
          </div>
          <div className="tt-pp">{(() => {
            const precioNum = parsearMontoInput(draft.precio)
            return precioNum && precioNum > 0 ? `${SYM[draft.moneda] ?? '$'} ${precioNum.toLocaleString('es-AR')}` : 'Sin costo'
          })()}</div>
        </div>
      </SlideOver>
    </>
  )
}
