'use client'

import { useEffect, useState } from 'react'

// Compartido entre PortalShell (banner de "sin conexión") y RegistroSheet
// (bloquea abrir "Registrar comida" y deshabilita la edición de comentario
// mientras no hay señal) — un solo listener de online/offline en vez de
// duplicarlo en cada componente que lo necesita.
export function useOffline(): boolean {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return offline
}
