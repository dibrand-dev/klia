'use client'

export default function CrearPrimeraNotaButton({ pacienteId }: { pacienteId: string }) {
  return (
    <button
      type="button"
      className="btn-primary inline-flex"
      onClick={() => window.dispatchEvent(new CustomEvent('openNuevaNotaClinica', { detail: { pacienteId } }))}
    >
      <span className="material-symbols-outlined text-sm">add</span>
      Crear primera nota
    </button>
  )
}
