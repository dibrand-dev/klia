'use client'

import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRecorteFoto, ERR } from '@/hooks/useRecorteFoto'

const IconX = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'var(--ink-2)', strokeWidth: 1.8, fill: 'none' }}><path d="M6 6l12 12M18 6L6 18" /></svg>
const IconAlert = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
const IconCam = <svg viewBox="0 0 24 24"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
const IconImg = <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
const IconZoomOut = <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M21 21l-4.3-4.3" /></svg>
const IconZoomIn = <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M11 8v6M21 21l-4.3-4.3" /></svg>

interface Props {
  open: boolean
  onClose: () => void
  iniciales: string
  avatarPath: string | null
  avatarUpdatedAt: string | null
  avatarOrigen: 'profesional' | 'paciente' | null
  onSaved: () => void
  onRemoved: () => void
}

export default function FotoPerfilSheet({
  open, onClose, iniciales, avatarPath, avatarUpdatedAt, avatarOrigen, onSaved, onRemoved,
}: Props) {
  const {
    imgSrc, zoom, busy, removing, error, bloqueado, canSave,
    cropRef, fileInputRef, pan,
    onPointerDown, onPointerMove, onPointerUp, onZoomChange,
    abrirSelector, onFileChange,
    guardar, quitar,
  } = useRecorteFoto({
    endpoint: '/api/portal/foto',
    avatarPath,
    abierto: open,
    onSaved,
    onRemoved,
  })

  function handleClose() {
    if (busy) return
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy])

  const fecha = avatarUpdatedAt ? format(parseISO(avatarUpdatedAt), "d MMM '·' HH:mm", { locale: es }) : null
  const subtitulo = !avatarPath
    ? 'Tu nutricionista la ve en tu ficha'
    : `Actualizada por ${avatarOrigen === 'paciente' ? 'vos' : 'tu nutricionista'} · ${fecha}`

  return (
    <>
      <div className={`pp-scrim${open ? ' open' : ''}`} onClick={handleClose} />
      <section className={`pp-sheet${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ps-t">
        <div className="pp-grab" />
        <div className="pp-so-hdr">
          <div className="pp-tt">
            <h2 id="ps-t">Foto de perfil</h2>
            <div className="pp-sb">{subtitulo}</div>
          </div>
          <button className="pp-so-close" aria-label="Cerrar" disabled={busy} onClick={handleClose}>{IconX}</button>
        </div>
        <div className="pp-so-body">
          <div
            ref={cropRef}
            className={`pp-crop${!imgSrc ? ' empty' : ''}${bloqueado ? ' busy' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {!imgSrc ? (
              <>
                <div className="pp-big-av">{iniciales}</div>
                <p>Todavía no cargaste una foto.</p>
              </>
            ) : (
              <>
                <img
                  src={imgSrc}
                  alt="Vista previa del recorte"
                  draggable={false}
                  style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
                />
                <span className="pp-crop-mask" />
                {bloqueado && <span className="pp-crop-spin" aria-label="Cargando" />}
              </>
            )}
          </div>

          {imgSrc && (
            <div className="pp-zoom">
              {IconZoomOut}
              <input
                type="range" min={1} max={3} step={0.01} value={zoom} aria-label="Zoom"
                disabled={bloqueado}
                style={{ '--p': `${((zoom - 1) / 2) * 100}%` } as React.CSSProperties}
                onChange={onZoomChange}
              />
              {IconZoomIn}
            </div>
          )}

          {error && (
            <div className="pp-note danger" role="alert">{IconAlert}<span>{ERR[error]}</span></div>
          )}

          <div className="pp-acts pf-acts">
            <button type="button" className="pp-pb big" disabled={bloqueado} onClick={() => abrirSelector('cam', 'user')}>{IconCam}Sacar foto</button>
            <button type="button" className="pp-pb big" disabled={bloqueado} onClick={() => abrirSelector('gal', 'user')}>{IconImg}Elegir foto</button>
          </div>

          {avatarPath && (
            <button type="button" className="pp-lnk dng" style={{ display: 'flex', margin: '6px auto 0' }} disabled={busy} onClick={quitar}>
              {busy && removing ? <span className="pp-spin" /> : null}
              {busy && removing ? 'Quitando…' : 'Quitar foto'}
            </button>
          )}

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif" hidden onChange={onFileChange} />
        </div>
        <div className="pp-so-foot">
          <button type="button" className="pp-pb" disabled={busy} onClick={handleClose}>Cancelar</button>
          <button type="button" className="pp-pb pri" disabled={!canSave} onClick={guardar}>
            {busy && !removing ? <span className="pp-spin" /> : null}
            {busy && !removing ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>
    </>
  )
}
