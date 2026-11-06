'use client'

export default function ImprimirButton() {
  return (
    <button type="button" className="hc-btn" onClick={() => window.print()}>
      <svg viewBox="0 0 24 24"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
      Imprimir
    </button>
  )
}
