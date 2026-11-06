// Extraídas de ModuloPsicologia.tsx (vivían privadas dentro del componente)
// para poder reutilizarlas también en la exportación impresa de la historia
// clínica (KL1-T40) sin duplicar la fórmula.
export function severidadPHQ9(x: number): string {
  return x < 5 ? 'Mínima' : x < 10 ? 'Leve' : x < 15 ? 'Moderada' : x < 20 ? 'Moderadamente severa' : 'Severa'
}

export function severidadGAD7(x: number): string {
  return x < 5 ? 'Mínima' : x < 10 ? 'Leve' : x < 15 ? 'Moderada' : 'Severa'
}
