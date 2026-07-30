import type { IMCStatus } from '@/lib/nutricion/calculos'

// Fórmula de Ehlers — corrige la PIO medida por tonometría según el espesor corneal central.
export function calcularPIOCorregida(pioMedida: number | null, paquimetria: number | null): number | null {
  if (pioMedida == null || paquimetria == null) return null
  return pioMedida - ((paquimetria - 545) / 25) * 2.5
}

export function clasificarPIO(pio: number): { label: string; status: IMCStatus } {
  if (pio < 10) return { label: 'Baja', status: 'info' }
  if (pio <= 21) return { label: 'Normal', status: 'success' }
  return { label: 'Elevada', status: 'warning' }
}
