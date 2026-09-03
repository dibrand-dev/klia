export interface TurnoLayoutInput {
  id: string
  inicio: number // minutos desde medianoche
  duracion: number // minutos
}

export interface TurnoLayoutResult {
  columna: number
  totalColumnas: number
}

// Layout tipo Google Calendar: turnos que se solapan en el tiempo se reparten
// en columnas lado a lado en vez de pisarse. Turnos que no se cruzan con nadie
// quedan con totalColumnas: 1 (ancho completo, igual que antes).
export function calcularLayoutTurnos(turnos: TurnoLayoutInput[]): Map<string, TurnoLayoutResult> {
  const resultado = new Map<string, TurnoLayoutResult>()
  if (turnos.length === 0) return resultado

  const ordenados = [...turnos].sort((a, b) => a.inicio - b.inicio)

  // 1) Agrupar en clusters de turnos conectados por solapamiento transitivo
  //    (A se solapa con B, B con C → A, B y C van al mismo cluster aunque A y C no se toquen).
  const clusters: TurnoLayoutInput[][] = []
  let clusterActual: TurnoLayoutInput[] = []
  let finMaxCluster = -Infinity

  for (const t of ordenados) {
    if (clusterActual.length === 0 || t.inicio < finMaxCluster) {
      clusterActual.push(t)
      finMaxCluster = Math.max(finMaxCluster, t.inicio + t.duracion)
    } else {
      clusters.push(clusterActual)
      clusterActual = [t]
      finMaxCluster = t.inicio + t.duracion
    }
  }
  if (clusterActual.length > 0) clusters.push(clusterActual)

  // 2) Dentro de cada cluster, asignar columnas: cada turno toma la primera
  //    columna cuyo último turno ya terminó (greedy interval coloring — el
  //    número de columnas resultante es el mínimo necesario, igual al máximo
  //    de turnos simultáneos en ese cluster).
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      resultado.set(cluster[0].id, { columna: 0, totalColumnas: 1 })
      continue
    }

    const finPorColumna: number[] = []
    const asignados: { id: string; columna: number }[] = []

    for (const t of cluster) {
      let columna = finPorColumna.findIndex((fin) => fin <= t.inicio)
      if (columna === -1) {
        columna = finPorColumna.length
        finPorColumna.push(t.inicio + t.duracion)
      } else {
        finPorColumna[columna] = t.inicio + t.duracion
      }
      asignados.push({ id: t.id, columna })
    }

    const totalColumnas = finPorColumna.length
    for (const { id, columna } of asignados) {
      resultado.set(id, { columna, totalColumnas })
    }
  }

  return resultado
}
