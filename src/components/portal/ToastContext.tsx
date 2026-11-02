'use client'

import { createContext, useContext, useRef, useState } from 'react'

const ToastContext = createContext<((msg: string) => void) | null>(null)

// Compartido entre PortalShell (toast de "Contraseña actualizada") y
// RegistroSheet (toasts de registrar/reemplazar/comentario/sin conexión) —
// un solo nodo .pp-toast en el DOM en vez de uno por componente que lo usa,
// para que dos toasts disparados cerca uno del otro no se superpongan.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  function toast(texto: string) {
    setMsg(texto)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2400)
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {msg && <div className="pp-toast show" role="status" aria-live="polite">{msg}</div>}
    </ToastContext.Provider>
  )
}

export function useToast(): (msg: string) => void {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast debe usarse dentro de ToastProvider')
  return toast
}
