import { redirect } from 'next/navigation'

// Ruta vieja — la creación de notas ahora pasa por el SlideOver global
// (evento openNuevaNotaClinica), no por una página propia. Se mantiene este
// redirect para no romper links/bookmarks viejos a /historial/nueva — el
// query param ?nueva=1 hace que AbrirNuevaNotaDesdeQuery (en /historial)
// dispare la apertura del SlideOver.
export default function NuevaNotaPage({ params }: { params: { id: string } }) {
  redirect(`/pacientes/${params.id}/historial?nueva=1`)
}
