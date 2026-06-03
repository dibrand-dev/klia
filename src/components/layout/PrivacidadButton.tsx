'use client'

import { useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import PrivacidadContent from './PrivacidadContent'

export default function PrivacidadButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-slate-400 hover:text-primary-container transition-colors duration-200 cursor-pointer active:scale-[0.98] uppercase text-[11px] tracking-[0.05em]"
      >
        Privacidad y Términos
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Política de Privacidad"
        subtitle="Última actualización: abril de 2026"
        width="lg"
      >
        <PrivacidadContent />
      </SlideOver>
    </>
  )
}
