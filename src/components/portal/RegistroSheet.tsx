'use client'

import { useEffect, useRef, useState } from 'react'
import { estaEnPlazo } from '@/lib/portal/plazo'
import { procesarFoto, ImagenError, type FotoProcesada } from '@/lib/portal/imagen'
import { useOffline } from '@/lib/portal/useOffline'
import { useToast } from './ToastContext'
import { formatCorto, formatLargo } from '@/lib/portal/semana'

const IconCam = <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
const IconImg = <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></svg>
const IconTip = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'var(--muted)', strokeWidth: 1.8, fill: 'none' }}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" /></svg>
const IconX = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'var(--ink-2)', strokeWidth: 1.8, fill: 'none' }}><path d="M6 6l12 12M18 6L6 18" /></svg>
const IconAlert = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>
const IconClock = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
const IconCheck = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>
const IconLock = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
const IconGone = <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 3l18 18" /></svg>

function horaCortaAR(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
}
function horaActualAR(): string {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
}

export interface FilaHoy {
  tipoComida: string
  hora: string | null
  planComidaId: string
  estado: 'registrada' | 'pendiente' | 'vencida'
  registro: { id: string; registradoAt: string; comentario: string | null; fotoVencida: boolean; fotoVersion: number } | null
}

type Pantalla = 'cerrado' | 'reg' | 'conf' | 'det'

interface Draft {
  file: File
  previewUrl: string
  comentario: string
  horaChip: string
}

interface Subiendo {
  fase: 'opt' | 'sub'
  pct: number
}

