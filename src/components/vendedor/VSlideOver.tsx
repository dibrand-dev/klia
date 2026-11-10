'use client'

import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

// SlideOver propio del panel de vendedores (clases .so/.scrim de
// vendedor.css, distintas a las de components/ui/SlideOver que usa el
// resto de la app) — mismo patrón de diseño: queda en el DOM con `open`
// alternando la clase para que la transición de salida se vea, en vez de
// desmontar el contenido de golpe.
export default function VSlideOver({ open, onClose, children }: Props) {
  const [cached, setCached] = useState<React.ReactNode>(null)

  useEffect(() => {
    if (open) setCached(children)
  }, [open, children])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      <div className={`scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`so${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        {cached}
      </aside>
    </>
  )
}
