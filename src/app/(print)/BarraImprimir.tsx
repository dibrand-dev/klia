'use client'

import './barra-imprimir.css'

interface BarraImprimirProps {
  linkFicha: { href: string; label: string }
  leyenda?: string
}

// Barra de impresión única para las páginas de impresión (HC e informe ISAK) —
// mismo layout en las dos: link a la ficha a la izquierda, botón "Imprimir" +
// leyenda opcional a la derecha. Markup/clases heredadas de .hc-toolbar/.hc-btn
// (historial-print.css), que ya estaban bien resueltas.
export default function BarraImprimir({ linkFicha, leyenda }: BarraImprimirProps) {
  return (
    <div className="imp-toolbar">
      <a href={linkFicha.href}>
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth={1.8} fill="none" /></svg>
        {linkFicha.label}
      </a>
      <span className="imp-sp" />
      <button type="button" className="imp-btn" onClick={() => window.print()}>
        <svg viewBox="0 0 24 24"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
        Imprimir
      </button>
      {leyenda && <span className="imp-leyenda">{leyenda}</span>}
    </div>
  )
}
