'use client'

import { useCallback, useEffect, useState } from 'react'
import { hoyFechaAR } from '@/lib/tz'
import { sumarDias, diffDias, formatCorto, formatLargo, diaCortoYNumero } from '@/lib/portal/semana'
import { useOffline } from '@/lib/portal/useOffline'
import { useToast } from './ToastContext'
import RegistroSheet, { type FilaHoy } from './RegistroSheet'

const SEMANAS_ATRAS_MAX = 12

const IconLeft = <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'var(--ink-2)', strokeWidth: 2, fill: 'none' }}><path d="M15 6l-6 6 6 6" /></svg>
const IconRight = <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'var(--ink-2)', strokeWidth: 2, fill: 'none' }}><path d="M9 6l6 6-6 6" /></svg>
const IconCam = <svg viewBox="0 0 24 24" style={{ width: 21, height: 21, stroke: 'var(--ink-2)', strokeWidth: 1.7, fill: 'none' }}><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
const IconCamOff = <svg viewBox="0 0 24 24" style={{ width: 21, height: 21, stroke: 'var(--muted-2)', strokeWidth: 1.7, fill: 'none' }}><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
const IconDoc = <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: 'var(--accent-ink)', strokeWidth: 1.7, fill: 'none' }}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h5" /></svg>
const IconLockNote = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
const IconClock = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
const IconPause = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>
const IconComment = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
const IconGone = <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 3l18 18" /></svg>

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
}

type HoyData = { fecha: string; noPlan: boolean; registroHabilitado: boolean; diasRetencion: number | null; filas: FilaHoy[] }

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

function skRows(n: number) {
  return (
    <div className="pp-meals">
      {Array.from({ length: n }, (_, i) => (
        <div className="pp-mrow pp-static" key={i}>
          <div className="pp-thumb pp-sk" style={{ border: 0 }} />
          <div className="pp-mtx">
            <div className="pp-sk" style={{ height: 14, width: '42%' }} />
            <div className="pp-sk" style={{ height: 11, width: '28%', marginTop: 7 }} />
          </div>
          <div className="pp-sk" style={{ height: 12, width: 62 }} />
        </div>
      ))}
    </div>
  )
}

