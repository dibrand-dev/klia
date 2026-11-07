'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import WebinarHeroUploader from './WebinarHeroUploader'
import { cn } from '@/lib/utils'
import type { Webinar, InscripcionWebinar } from '@/types/database'

type WebinarConConteo = Webinar & { inscriptos_count: number }

interface Props {
  webinariosIniciales: WebinarConConteo[]
}

function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

// UTC (como se guarda en la base) → string de <input type="datetime-local">
// interpretado como hora Argentina (UTC-3 fijo).
function utcToDatetimeLocalAR(iso: string): string {
  const d = new Date(iso)
  const art = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${art.getUTCFullYear()}-${pad(art.getUTCMonth() + 1)}-${pad(art.getUTCDate())}T${pad(art.getUTCHours())}:${pad(art.getUTCMinutes())}`
}

function fmtFechaAR(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500',
  publicado: 'bg-green-50 text-green-700',
  cancelado: 'bg-red-50 text-red-700',
}

function WebinarForm({ webinar, open, onClose, onSaved }: {
  webinar: WebinarConConteo | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!webinar

  const [titulo, setTitulo] = useState(webinar?.titulo ?? '')
  const [slug, setSlug] = useState(webinar?.slug ?? '')
  const [slugTocado, setSlugTocado] = useState(isEditing)
  const [bajada, setBajada] = useState(webinar?.bajada ?? '')
  const [institucion, setInstitucion] = useState(webinar?.institucion ?? '')
  const [imagenUrl, setImagenUrl] = useState<string | null>(webinar?.imagen_url ?? null)
  const [fechaInicio, setFechaInicio] = useState(webinar ? utcToDatetimeLocalAR(webinar.fecha_inicio) : '')
  const [duracionMin, setDuracionMin] = useState(webinar?.duracion_min?.toString() ?? '60')
  const [cierreInscripcion, setCierreInscripcion] = useState(webinar ? utcToDatetimeLocalAR(webinar.cierre_inscripcion) : '')
  const [cierreTocado, setCierreTocado] = useState(isEditing)
  const [urlVideo, setUrlVideo] = useState(webinar?.url_videoconferencia ?? '')
  const [estado, setEstado] = useState<string>(webinar?.estado ?? 'borrador')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleTituloChange(v: string) {
    setTitulo(v)
    if (!slugTocado) setSlug(slugify(v))
  }

  function handleFechaInicioChange(v: string) {
    setFechaInicio(v)
    if (!cierreTocado) setCierreInscripcion(v)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const body = {
      titulo: titulo.trim(),
      slug: slug.trim(),
      bajada: bajada.trim(),
      institucion: institucion.trim() || null,
      imagen_url: imagenUrl,
      fecha_inicio: fechaInicio,
      duracion_min: Number(duracionMin) || 60,
      cierre_inscripcion: cierreInscripcion,
      url_videoconferencia: urlVideo.trim(),
      estado,
    }

    const url = isEditing ? `/api/ops/webinars/${webinar!.id}` : '/api/ops/webinars'
    const method = isEditing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
    onSaved()
  }

  const camposCompletos = titulo.trim() && slug.trim() && bajada.trim() && fechaInicio && cierreInscripcion && urlVideo.trim()

  return (
    <SlideOver open={open} onClose={onClose} title={webinar ? 'Editar webinar' : 'Nuevo webinar'} width="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Título <span className="text-error">*</span>
          </label>
          <input type="text" value={titulo} onChange={(e) => handleTituloChange(e.target.value)} required maxLength={140} className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Slug <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTocado(true) }}
            required
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            maxLength={80}
            className="input-field font-mono text-sm"
          />
          <p className="text-xs text-on-surface-variant mt-1">Solo minúsculas, números y guiones. Se usa en la URL pública.</p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Bajada <span className="text-error">*</span>
          </label>
          <textarea value={bajada} onChange={(e) => setBajada(e.target.value)} required rows={4} maxLength={1200} className="input-field w-full resize-none" />
          <p className="text-xs text-on-surface-variant mt-1">Los saltos de línea se muestran como párrafos separados.</p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Institución</label>
          <input type="text" value={institucion} onChange={(e) => setInstitucion(e.target.value)} className="input-field" placeholder="Opcional" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Imagen hero</label>
          <WebinarHeroUploader imagenUrl={imagenUrl} onUpload={setImagenUrl} onRemove={() => setImagenUrl(null)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
              Fecha y hora de inicio (AR) <span className="text-error">*</span>
            </label>
            <input type="datetime-local" value={fechaInicio} onChange={(e) => handleFechaInicioChange(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Duración (min)</label>
            <input type="number" value={duracionMin} onChange={(e) => setDuracionMin(e.target.value)} min={5} max={600} className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Cierre de inscripción (AR) <span className="text-error">*</span>
          </label>
          <input
            type="datetime-local"
            value={cierreInscripcion}
            onChange={(e) => { setCierreInscripcion(e.target.value); setCierreTocado(true) }}
            required
            className="input-field"
          />
          <p className="text-xs text-on-surface-variant mt-1">No puede ser posterior al inicio.</p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            URL de la videoconferencia <span className="text-error">*</span>
          </label>
          <input type="url" value={urlVideo} onChange={(e) => setUrlVideo(e.target.value)} required pattern="https://.*" placeholder="https://..." className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input-field">
            <option value="borrador">Borrador</option>
            <option value="publicado">Publicado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="submit"
            disabled={loading || !camposCompletos}
            className={cn('btn-primary flex-1 py-3', (loading || !camposCompletos) && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}

function InscriptosSlide({ webinar, open, onClose }: { webinar: WebinarConConteo | null; open: boolean; onClose: () => void }) {
  const [inscriptos, setInscriptos] = useState<InscripcionWebinar[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !webinar) return
    setLoading(true)
    fetch(`/api/ops/webinars/${webinar.id}/inscriptos`)
      .then((r) => r.json())
      .then((data) => setInscriptos(data.inscriptos ?? []))
      .finally(() => setLoading(false))
  }, [open, webinar])

  return (
    <SlideOver open={open} onClose={onClose} title={webinar ? `Inscriptos — ${webinar.titulo}` : 'Inscriptos'} width="xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-surface-variant">{inscriptos.length} inscripto{inscriptos.length === 1 ? '' : 's'}</p>
        {webinar && (
          <a
            href={`/api/ops/webinars/${webinar.id}/inscriptos?format=csv`}
            className="btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Exportar CSV
          </a>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Cargando...</p>
      ) : (
        <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant bg-surface-container-lowest">
                <th className="px-3 py-2.5 font-medium">Nombre</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Teléfono</th>
                <th className="px-3 py-2.5 font-medium">Especialidad</th>
                <th className="px-3 py-2.5 font-medium">Institución</th>
                <th className="px-3 py-2.5 font-medium">Inscripción</th>
              </tr>
            </thead>
            <tbody>
              {inscriptos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">Todavía no hay inscriptos.</td></tr>
              )}
              {inscriptos.map((i) => (
                <tr key={i.id} className="border-b border-outline-variant/10 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-on-surface whitespace-nowrap">{i.nombre_apellido}</td>
                  <td className="px-3 py-2.5 text-on-surface-variant">{i.email}</td>
                  <td className="px-3 py-2.5 text-on-surface-variant whitespace-nowrap">{i.telefono}</td>
                  <td className="px-3 py-2.5 text-on-surface-variant">{i.especialidad}</td>
                  <td className="px-3 py-2.5 text-on-surface-variant">{i.institucion ?? '—'}</td>
                  <td className="px-3 py-2.5 text-on-surface-variant whitespace-nowrap">{fmtFechaAR(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SlideOver>
  )
}

export default function WebinarsClient({ webinariosIniciales }: Props) {
  const router = useRouter()
  const webinars = webinariosIniciales

  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<WebinarConConteo | null>(null)
  const [viendoInscriptos, setViendoInscriptos] = useState<WebinarConConteo | null>(null)
  const [eliminando, setEliminando] = useState<WebinarConConteo | null>(null)
  const [eliminarError, setEliminarError] = useState<string | null>(null)

  function refetch() {
    setCreando(false)
    setEditando(null)
    router.refresh()
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    const res = await fetch(`/api/ops/webinars/${eliminando.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setEliminarError(data.error ?? 'No se pudo eliminar.'); return }
    setEliminando(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => setCreando(true)} className="btn-primary px-4 py-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">add</span>
          Nuevo webinar
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Inscriptos</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {webinars.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">No hay webinars cargados.</td></tr>
            )}
            {webinars.map((w) => (
              <tr key={w.id} className="border-b border-outline-variant/10 last:border-0">
                <td className="px-4 py-3 font-medium text-on-surface max-w-[280px] truncate" title={w.titulo}>{w.titulo}</td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{fmtFechaAR(w.fecha_inicio)}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', ESTADO_BADGE[w.estado])}>{w.estado}</span>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  <button onClick={() => setViendoInscriptos(w)} className="hover:text-primary hover:underline">
                    {w.inscriptos_count}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setViendoInscriptos(w)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors"
                      title="Ver inscriptos"
                    >
                      <span className="material-symbols-outlined text-base">groups</span>
                    </button>
                    <button
                      onClick={() => setEditando(w)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => { setEliminando(w); setEliminarError(null) }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Eliminar"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creando || editando) && (
        <WebinarForm
          webinar={editando}
          open={true}
          onClose={() => { setCreando(false); setEditando(null) }}
          onSaved={refetch}
        />
      )}

      <InscriptosSlide webinar={viendoInscriptos} open={!!viendoInscriptos} onClose={() => setViendoInscriptos(null)} />

      {eliminando && (
        <ConfirmDialog
          open={true}
          title={`Eliminar "${eliminando.titulo}"`}
          message={eliminarError ?? '¿Confirmás que querés eliminar este webinar? Esta acción no se puede deshacer.'}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={confirmarEliminar}
          onCancel={() => setEliminando(null)}
        />
      )}
    </div>
  )
}
