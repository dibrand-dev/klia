'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

// Soporte para el link viejo /historial/nueva (redirigido a
// /historial?nueva=1 por compatibilidad con bookmarks): dispara el mismo
// evento que CrearPrimeraNotaButton para abrir el SlideOver global de nueva
// nota, una sola vez, y limpia el query param sin recargar la página.
export default function AbrirNuevaNotaDesdeQuery({ pacienteId }: { pacienteId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const yaDisparado = useRef(false)

  useEffect(() => {
    if (yaDisparado.current) return
    if (searchParams.get('nueva') !== '1') return
    yaDisparado.current = true
    window.dispatchEvent(new CustomEvent('openNuevaNotaClinica', { detail: { pacienteId } }))
    router.replace(pathname)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return null
}
