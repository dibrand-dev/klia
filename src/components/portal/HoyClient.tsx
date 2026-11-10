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

type HoyData = { fecha: string; modoLibre: boolean; registroHabilitado: boolean; diasRetencion: number | null; diasConComentarioNuevo: string[]; filas: FilaHoy[] }

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

  // Se guarda solo la clave (tipoComida) y se busca la fila vigente en cada
  // render — así, si se guarda un comentario y se refetchea Hoy mientras el
  // sheet de detalle sigue abierto, el sheet ve el dato fresco en vez de la
  // foto fija del momento en que se abrió.
  const [filaAbiertaKey, setFilaAbiertaKey] = useState<string | null>(null)
  const [pantalla, setPantalla] = useState<'cerrado' | 'reg' | 'conf' | 'det'>('cerrado')
  const [reemplazo, setReemplazo] = useState(false)
  const filaAbierta = data?.filas.find((f) => f.clave === filaAbiertaKey) ?? null

  const end = sumarDias(hoy, -7 * win)
  const start = sumarDias(end, -6)
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(start, i))

  const cargar = useCallback(async (f: string, desde: string, hasta: string) => {
    setLoading(true)
    const res = await fetch(`/api/portal/hoy?fecha=${f}&desde=${desde}&hasta=${hasta}`)
    const body = await jsonOrNull(res)
    if (res.ok) setData(body)
    setLoading(false)
  }, [])

  useEffect(() => { cargar(fecha, start, end) }, [fecha, start, end, cargar])

  function irVentana(delta: number) {
    const nuevoWin = Math.max(0, Math.min(SEMANAS_ATRAS_MAX, win + delta))
    setWin(nuevoWin)
    setFecha(sumarDias(hoy, -7 * nuevoWin))
  }

  function abrirRegistro(f: FilaHoy) {
    if (offline) { toast('Sin conexión. Probá de nuevo cuando vuelva la señal.'); return }
    setFilaAbiertaKey(f.clave)
    setReemplazo(false)
    setPantalla('reg')
  }

  // Optimista: oculta "Nuevo comentario" y, si era el único de ese día, el
  // punto en la tira — sin esperar la respuesta de /visto, que se dispara en
  // paralelo y no bloquea la apertura del detalle.
  function abrirDetalle(f: FilaHoy) {
    setFilaAbiertaKey(f.clave)
    setReemplazo(false)
    setPantalla('det')

    const registro = f.registro
    if (registro?.comentarioProfesional?.nuevo) {
      setData((prev) => {
        if (!prev) return prev
        const filas = prev.filas.map((fila) => {
          if (fila.clave !== f.clave || !fila.registro?.comentarioProfesional) return fila
          return { ...fila, registro: { ...fila.registro, comentarioProfesional: { ...fila.registro.comentarioProfesional, nuevo: false } } }
        })
        const quedaAlgunoNuevo = filas.some((fila) => fila.registro?.comentarioProfesional?.nuevo)
        const diasConComentarioNuevo = quedaAlgunoNuevo
          ? prev.diasConComentarioNuevo
          : prev.diasConComentarioNuevo.filter((d) => d !== fecha)
        return { ...prev, filas, diasConComentarioNuevo }
      })
      fetch(`/api/portal/registros/${registro.id}/visto`, { method: 'POST' }).catch(() => {})
    }
  }

  function reemplazarFoto() {
    setReemplazo(true)
    setPantalla('reg')
  }
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
          const tieneNuevo = data?.diasConComentarioNuevo.includes(d) ?? false
          return (
            <button
              key={d}
              className={`pp-dbtn${sel ? ' sel' : ''}${diffDias(hoy, d) === 0 ? ' today' : ''}`}
              aria-pressed={sel}
              aria-label={`${formatLargo(d)}${tieneNuevo ? ', comentario nuevo' : ''}`}
              onClick={() => setFecha(d)}
            >
              <span className="pp-w">{diaCorto}</span><span className="pp-n">{numero}</span>
              {tieneNuevo && <i className="pp-ndot" aria-hidden="true" />}
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

      {!loading && data && total === 0 && (
        // Copy provisorio ("No hay comidas indicadas para este día.") — avisado.
        <div className="pp-empty">
          <div className="pp-ic">{IconDoc}</div>
          <h3>No hay comidas indicadas para este día.</h3>
        </div>
      )}

      {!loading && data && total > 0 && (
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
                  <button type="button" className="pp-mrow" key={f.clave} onClick={() => abrirDetalle(f)}>
                    {r.fotoVencida ? (
                      <div className="pp-thumb gone">{IconGone}</div>
                    ) : (
                      <div className="pp-thumb foto">
                        <img src={`/api/portal/fotos/${r.id}?v=thumb&t=${r.fotoVersion}`} alt="" />
                      </div>
                    )}
                    <div className="pp-mtx">
                      <b>{f.tipoComida}</b><span>Indicado {f.hora ? f.hora.slice(0, 5) : '—'}</span>
                      {r.comentarioProfesional?.nuevo && <span className="pp-ntag">Nuevo comentario</span>}
                    </div>
                    <span className="pp-mst ok">{r.comentario && IconComment}Subida {horaCorta(r.registradoAt)}</span>
                  </button>
                )
              }
              if (f.estado === 'pendiente' && data.registroHabilitado) {
                return (
                  <button type="button" className="pp-mrow" key={f.clave} onClick={() => abrirRegistro(f)}>
                    <div className="pp-thumb pp-cam">{IconCam}</div>
                    <div className="pp-mtx"><b>{f.tipoComida}</b><span>Indicado {f.hora ? f.hora.slice(0, 5) : '—'}</span></div>
                    <span className="pp-mst">Pendiente</span>
                  </button>
                )
              }
              const pausada = f.estado === 'pendiente' && !data.registroHabilitado
              return (
                <div className="pp-mrow pp-static" key={f.clave}>
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
        onGuardado={() => cargar(fecha, start, end)}
      />
    </>
  )
}
