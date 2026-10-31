'use client'

import SlideOver from '@/components/ui/SlideOver'

export default function CentroDeAyudaSlideOver({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
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
  )
}