export default function RegistroSheet({
  fecha, fila, pantalla, reemplazo, registroHabilitado, diasRetencion,
  onClose, onPantalla, onReemplazar, onGuardado,
}: {
  fecha: string
  fila: FilaHoy | null
  pantalla: Pantalla
  reemplazo: boolean
  registroHabilitado: boolean
  diasRetencion: number | null
  onClose: () => void
  onPantalla: (p: 'reg' | 'conf' | 'det') => void
  onReemplazar: () => void
  onGuardado: () => void
}) {
  const toast = useToast()
  const offline = useOffline()
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [procesadoCache, setProcesadoCache] = useState<FotoProcesada | null>(null)
  const [subiendo, setSubiendo] = useState<Subiendo | null>(null)
  const [error, setError] = useState(false)
  const [comentarioEdit, setComentarioEdit] = useState('')
  const [guardandoComentario, setGuardandoComentario] = useState(false)

  const bloqueado = subiendo !== null

  useEffect(() => {
    if (pantalla !== 'conf') {
      setDraft(null)
      setProcesadoCache(null)
      setSubiendo(null)
      setError(false)
    }
  }, [pantalla])

  useEffect(() => {
    if (pantalla === 'det' && fila?.registro) setComentarioEdit(fila.registro.comentario ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantalla, fila?.registro?.id, fila?.registro?.comentario])

  useEffect(() => {
    return () => { if (draft) URL.revokeObjectURL(draft.previewUrl) }
  }, [draft])

  const abierto = pantalla !== 'cerrado'

  useEffect(() => {
    if (!abierto) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, bloqueado])

  function cerrar() {
    if (bloqueado) return
    onClose()
  }

  function onArchivoElegido(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const previewUrl = URL.createObjectURL(f)
    setDraft({
      file: f,
      previewUrl,
      comentario: reemplazo ? (fila?.registro?.comentario ?? '') : '',
      horaChip: horaActualAR(),
    })
    onPantalla('conf')
  }

  function subirConXHR(procesado: FotoProcesada): Promise<boolean> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/portal/registros')
      const fd = new FormData()
      fd.append('foto', procesado.foto, `foto.${procesado.ext}`)
      fd.append('miniatura', procesado.miniatura, `thumb.${procesado.ext}`)
      fd.append('fecha', fecha)
      fd.append('comida', fila?.planComidaId ?? '')
      fd.append('comentario', draft?.comentario ?? '')
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return
        setSubiendo({ fase: 'sub', pct: 35 + (e.loaded / e.total) * 65 })
      }
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
      xhr.onerror = () => resolve(false)
      xhr.send(fd)
    })
  }

  async function subirAhora(procesado: FotoProcesada) {
    setSubiendo({ fase: 'sub', pct: 35 })
    const ok = await subirConXHR(procesado)
    if (!ok) {
      setSubiendo(null)
      setError(true)
      return
    }
    setSubiendo({ fase: 'sub', pct: 100 })
    const nombre = fila?.tipoComida ?? 'Comida'
    setTimeout(() => {
      onClose()
      onGuardado()
      toast(reemplazo ? 'Foto reemplazada' : `${nombre} registrado`)
    }, 260)
  }

  async function guardar() {
    if (!draft) return
    setError(false)
    setSubiendo({ fase: 'opt', pct: 0 })
    try {
      const procesado = await procesarFoto(draft.file, (pct) => setSubiendo({ fase: 'opt', pct }))
      setProcesadoCache(procesado)
      await subirAhora(procesado)
    } catch (e) {
      setSubiendo(null)
      if (e instanceof ImagenError) {
        toast(e.codigo === 'decode' ? 'No pudimos leer esta foto. Probá con otra o sacá una nueva.' : 'La foto es demasiado grande. Probá con otra o sacá una nueva.')
        onPantalla('reg')
      }
    }
  }

  // Reintentar no vuelve a comprimir — ya tenemos el Blob comprimido en
  // memoria de la primera pasada, salta directo a subir.
  function reintentar() {
    if (!procesadoCache) { guardar(); return }
    setError(false)
    subirAhora(procesadoCache)
  }

  async function guardarComentario() {
    if (!fila?.registro) return
    setGuardandoComentario(true)
    const res = await fetch(`/api/portal/registros/${fila.registro.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comentario: comentarioEdit }),
    })
    setGuardandoComentario(false)
    if (!res.ok) { toast('No pudimos guardar el comentario.'); return }
    toast('Comentario guardado')
    onGuardado()
  }

  const puedeEditarDet = !!fila?.registro && !fila.registro.fotoVencida
    && estaEnPlazo(fecha, fila.hora, new Date()) && registroHabilitado && !offline

  return (
    <>
      <div className={`pp-scrim${abierto ? ' open' : ''}`} onClick={cerrar} />
      <section className={`pp-sheet${abierto ? ' open' : ''}${pantalla !== 'reg' ? ' full' : ''}`} role="dialog" aria-modal="true" aria-labelledby="rs-t">
        {fila && (
          <>
            <div className="pp-grab" />
            <div className="pp-so-hdr">
              <div className="pp-tt">
                <h2 id="rs-t">
                  {pantalla === 'conf' ? (reemplazo ? 'Reemplazar foto' : 'Confirmar registro') : fila.tipoComida}
                </h2>
                <div className="pp-sb">
                  {pantalla === 'reg' && `${formatCorto(fecha)} · indicado ${fila.hora ? fila.hora.slice(0, 5) : '—'}`}
                  {pantalla === 'conf' && fila.tipoComida}
                  {pantalla === 'det' && formatLargo(fecha)}
                </div>
              </div>
              <button ref={closeBtnRef} className="pp-so-close" aria-label="Cerrar" disabled={bloqueado} onClick={cerrar}>{IconX}</button>
            </div>

            {pantalla === 'reg' && (
              <div className="pp-so-body" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
                <div className="pp-acts">
                  <button className="pp-pb pri big full" onClick={() => camRef.current?.click()}>{IconCam}Sacar foto</button>
                  <button className="pp-pb big full" onClick={() => galRef.current?.click()}>{IconImg}Elegir de la galería</button>
                </div>
                <p className="pp-tip">{IconTip}<span>Sacala desde arriba, antes de comer, con el plato completo.</span></p>
                <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onArchivoElegido} />
                <input ref={galRef} type="file" accept="image/*" hidden onChange={onArchivoElegido} />
              </div>
            )}

            {pantalla === 'conf' && draft && (
              <>
                <div className="pp-so-body">
                  <div className="pp-shot" role="img" aria-label="Vista previa de la foto">
                    <img src={draft.previewUrl} alt="" />
                  </div>
                  <div className="pp-chips">
                    <span className="pp-chip">{fila.tipoComida}</span>
                    <span className="pp-chip">{formatCorto(fecha)}</span>
                    <span className="pp-chip">{IconClock}{draft.horaChip}</span>
                  </div>
                  {error && (
                    <div className="pp-note danger" role="alert" style={{ marginTop: 0, marginBottom: 16 }}>
                      {IconAlert}<span><b>No pudimos subir la foto.</b> Revisá tu conexión y volvé a intentar. Tu comentario no se pierde.</span>
                    </div>
                  )}
                  <div className="pp-af" style={{ margin: 0 }}>
                    <label htmlFor="rs-comentario">Comentario (opcional)</label>
                    <textarea
                      className="pp-ta" id="rs-comentario" maxLength={300} disabled={bloqueado}
                      placeholder="Ej.: reemplacé el arroz por quinoa"
                      value={draft.comentario}
                      onChange={(e) => setDraft((d) => (d ? { ...d, comentario: e.target.value } : d))}
                    />
                    <div className="pp-cnt">{draft.comentario.length}/300</div>
                  </div>
                </div>
                <div className="pp-so-foot">
                  {subiendo ? (
                    <div className="pp-upl" role="status" aria-live="polite">
                      <div className="pp-r"><span>{subiendo.fase === 'opt' ? 'Optimizando foto…' : 'Subiendo…'}</span><span>{Math.round(subiendo.pct)} %</span></div>
                      <div className="pp-bar"><i style={{ width: `${subiendo.pct}%` }} /></div>
                    </div>
                  ) : (
                    <>
                      <button className="pp-pb" onClick={() => onPantalla('reg')}>{IconImg}Cambiar foto</button>
                      <button className="pp-pb pri" onClick={error ? reintentar : guardar}>{error ? 'Reintentar' : 'Guardar'}</button>
                    </>
                  )}
                </div>
              </>
            )}

            {pantalla === 'det' && fila.registro && (
              <>
                <div className="pp-so-body">
                  {fila.registro.fotoVencida ? (
                    <div className="pp-shot gone">
                      {IconGone}
                      <p>La foto se eliminó a los {diasRetencion ?? '—'} días. Se conserva tu comentario.</p>
                    </div>
                  ) : (
                    <div className="pp-shot" role="img" aria-label={`Foto de ${fila.tipoComida.toLowerCase()}`}>
                      <img src={`/api/portal/fotos/${fila.registro.id}?v=full&t=${fila.registro.fotoVersion}`} alt="" />
                    </div>
                  )}
                  <div className="pp-chips">
                    <span className="pp-chip ok">{IconCheck}Subida {horaCortaAR(fila.registro.registradoAt)}</span>
                    <span className="pp-chip">Indicado {fila.hora ? fila.hora.slice(0, 5) : '—'}</span>
                  </div>
                  {puedeEditarDet ? (
                    <div className="pp-af" style={{ margin: 0 }}>
                      <label htmlFor="rs-det-comentario">Comentario</label>
                      <textarea
                        className="pp-ta" id="rs-det-comentario" maxLength={300}
                        placeholder="Agregá un comentario para tu profesional"
                        value={comentarioEdit}
                        onChange={(e) => setComentarioEdit(e.target.value)}
                      />
                      <div className="pp-cnt">{comentarioEdit.length}/300</div>
                    </div>
                  ) : (
                    <>
                      <div className="pp-lbl" style={{ marginBottom: 6 }}>Comentario</div>
                      <div className={`pp-ro-c${fila.registro.comentario ? '' : ' none'}`}>{fila.registro.comentario || 'Sin comentario.'}</div>
                      {!fila.registro.fotoVencida && (
                        <div className="pp-note">
                          {IconLock}
                          <span>
                            {!registroHabilitado
                              ? 'El registro está pausado por tu profesional.'
                              : offline
                                ? 'Sin conexión: por ahora no podés editar.'
                                : 'Solo lectura. Pasaron más de 48 h desde esta comida.'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {puedeEditarDet && (
                  <div className="pp-so-foot">
                    <button className="pp-pb" onClick={onReemplazar}>{IconCam}Reemplazar foto</button>
                    <button
                      className="pp-pb pri"
                      disabled={guardandoComentario || comentarioEdit === (fila.registro.comentario ?? '')}
                      onClick={guardarComentario}
                    >
                      {guardandoComentario ? 'Guardando...' : 'Guardar comentario'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </>
  )
}