export default function HoyClient({ pacienteNombre, profesionalNombre }: { pacienteNombre: string; profesionalNombre: string }) {
  const hoy = hoyFechaAR()
  const toast = useToast()
  const offline = useOffline()
  const [win, setWin] = useState(0)
  const [fecha, setFecha] = useState(hoy)
  const [data, setData] = useState<HoyData | null>(null)
  const [loading, setLoading] = useState(true)

  const [filaAbierta, setFilaAbierta] = useState<FilaHoy | null>(null)
  const [pantalla, setPantalla] = useState<'cerrado' | 'reg' | 'conf' | 'det'>('cerrado')
  const [reemplazo, setReemplazo] = useState(false)

  const cargar = useCallback(async (f: string) => {
    setLoading(true)
    const res = await fetch(`/api/portal/hoy?fecha=${f}`)
    const body = await jsonOrNull(res)
    if (res.ok) setData(body)
    setLoading(false)
  }, [])

  useEffect(() => { cargar(fecha) }, [fecha, cargar])

  function irVentana(delta: number) {
    const nuevoWin = Math.max(0, Math.min(SEMANAS_ATRAS_MAX, win + delta))
    setWin(nuevoWin)
    setFecha(sumarDias(hoy, -7 * nuevoWin))
  }

  function abrirRegistro(f: FilaHoy) {
    if (offline) { toast('Sin conexión. Probá de nuevo cuando vuelva la señal.'); return }
    setFilaAbierta(f)
    setReemplazo(false)
    setPantalla('reg')
  }
  function abrirDetalle(f: FilaHoy) {
    setFilaAbierta(f)
    setReemplazo(false)
    setPantalla('det')
  }
  function reemplazarFoto() {
    setReemplazo(true)
    setPantalla('reg')
  }

  const end = sumarDias(hoy, -7 * win)
  const start = sumarDias(end, -6)
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(start, i))
  const off = diffDias(hoy, fecha)
  const dayLabel = off === 0 ? `Hoy · ${formatLargo(fecha).toLowerCase()}` : off === 1 ? `Ayer · ${formatLargo(fecha).toLowerCase()}` : formatLargo(fecha)

  const hechas = data?.filas.filter((f) => f.estado === 'registrada').length ?? 0
  const total = data?.filas.length ?? 0
  const eds = data?.filas.filter((f) => f.estado === 'pendiente').length ?? 0

  return (
    <>
      <div className="pp-greet"><h1>Hola, {pacienteNombre}</h1><p>{dayLabel}</p></div>

      <div className="pp-strip-hd">
        <span>{formatCorto(start)} – {formatCorto(end)}</span>
        <button className="pp-arr" aria-label="Semana anterior" disabled={win >= SEMANAS_ATRAS_MAX} onClick={() => irVentana(1)}>{IconLeft}</button>
        <button className="pp-arr" aria-label="Semana siguiente" disabled={win === 0} onClick={() => irVentana(-1)}>{IconRight}</button>
      </div>

      <div className="pp-strip" role="group" aria-label="Elegí el día">
        {dias.map((d) => {
          const sel = d === fecha
          const { diaCorto, numero } = diaCortoYNumero(d)
          return (
            <button
              key={d}
              className={`pp-dbtn${sel ? ' sel' : ''}${diffDias(hoy, d) === 0 ? ' today' : ''}`}
              aria-pressed={sel}
              aria-label={formatLargo(d)}
              onClick={() => setFecha(d)}
            >
              <span className="pp-w">{diaCorto}</span><span className="pp-n">{numero}</span>
            </button>
          )
        })}
      </div>

      {loading && (
        <>
          <div className="pp-prog"><div className="pp-sk" style={{ height: 14, width: '58%' }} /></div>
          {skRows(5)}
        </>
      )}

      {!loading && data?.noPlan && (
        <div className="pp-empty">
          <div className="pp-ic">{IconDoc}</div>
          <h3>Tu profesional todavía no te cargó un plan</h3>
          <p>Cuando {profesionalNombre} lo cargue, vas a ver acá las comidas del día para registrarlas.</p>
        </div>
      )}

      {!loading && data && !data.noPlan && total === 0 && (
        // Copy provisorio ("No hay comidas indicadas para este día.") — avisado.
        <div className="pp-empty">
          <div className="pp-ic">{IconDoc}</div>
          <h3>No hay comidas indicadas para este día.</h3>
        </div>
      )}

      {!loading && data && !data.noPlan && total > 0 && (
        <>
          {!data.registroHabilitado && (
            <div className="pp-note warn">{IconPause}<span><b>El registro de comidas está pausado.</b> Lo pausó tu profesional. Podés seguir viendo tu plan y tus registros.</span></div>
          )}
          {data.registroHabilitado && off > 0 && eds === 0 && (
            <div className="pp-note">{IconLockNote}<span><b>Solo lectura.</b> Podés registrar comidas de hasta 48 h atrás.</span></div>
          )}
          {data.registroHabilitado && off > 0 && eds > 0 && eds < total && (
            <div className="pp-note">{IconClock}<span>Algunas comidas de este día ya no se pueden registrar: el plazo es de 48 h.</span></div>
          )}

          <div className="pp-prog"><span className="pp-t"><b>{hechas} de {total}</b> comidas registradas</span></div>
          <div className="pp-meals">
            {data.filas.map((f) => {
              if (f.estado === 'registrada' && f.registro) {
                const r = f.registro
                return (
                  <button type="button" className="pp-mrow" key={f.tipoComida} onClick={() => abrirDetalle(f)}>
                    {r.fotoVencida ? (
                      <div className="pp-thumb gone">{IconGone}</div>
                    ) : (
                      <div className="pp-thumb foto">
                        <img src={`/api/portal/fotos/${r.id}?v=thumb&t=${r.fotoVersion}`} alt="" />
                      </div>
                    )}
                    <div className="pp-mtx"><b>{f.tipoComida}</b><span>Indicado {f.hora ? f.hora.slice(0, 5) : '—'}</span></div>
                    <span className="pp-mst ok">{r.comentario && IconComment}Subida {horaCorta(r.registradoAt)}</span>
                  </button>
                )
              }
              if (f.estado === 'pendiente' && data.registroHabilitado) {
                return (
                  <button type="button" className="pp-mrow" key={f.tipoComida} onClick={() => abrirRegistro(f)}>
                    <div className="pp-thumb pp-cam">{IconCam}</div>
                    <div className="pp-mtx"><b>{f.tipoComida}</b><span>Indicado {f.hora ? f.hora.slice(0, 5) : '—'}</span></div>
                    <span className="pp-mst">Pendiente</span>
                  </button>
                )
              }
              const pausada = f.estado === 'pendiente' && !data.registroHabilitado
              return (
                <div className="pp-mrow pp-static" key={f.tipoComida}>
                  <div className="pp-thumb pp-cam off">{IconCamOff}</div>
                  <div className="pp-mtx"><b>{f.tipoComida}</b><span>Indicado {f.hora ? f.hora.slice(0, 5) : '—'}</span></div>
                  <span className="pp-mst">{pausada ? 'Pausado' : 'Sin registro'}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <RegistroSheet
        fecha={fecha}
        fila={filaAbierta}
        pantalla={pantalla}
        reemplazo={reemplazo}
        registroHabilitado={data?.registroHabilitado ?? true}
        diasRetencion={data?.diasRetencion ?? null}
        onClose={() => setPantalla('cerrado')}
        onPantalla={setPantalla}
        onReemplazar={reemplazarFoto}
        onGuardado={() => cargar(fecha)}
      />
    </>
  )
}
