'use client'

import { useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'

export default function CentroDeAyudaButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-slate-400 hover:text-primary-container transition-colors duration-200 cursor-pointer active:scale-[0.98] uppercase text-[11px] tracking-[0.05em]"
      >
        Centro de Ayuda
      </button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Centro de Ayuda"
        subtitle="¿En qué podemos ayudarte?"
        width="lg"
        noPadding
      >
        <iframe
          src="https://desk.zoho.com/support/fbw?formType=AdvancedWebForm&fbwId=edbsnbab4a164fb8b928d0a3bbfb3f60fc2407428fb81c122abbb5cc8b39a80ef1389&xnQsjsdp=edbsnfb1d2695f49f571fbaf9a04c3c29990d&mode=showNewWidget&displayType=iframe"
          title="Centro de Ayuda"
          style={{ width: '100%', minHeight: '570px', border: 'none', display: 'block' }}
          allowTransparency
        />
      </SlideOver>
    </>
  )
}
