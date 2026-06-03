'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface Archivo {
  id: string
  nombre: string
  categoria: string
  google_drive_url: string
  mime_type: string
  tamanio_bytes: number
  fecha_estudio: string | null
  descripcion: string | null
  created_at: string
}

const CATEGORIAS = [
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'imagenes', label: 'Imágenes' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'otros', label: 'Otros' },
]

const CATEGORIA_LABELS: Record<string, string> = {
  laboratorio: 'Laboratorio',
  imagenes: 'Imágenes',
  documentos: 'Documentos',
  otros: 'Otros',
}

const CATEGORIA_ICONS: Record<string, string> = {
  laboratorio: 'biotech',
  imagenes: 'radiology',
  documentos: 'description',
  otros: 'folder',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getMimeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'picture_as_pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'article'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'table_chart'
  return 'insert_drive_file'
}

interface Props {
  pacienteId: string
  pacienteNombre: string
}

export default function ArchivosTab({ pacienteId, pacienteNombre }: Props) {
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [panelOpen, setPanelOpen] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<Archivo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    categoria: 'documentos',
    fechaEstudio: '',
    descripcion: '',
    file: null as File | null,
  })

  const fetchArchivos = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/archivos/listar?pacienteId=${pacienteId}`)
    if (res.ok) {
      const data = await res.json()
      setArchivos(data.archivos ?? [])
    }
    setLoading(false)
  }, [pacienteId])

  useEffect(() => { fetchArchivos() }, [fetchArchivos])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setForm((f) => ({ ...f, file }))
  }

  async function handleSubir() {
    if (!form.file) return
    setUploading(true)
    setUploadError(null)

    const fd = new FormData()
    fd.append('file', form.file)
    fd.append('pacienteId', pacienteId)
    fd.append('pacienteNombre', pacienteNombre)
    fd.append('categoria', form.categoria)
    if (form.fechaEstudio) fd.append('fechaEstudio', form.fechaEstudio)
    if (form.descripcion.trim()) fd.append('descripcion', form.descripcion.trim())

    const res = await fetch('/api/archivos/subir', { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setUploadError(err.error ?? 'Error al subir el archivo')
      setUploading(false)
      return
    }

    setUploading(false)
    setPanelOpen(false)
    setForm({ categoria: 'documentos', fechaEstudio: '', descripcion: '', file: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
    fetchArchivos()
  }

  async function handleEliminar(archivo: Archivo) {
    const res = await fetch('/api/archivos/eliminar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivoId: archivo.id }),
    })
    if (res.ok) {
      setArchivos((prev) => prev.filter((a) => a.id !== archivo.id))
    }
    setConfirmEliminar(null)
  }

  const filtrados = filtroCategoria === 'todas'
    ? archivos
    : archivos.filter((a) => a.categoria === filtroCategoria)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('todas')}
            className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors', filtroCategoria === 'todas' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')}
          >
            Todos ({archivos.length})
          </button>
          {CATEGORIAS.map((cat) => {
            const count = archivos.filter((a) => a.categoria === cat.value).length
            if (count === 0 && filtroCategoria !== cat.value) return null
            return (
              <button
                key={cat.value}
                onClick={() => setFiltroCategoria(cat.value)}
                className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors', filtroCategoria === cat.value ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')}
              >
                {cat.label} ({count})
              </button>
            )
          })}
        </div>
        <button
          onClick={() => { setPanelOpen(true); setUploadError(null) }}
          className="btn-primary text-sm flex items-center gap-1.5 px-4 py-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>
          Subir archivo
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-on-surface-variant text-sm">Cargando archivos...</div>
      ) : filtrados.length === 0 ? (
        <div className="border border-dashed border-outline-variant/30 rounded-xl bg-surface-container-lowest p-10 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/40 mb-3 block" style={{ fontSize: 40 }}>folder_open</span>
          <p className="text-[15px] font-semibold text-on-surface mb-1">Sin archivos</p>
          <p className="text-sm text-on-surface-variant">
            {filtroCategoria === 'todas' ? 'Todavía no hay archivos subidos para este paciente.' : `No hay archivos en la categoría ${CATEGORIA_LABELS[filtroCategoria]}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((archivo) => (
            <div key={archivo.id} className="card flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }}>
                  {getMimeIcon(archivo.mime_type)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{archivo.nombre}</p>
                <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{CATEGORIA_ICONS[archivo.categoria]}</span>
                    {CATEGORIA_LABELS[archivo.categoria]}
                  </span>
                  <span>·</span>
                  <span>{formatBytes(archivo.tamanio_bytes)}</span>
                  {archivo.fecha_estudio && (
                    <>
                      <span>·</span>
                      <span>{format(parseISO(archivo.fecha_estudio), 'd MMM yyyy', { locale: es })}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>Subido {format(parseISO(archivo.created_at), 'd MMM yyyy', { locale: es })}</span>
                </p>
                {archivo.descripcion && (
                  <p className="text-xs text-on-surface-variant mt-1 italic">{archivo.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={archivo.google_drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant hover:text-primary"
                  title="Abrir en Drive"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>open_in_new</span>
                </a>
                <button
                  onClick={() => setConfirmEliminar(archivo)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors text-on-surface-variant hover:text-red-600"
                  title="Eliminar"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload panel */}
      <SlideOver
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setUploadError(null) }}
        title="Subir archivo"
        subtitle={pacienteNombre}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setPanelOpen(false)} className="btn-secondary flex-1 py-3 text-sm font-semibold">
              Cancelar
            </button>
            <button
              onClick={handleSubir}
              disabled={!form.file || uploading}
              className={cn('btn-primary flex-1 py-3 text-sm font-semibold', (!form.file || uploading) && 'opacity-50')}
            >
              {uploading ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{uploadError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Archivo</label>
            <div
              className={cn('border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors', form.file ? 'border-primary/40 bg-primary-container/10' : 'border-outline-variant/40 hover:border-primary/30 hover:bg-surface-container-lowest')}
              onClick={() => fileInputRef.current?.click()}
            >
              {form.file ? (
                <div>
                  <span className="material-symbols-outlined text-primary mb-2 block" style={{ fontSize: 32 }}>
                    {getMimeIcon(form.file.type)}
                  </span>
                  <p className="text-sm font-medium text-on-surface">{form.file.name}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{formatBytes(form.file.size)}</p>
                </div>
              ) : (
                <div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 mb-2 block" style={{ fontSize: 32 }}>upload_file</span>
                  <p className="text-sm text-on-surface-variant">Hacé clic para seleccionar un archivo</p>
                  <p className="text-xs text-on-surface-variant/60 mt-1">PDF, imágenes, documentos · máx. 20 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
              onChange={handleFileChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Categoría</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              className="input-field"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">
              Fecha del estudio <span className="text-on-surface-variant font-normal">(opcional)</span>
            </label>
            <input
              type="date"
              value={form.fechaEstudio}
              onChange={(e) => setForm((f) => ({ ...f, fechaEstudio: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">
              Descripción <span className="text-on-surface-variant font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              rows={3}
              placeholder="Ej: Hemograma completo, resonancia de columna lumbar..."
              className="input-field resize-none"
            />
          </div>
        </div>
      </SlideOver>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmEliminar}
        title="Eliminar archivo"
        message={confirmEliminar ? `¿Eliminás "${confirmEliminar.nombre}"? Se borrará de Google Drive y no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => confirmEliminar && handleEliminar(confirmEliminar)}
        onCancel={() => setConfirmEliminar(null)}
      />
    </div>
  )
}
