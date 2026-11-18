'use client'

export default function BotonImprimir() {
  return (
    <button type="button" className="ap-pdf-btn" title="Imprimir o guardar como PDF" onClick={() => window.print()}>
      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" /></svg>
      <span>Imprimir<span className="lg"> / Guardar PDF</span></span>
    </button>
  )
}
