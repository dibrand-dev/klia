'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { IconCheck } from './icons'

const ToastContext = createContext<(msg: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const toast = useCallback((m: string) => {
    setMsg(m)
    setOn(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), 2200)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div id="v-toast" className={on ? 'on' : ''} role="status" aria-live="polite">
        {msg && <><IconCheck width={14} height={14} stroke="#7EE2B8" strokeWidth={2.2} fill="none" />{msg}</>}
      </div>
    </ToastContext.Provider>
  )
}

export function copiarAlPortapapeles(texto: string, toast: (m: string) => void, mensaje: string) {
  navigator.clipboard?.writeText(texto).catch(() => {})
  toast(mensaje)
}
