'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import SlideOver from '@/components/ui/SlideOver'
import { useRecorteFoto, ERR } from '@/hooks/useRecorteFoto'

interface Props {
  open: boolean
  onClose: () => void
  pacienteId: string
  pacienteNombreCompleto: string
  pacientePrimerNombre: string
  iniciales: string
  avatarPath: string | null
  avatarUpdatedAt: string | null
  avatarOrigen: 'profesional' | 'paciente' | null
  onSaved: () => void
  onRemoved: () => void
}

export default function FotoPacienteSlide({
  open, onClose, pacienteId, pacienteNombreCompleto, pacientePrimerNombre, iniciales, avatarPath, avatarUpdatedAt, avatarOrigen, onSaved, onRemoved,
}: Props) {
  const {
    imgSrc, zoom, dragOver, busy, removing, error, bloqueado, canSave,
    cropRef, fileInputRef, pan,
    onPointerDown, onPointerMove, onPointerUp, onZoomChange,
    onDrop, onDragOver, onDragLeave,
    abrirSelector, onFileChange,
    guardar, quitar,
  } = useRecorteFoto({
    endpoint: `/api/pacientes/${pacienteId}/foto`,
    avatarPath,
    abierto: open,
    onSaved,
    onRemoved,
  })

  function handleClose() {
    if (busy) return
    onClose()
  }

  const fecha = avatarUpdatedAt ? format(parseISO(avatarUpdatedAt), "d MMM '·' HH:mm", { locale: es }) : null
  const subtitulo = !avatarPath
    ? `${pacienteNombreCompleto} · sin foto`
    : `Actualizada por ${avatarOrigen === 'paciente' ? 'el paciente' : 'tu equipo'} · ${fecha}`

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title="Foto del paciente"
      subtitle={subtitulo}
      subtitleCapitalize={false}
      width="narrow"
      noPadding
      footer={
        <div className="fp-so-foot">
          {avatarPath && (
            <button type="button" className="btn dng" disabled={busy} onClick={quitar}>
              {busy && removing ? <span className="fp-spin" /> : null}
              {busy && removing ? 'Quitando…' : 'Quitar foto'}
            </button>
          )}
          <button type="button" className="btn" disabled={busy} onClick={handleClose}>Cancelar</button>
          <button type="button" className="btn primary" disabled={!canSave} onClick={guardar}>
            {busy && !removing ? <span className="fp-spin" /> : null}
            {busy && !removing ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <div style={{ padding: '24px 20px' }}>
        <div
          ref={cropRef}
          className={`crop${!imgSrc ? ' empty' : ''}${bloqueado ? ' busy' : ''}${dragOver ? ' drag' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!imgSrc ? (
            <>
              <div className="big-av">{iniciales}</div>
              <p>Arrastrá una foto acá o elegí un archivo.</p>
            </>
          ) : (
            <>
              <img
                src={imgSrc}
                alt="Vista previa del recorte"
                draggable={false}
                style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
              />
              <span className="crop-mask" />
              {bloqueado && <span className="crop-spin" aria-label="Cargando" />}
            </>
          )}
        </div>

        {imgSrc && (
          <div className="zoom">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M21 21l-4.3-4.3" /></svg>
            <input
              type="range" min={1} max={3} step={0.01} value={zoom} aria-label="Zoom"
              disabled={bloqueado}
              style={{ '--p': `${((zoom - 1) / 2) * 100}%` } as React.CSSProperties}
              onChange={onZoomChange}
            />
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M11 8v6M21 21l-4.3-4.3" /></svg>
          </div>
        )}

        {error && (
          <div className="inote dng pf-err" role="alert">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            <span className="tx">{ERR[error]}</span>
          </div>
        )}

        <p className="pf-note">Cargá la foto solo si el paciente lo autorizó.</p>

        <div className="pf-pick">
          <button type="button" className="btn" disabled={bloqueado} onClick={() => abrirSelector('gal', 'environment')}>
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
            {imgSrc ? 'Elegir otra foto' : 'Elegir archivo'}
          </button>
          <button type="button" className="btn only-touch" disabled={bloqueado} onClick={() => abrirSelector('cam', 'environment')}>
            <svg viewBox="0 0 24 24"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
            Sacar foto
          </button>
        </div>

        <p className="pf-fmt">JPG, PNG o HEIC · hasta 10 MB. {pacientePrimerNombre} también puede cambiarla desde su portal.</p>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif" hidden onChange={onFileChange} />
      </div>
    </SlideOver>
  )
}
