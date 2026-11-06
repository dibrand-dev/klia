// Extraído de ModuloClinicaMedica.tsx (vivía como función privada dentro del
// componente) para poder reutilizarlo también en la exportación impresa de
// la historia clínica (KL1-T40) sin duplicar la fórmula.
export function clasificarTA(sistolica: number, diastolica: number): string {
  if (sistolica >= 140 || diastolica >= 90) return 'HTA estadio 2'
  if (sistolica >= 130 || diastolica >= 80) return 'HTA estadio 1'
  if (sistolica >= 120) return 'Elevada'
  return 'Normal'
}
