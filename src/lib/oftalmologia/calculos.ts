import type { IMCStatus } from '@/lib/nutricion/calculos'

// Corrección lineal de Ehlers por espesor corneal central (CCT): 0,71 mmHg cada
// 10 µm respecto de 545 µm. Estimación orientativa; no reemplaza la lectura de Goldmann.
export function calcularPIOCorregida(pioMedida: number | null, paquimetria: number | null): number | null {
  if (pioMedida == null || paquimetria == null) return null
  return pioMedida + (545 - paquimetria) * 0.071
}

export function clasificarPIO(pio: number): { label: string; status: IMCStatus } {
  if (pio < 10) return { label: 'Baja', status: 'info' }
  if (pio <= 21) return { label: 'Normal', status: 'success' }
  return { label: 'Elevada', status: 'warning' }
}
