'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Paciente } from '@/types/database'
import SlideOver from '@/components/ui/SlideOver'
import { sumarDias } from '@/lib/portal/semana'
import { hoyFechaAR } from '@/lib/tz'
import './registro.css'

const IconSend = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
const IconUser = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
const IconAlert = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>
const IconPortal = <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: 'var(--accent-ink)', strokeWidth: 1.7, fill: 'none' }}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>
const IconPause = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>
const IconInfo = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--muted)', strokeWidth: 1.8, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
const IconLeft = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M15 6l-6 6 6 6" /></svg>
const IconRight = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M9 6l6 6-6 6" /></svg>
const IconCam = <svg viewBox="0 0 24 24" style={{ width: 21, height: 21, stroke: 'var(--accent-ink)', strokeWidth: 1.7, fill: 'none' }}><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
const IconGone = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 3l18 18" /></svg>
const IconComment = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'var(--ink-2)', strokeWidth: 1.9, fill: 'none' }}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
const IconCheck = <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// ?t={fotoVersion} rompe el cache del navegador cuando se reemplaza la foto
// (el pathname del blob cambia en cada subida, pero la URL que ve el
// cliente es siempre la misma — sin esto, el navegador podría seguir
// mostrando la miniatura vieja desde su cache).
function fotoUrl(registroId: string, version: number, v: 'thumb' | 'full'): string {
  return `/api/portal/fotos/${registroId}?v=${v}&t=${version}`
}

function partes(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { y, m, d, dow }
}
function formatCorto(fecha: string) { const { m, d } = partes(fecha); return `${d} ${MES_CORTO[m - 1]}` }
function formatLargo(fecha: string) { const { m, d, dow } = partes(fecha); return `${DIA_LARGO[dow]} ${d} de ${MES_LARGO[m - 1]}` }
// Para timestamptz (invitado_at/activado_at/registrado_at), siempre con
// timeZone explícito — nunca parsear el ISO como fecha calendario pura, un
// horario post-21hs ART puede caer al día siguiente en UTC.
function fechaCortaConAnio(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
}
function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
}
function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
}

type CeldaPlan =
  | { cambiado: true }
  | { cambiado: false; hora: string | null; nota: string | null; items: { tipo: string; nombre: string; cantidadGramos: number | null }[] }

type Celda =
  | { estado: 'no_aplica' }
  | { estado: 'fut' }
  | { estado: 'miss'; plan: CeldaPlan }
  | { estado: 'registro'; registro: { id: string; registradoAt: string; comentario: string | null; fotoVencida: boolean; fotoVersion: number }; plan: CeldaPlan }

interface Fila { tipoComida: string; hora: string | null; celdas: Celda[] }

interface SemanaData {
  semanaInicio: string
  semanaFin: string
  dias: string[]
  esSemanaActual: boolean
  puedeRetroceder: boolean
  filas: Fila[]
  contador: { hechas: number; total: number }
  diasRetencion: number | null
}

interface EstadoAcceso {
  estado: 'sin_invitar' | 'invitado' | 'activo'
  email: string | null
  invitadoAt: string | null
  activadoAt: string | null
  registroHabilitado: boolean
  diasRetencion: number | null
}

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

