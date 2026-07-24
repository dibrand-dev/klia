'use client'

import type { NotaClinica } from '@/types/database'
import RichTextEditor from '@/components/ui/RichTextEditor'

export function isHtmlEmpty(html: string): boolean {
  return !html.replace(/<[^>]*>/g, '').trim()
}

function renderContenido(contenido: string) {
  const isHtml = contenido.trim().startsWith('<')
  if (isHtml) {
    return <div className="prose prose-sm max-w-none contenido" dangerouslySetInnerHTML={{ __html: contenido }} />
  }
  return <p className="contenido whitespace-pre-wrap">{contenido}</p>
}

export default function NotaContenido({
  nota,
  editando,
  contenido,
  onContenidoChange,
  error,
}: {
  nota: NotaClinica
  editando: boolean
  contenido: string
  onContenidoChange: (v: string) => void
  error: string | null
}) {
  return (
    <div className="drawer-sec">
      <h3>Observaciones clínicas</h3>
      {editando ? (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>
          )}
          <RichTextEditor value={contenido} onChange={onContenidoChange} minHeight="240px" />
        </>
      ) : (
        renderContenido(nota.contenido)
      )}
    </div>
  )
}