export default function RegistroTab({ paciente }: { paciente: Paciente }) {
  const router = useRouter()
  const primerNombre = paciente.nombre

  const [acceso, setAcceso] = useState<EstadoAcceso | null>(null)
  const [accesoError, setAccesoError] = useState<string | null>(null)
  const [accesoLoading, setAccesoLoading] = useState(true)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [accionLoading, setAccionLoading] = useState(false)

  const [semana, setSemana] = useState<string | undefined>(undefined)
  const [data, setData] = useState<SemanaData | null>(null)
  const [semanaLoading, setSemanaLoading] = useState(true)

  const [slideKey, setSlideKey] = useState<string | null>(null)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  function toast(msg: string) {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }

  const cargarAcceso = useCallback(async () => {
    setAccesoLoading(true)
    const res = await fetch(`/api/pacientes/${paciente.id}/portal`)
    const body = await jsonOrNull(res)
    if (!res.ok) { setAccesoError(body?.message ?? 'No pudimos cargar el estado del portal.'); setAcceso(null) }
    else { setAccesoError(null); setAcceso(body) }
    setAccesoLoading(false)
  }, [paciente.id])

  const cargarSemana = useCallback(async (semanaParam?: string) => {
    setSemanaLoading(true)
    const qs = semanaParam ? `?semana=${semanaParam}` : ''
    const res = await fetch(`/api/pacientes/${paciente.id}/portal/registros${qs}`)
    const body = await jsonOrNull(res)
    if (res.ok) setData(body)
    setSemanaLoading(false)
  }, [paciente.id])

  useEffect(() => { cargarAcceso() }, [cargarAcceso])
  useEffect(() => { cargarSemana(semana) }, [semana, cargarSemana])

  async function accion(path: string, metodo: string, body?: unknown) {
    setAccionLoading(true)
    const res = await fetch(`/api/pacientes/${paciente.id}/portal/${path}`, {
      method: metodo,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    const resultado = await jsonOrNull(res)
    setAccionLoading(false)
    return { ok: res.ok, data: resultado }
  }

  async function invitar() {
    const email = acceso?.email
    const { ok, data: resultado } = await accion('invitar', 'POST')
    if (!ok) { toast(resultado?.message ?? 'No pudimos enviar la invitación.'); return }
    toast(`Invitación enviada a ${email ?? ''}`)
    cargarAcceso()
  }

  async function reenviar() {
    const { ok, data: resultado } = await accion('reenviar', 'POST')
    if (!ok) { toast(resultado?.message ?? 'No pudimos reenviar la invitación.'); return }
    toast(`Invitación reenviada a ${acceso?.email ?? ''}`)
    cargarAcceso()
  }

  async function confirmarRevocar() {
    const { ok, data: resultado } = await accion('revocar', 'POST')
    setConfirmRevoke(false)
    if (!ok) { toast(resultado?.message ?? 'No pudimos revocar el acceso.'); return }
    toast('Acceso al portal revocado')
    cargarAcceso()
  }

  async function toggleRegistro() {
    if (!acceso) return
    const nuevo = !acceso.registroHabilitado
    const { ok, data: resultado } = await accion('registro-habilitado', 'PATCH', { habilitado: nuevo })
    if (!ok) { toast(resultado?.message ?? 'No pudimos actualizar el registro.'); return }
    setAcceso((prev) => (prev ? { ...prev, registroHabilitado: nuevo } : prev))
    toast(nuevo ? 'Registro de comidas habilitado' : 'Registro de comidas pausado')
  }

  function irSemana(delta: number) {
    if (!data) return
    setSemana(sumarDias(data.semanaInicio, delta * 7))
  }

  function celdaPorKey(key: string): { fecha: string; fila: Fila; celda: Celda & { estado: 'registro' | 'miss' } } | null {
    if (!data) return null
    const [fecha, tipoComida] = key.split('|')
    const idx = data.dias.indexOf(fecha)
    if (idx === -1) return null
    const fila = data.filas.find((f) => f.tipoComida === tipoComida)
    if (!fila) return null
    const celda = fila.celdas[idx]
    if (celda.estado !== 'registro' && celda.estado !== 'miss') return null
    return { fecha, fila, celda }
  }

  const detalle = slideKey ? celdaPorKey(slideKey) : null
  const hoy = hoyFechaAR()

  function renderAccesoCard() {
    if (accesoLoading) return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>Cargando...</div>
    if (accesoError) return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--danger)' }}>{accesoError}</div>
    if (!acceso) return null

    const sinEmail = !acceso.email
    let tag: React.ReactNode
    let texto: string
    let botones: React.ReactNode

    if (acceso.estado === 'activo') {
      tag = <span className="rg-tag ok"><i />Activo</span>
      texto = `${acceso.email} · Cuenta activa desde el ${acceso.activadoAt ? fechaCortaConAnio(acceso.activadoAt) : '—'}.`
      botones = <button className="btn rg-btn-dng-ghost" disabled={accionLoading} onClick={() => setConfirmRevoke(true)}>Revocar acceso</button>
    } else if (acceso.estado === 'invitado') {
      tag = <span className="rg-tag warn"><i />Invitación enviada</span>
      texto = `Enviada el ${acceso.invitadoAt ? `${fechaCorta(acceso.invitadoAt)} a las ${horaCorta(acceso.invitadoAt)}` : '—'} a ${acceso.email}. Todavía no activó su cuenta.`
      botones = <>
        <button className="btn" disabled={accionLoading} onClick={reenviar}>{IconSend}Reenviar invitación</button>
        <button className="btn rg-btn-dng-ghost" disabled={accionLoading} onClick={() => setConfirmRevoke(true)}>Revocar acceso</button>
      </>
    } else {
      tag = <span className="rg-tag"><i />Sin invitar</span>
      texto = sinEmail
        ? `${primerNombre} no tiene email cargado en su ficha.`
        : `Invitá a ${primerNombre} para que vea su plan alimentario y registre sus comidas con una foto. Le llega un mail a ${acceso.email}.`
      botones = <button className="btn primary" disabled={accionLoading || sinEmail} onClick={invitar}>{IconSend}Invitar al portal</button>
    }

    return (
      <section className="card rg-acc" aria-labelledby="rg-acc-t">
        <div className="rg-acc-top">
          <div className="rg-acc-ic">{IconPortal}</div>
          <div className="rg-acc-tx">
            <div className="rg-acc-t" id="rg-acc-t">Portal del paciente {tag}</div>
            <p>{texto}</p>
          </div>
          <div className="rg-acc-btns">{botones}</div>
        </div>

        {acceso.estado === 'sin_invitar' && sinEmail && (
          <div className="rg-inote warn" role="status">
            {IconAlert}
            <span className="rg-tx"><b>Cargá el email de {primerNombre} para poder invitarla.</b></span>
            <button className="btn" onClick={() => router.push(`/pacientes/${paciente.id}?tab=datos`)}>{IconUser}Ir a Datos personales</button>
          </div>
        )}

        {confirmRevoke && (
          <div className="rg-inote dng" role="alert">
            {IconAlert}
            <span className="rg-tx"><b>¿Revocar el acceso de {primerNombre}?</b> No va a poder ingresar al portal. Los registros que ya subió se conservan hasta cumplir los {acceso.diasRetencion ?? '—'} días.</span>
            <button className="btn" onClick={() => setConfirmRevoke(false)}>Cancelar</button>
            <button className="btn danger" disabled={accionLoading} onClick={confirmarRevocar}>Revocar acceso</button>
          </div>
        )}

        {acceso.estado !== 'sin_invitar' && (
          <div className="rg-toggle-row">
            <div className="rg-t-info">
              <div className="rg-t-name" id="rg-sw-l">Registro de comidas habilitado</div>
              <div className="rg-t-desc">
                {acceso.registroHabilitado
                  ? `${primerNombre} puede subir una foto por cada comida del plan, con un comentario opcional.`
                  : `Pausado: ${primerNombre} sigue viendo su plan y sus registros, pero no puede subir fotos nuevas.`}
              </div>
            </div>
            <button className="rg-switch" role="switch" aria-checked={acceso.registroHabilitado} aria-labelledby="rg-sw-l" disabled={accionLoading} onClick={toggleRegistro} />
          </div>
        )}
      </section>
    )
  }

  function renderCelda(celda: Celda, fecha: string, fila: Fila) {
    const key = `${fecha}|${fila.tipoComida}`
    const sel = slideKey === key
    const lab = `${formatLargo(fecha)}, ${fila.tipoComida}`

    if (celda.estado === 'no_aplica') return <div className="rg-cell rg-noaplica" aria-label={`${lab}: sin esta comida`}>—</div>
    if (celda.estado === 'fut') return <div className="rg-cell rg-fut" aria-label={`${lab}: todavía no`}>—</div>

    if (celda.estado === 'registro') {
      if (celda.registro.fotoVencida) {
        return (
          <button type="button" className={`rg-cell rg-ph rg-gone${sel ? ' sel' : ''}`} onClick={() => setSlideKey(key)} aria-label={`${lab}: foto vencida${celda.registro.comentario ? ', con comentario' : ''}`}>
            {IconGone}Foto vencida{celda.registro.comentario && <span className="rg-cmi">{IconComment}</span>}
          </button>
        )
      }
      return (
        <button type="button" className={`rg-cell rg-ph${sel ? ' sel' : ''}`} onClick={() => setSlideKey(key)} aria-label={`${lab}: subida ${horaCorta(celda.registro.registradoAt)}${celda.registro.comentario ? ', con comentario' : ''}`}>
          <img src={fotoUrl(celda.registro.id, celda.registro.fotoVersion, 'thumb')} alt="" />
          <span className="rg-tm">{horaCorta(celda.registro.registradoAt)}</span>
          {celda.registro.comentario && <span className="rg-cmi">{IconComment}</span>}
        </button>
      )
    }

    return <button type="button" className={`rg-cell rg-miss${sel ? ' sel' : ''}`} onClick={() => setSlideKey(key)} aria-label={`${lab}: sin registro`}>Sin registro</button>
  }

  function renderLrow(celda: Celda, fecha: string, fila: Fila) {
    const key = `${fecha}|${fila.tipoComida}`
    if (celda.estado === 'fut') {
      return (
        <div className="rg-lrow rg-static" key={key}>
          <div className="rg-th rg-miss" />
          <div className="rg-tx"><b>{fila.tipoComida}</b>{fila.hora && <span>Plan {fila.hora.slice(0, 5)}</span>}</div>
          <span className="rg-st">—</span>
        </div>
      )
    }
    if (celda.estado === 'registro') {
      const gone = celda.registro.fotoVencida
      return (
        <button type="button" className="rg-lrow" key={key} onClick={() => setSlideKey(key)}>
          <div className={`rg-th rg-ph${gone ? ' rg-gone' : ''}`}>
            {gone ? IconGone : <img src={fotoUrl(celda.registro.id, celda.registro.fotoVersion, 'thumb')} alt="" />}
          </div>
          <div className="rg-tx"><b>{fila.tipoComida}</b>{fila.hora && <span>Plan {fila.hora.slice(0, 5)}</span>}</div>
          <span className={`rg-st${gone ? '' : ' ok'}`}>{celda.registro.comentario && IconComment}{gone ? 'Foto vencida' : `Subida ${horaCorta(celda.registro.registradoAt)}`}</span>
        </button>
      )
    }
    return (
      <button type="button" className="rg-lrow" key={key} onClick={() => setSlideKey(key)}>
        <div className="rg-th rg-miss" />
        <div className="rg-tx"><b>{fila.tipoComida}</b>{fila.hora && <span>Plan {fila.hora.slice(0, 5)}</span>}</div>
        <span className="rg-st">Sin registro</span>
      </button>
    )
  }

  function renderSemanaCard() {
    if (!acceso) return null

    if (semanaLoading) {
      const filasSkeleton = data?.filas.length || 3
      return (
        <section className="card" aria-label="Registro semanal">
          <div className="rg-wk-bar">
            <div className="rg-wk-nav">
              <button className="icon-btn" disabled aria-label="Semana anterior">{IconLeft}</button>
              <span className="rg-wk-lbl">{data ? `Semana del ${formatCorto(data.semanaInicio)} al ${formatCorto(data.semanaFin)}` : ''}</span>
              <button className="icon-btn" disabled aria-label="Semana siguiente">{IconRight}</button>
            </div>
            <div className="rg-wk-cnt"><span className="rg-sk" style={{ display: 'inline-block', width: 190, height: 12, borderRadius: 6 }} /></div>
          </div>
          <div className="rg-grid-wrap">
            <table className="rg-table-g"><tbody>
              {Array.from({ length: filasSkeleton }).map((_, i) => (
                <tr key={i}>
                  <td className="rg-mn"><span className="rg-sk" style={{ display: 'inline-block', width: 70, height: 12, borderRadius: 6 }} /></td>
                  {Array.from({ length: 7 }).map((_, j) => <td key={j}><div className="rg-cell rg-sk" /></td>)}
                </tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )
    }

    if (!data) return null

    if (acceso.estado !== 'activo' && data.esSemanaActual) {
      return (
        <section className="card">
          <div className="rg-empty">
            <div className="rg-ic">{IconCam}</div>
            <h3>Todavía no hay registros</h3>
            <p>{acceso.estado === 'invitado' ? `Cuando ${primerNombre} active su cuenta` : `Cuando invites a ${primerNombre} y active su cuenta`}, vas a ver acá la foto de cada comida del plan, semana por semana.</p>
          </div>
          <div className="rg-wk-foot">{IconInfo}<span>Las fotos se conservan {data.diasRetencion ?? '—'} días (según tu plan).</span></div>
        </section>
      )
    }

    if (data.filas.length === 0) {
      return (
        <section className="card">
          <div className="rg-empty">
            <div className="rg-ic">{IconCam}</div>
            <h3>Sin comidas en el plan</h3>
            <p>Todavía no hay comidas cargadas en el plan alimentario de {primerNombre} — armalo desde la solapa Plan Alimentario.</p>
          </div>
          <div className="rg-wk-foot">{IconInfo}<span>Las fotos se conservan {data.diasRetencion ?? '—'} días (según tu plan).</span></div>
        </section>
      )
    }

    return (
      <section className="card" aria-label="Registro semanal">
        <div className="rg-wk-bar">
          <div className="rg-wk-nav">
            <button className="icon-btn" aria-label="Semana anterior" disabled={!data.puedeRetroceder} onClick={() => irSemana(-1)}>{IconLeft}</button>
            <span className="rg-wk-lbl" aria-live="polite">Semana del {formatCorto(data.semanaInicio)} al {formatCorto(data.semanaFin)}</span>
            <button className="icon-btn" aria-label="Semana siguiente" disabled={data.esSemanaActual} onClick={() => irSemana(1)}>{IconRight}</button>
          </div>
          <div className="rg-wk-cnt"><b>{data.contador.hechas} de {data.contador.total}</b> comidas registradas{data.esSemanaActual ? ' · hasta hoy' : ''}</div>
        </div>

        {acceso.estado === 'activo' && !acceso.registroHabilitado && (
          <div style={{ padding: '12px 16px 0' }}>
            <div className="rg-inote neu" style={{ margin: 0 }}>{IconPause}<span className="rg-tx">El registro está pausado. {primerNombre} no puede subir fotos nuevas hasta que lo vuelvas a habilitar.</span></div>
          </div>
        )}

        <div className="rg-grid-wrap">
          <table className="rg-table-g">
            <thead>
              <tr>
                <th scope="col" />
                {data.dias.map((fecha) => (
                  <th key={fecha} scope="col" className={fecha === hoy ? 'today' : ''}>{DIA_CORTO[partes(fecha).dow]}<b>{partes(fecha).d}</b></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filas.map((fila) => (
                <tr key={fila.tipoComida}>
                  <td className="rg-mn">{fila.tipoComida}{fila.hora && <span>{fila.hora.slice(0, 5)}</span>}</td>
                  {fila.celdas.map((celda, i) => (
                    <td key={data.dias[i]}>{renderCelda(celda, data.dias[i], fila)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rg-dlist">
          {data.dias.map((fecha, i) => {
            const filasDelDia = data.filas.map((f) => ({ fila: f, celda: f.celdas[i] })).filter(({ celda }) => celda.estado !== 'no_aplica')
            const n = filasDelDia.filter(({ celda }) => celda.estado === 'registro').length
            return (
              <div className="rg-dgrp" key={fecha}>
                <div className={`rg-dgrp-hd${fecha === hoy ? ' today' : ''}`}>{formatLargo(fecha)}{filasDelDia.length > 0 && <span>{n} de {filasDelDia.length}</span>}</div>
                <div className="rg-lrows">
                  {filasDelDia.map(({ fila, celda }) => renderLrow(celda, fecha, fila))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rg-wk-foot">
          {IconInfo}<span>Las fotos se conservan {data.diasRetencion ?? '—'} días (según tu plan).</span>
          <span className="rg-wk-lg">
            <span><span style={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: 5, background: '#fff', border: '1px solid var(--border)' }}>{IconComment}</span>Con comentario</span>
            <span><span className="rg-lg-sw" style={{ border: '1px dashed var(--border-strong)', background: '#fff' }} />Sin registro</span>
            <span><span className="rg-lg-sw rg-ph rg-gone" style={{ border: '1px solid var(--border)' }} />Foto vencida</span>
          </span>
        </div>
      </section>
    )
  }

  return (
    <div className="mt-6" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>Registro de comidas</h2>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--muted)' }}>Lo que {primerNombre} registra desde el portal del paciente: una foto por comida del plan, con comentario opcional.</p>
      </div>

      {renderAccesoCard()}
      {renderSemanaCard()}

      {toastMsg && (
        <div style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: '#0B1220', color: '#fff', fontSize: 12.5, padding: '9px 15px', borderRadius: 100, boxShadow: '0 14px 34px rgba(11,18,32,.3)', zIndex: 70, maxWidth: '86vw', textAlign: 'center' }}>
          {toastMsg}
        </div>
      )}

      <SlideOver
        open={!!detalle}
        onClose={() => setSlideKey(null)}
        title={detalle ? `${detalle.fila.tipoComida} · ${formatLargo(detalle.fecha)}` : ''}
        subtitle={detalle
          ? (detalle.celda.estado === 'registro'
            ? `Subida ${horaCorta(detalle.celda.registro.registradoAt)} · plan ${detalle.fila.hora ? detalle.fila.hora.slice(0, 5) : '—'}`
            : `Plan ${detalle.fila.hora ? detalle.fila.hora.slice(0, 5) : '—'} · sin registro`)
          : undefined}
        subtitleCapitalize={false}
        width="xl"
        footer={
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 8, background: 'var(--surface-2)' }}>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSlideKey(null)}>Cerrar</button>
          </div>
        }
      >
        {detalle && <DetalleSlideBody detalle={detalle} primerNombre={primerNombre} />}
      </SlideOver>
    </div>
  )
}

function DetalleSlideBody({ detalle, primerNombre }: {
  detalle: { fecha: string; fila: Fila; celda: Celda & { estado: 'registro' | 'miss' } }
  primerNombre: string
}) {
  const { fecha, fila, celda } = detalle
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width:720px)')
    function sync() { if (detailsRef.current) detailsRef.current.open = !mq.matches }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const esRegistro = celda.estado === 'registro'
  const gone = esRegistro && celda.registro.fotoVencida
  const plan = celda.plan

  return (
    <div className="rg-pvr">
      <section className="rg-col-real">
        <h3 className="rg-real-t">Lo que registró {primerNombre}</h3>
        {!esRegistro ? (
          <div className="rg-shot rg-miss">{IconCam}<span>{primerNombre} no registró esta comida.</span></div>
        ) : gone ? (
          <div className="rg-shot rg-gone">{IconGone}<span>La foto se eliminó.<br />Se conserva el comentario.</span></div>
        ) : (
          <div className="rg-shot rg-ph">
            <img src={fotoUrl(celda.registro.id, celda.registro.fotoVersion, 'full')} alt={`Foto de ${fila.tipoComida.toLowerCase()} subida por ${primerNombre}`} />
          </div>
        )}
        {esRegistro && (
          <>
            <div className="rg-meta-row">
              <span className="rg-chip ok">{IconCheck}Subida {horaCorta(celda.registro.registradoAt)}</span>
              <span className="rg-chip">{formatLargo(fecha)}</span>
              {gone && <span className="rg-chip warn">Foto vencida</span>}
            </div>
            <div className="rg-cmt-l">Comentario</div>
            <div className={`rg-cmt${celda.registro.comentario ? '' : ' rg-none'}`}>{celda.registro.comentario || 'Sin comentario.'}</div>
          </>
        )}
      </section>
      <details className="rg-plan" ref={detailsRef}>
        <summary>
          <span className="rg-pl-t">Plan para esta comida</span>
          <span className="rg-pl-m">{fila.tipoComida}{fila.hora ? ` · ${fila.hora.slice(0, 5)}` : ''}</span>
          <svg className="rg-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="rg-planbox">
          {plan.cambiado ? (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)' }}>El plan cambió desde entonces.</p>
          ) : (
            <>
              <ul className="rg-items">
                {plan.items.length === 0 && <li style={{ paddingLeft: 0 }}>Sin ítems cargados.</li>}
                {plan.items.map((item, i) => (
                  <li key={i}><b>{item.nombre}</b>{item.cantidadGramos != null ? ` — ${item.cantidadGramos} g` : ''}</li>
                ))}
              </ul>
              {plan.nota && <p className="rg-ptip">{plan.nota}</p>}
            </>
          )}
        </div>
      </details>
    </div>
  )
}
