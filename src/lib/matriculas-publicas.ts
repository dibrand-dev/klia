// Helpers para mostrar matrículas en superficies públicas (tarjeta de
// reservas /p/[slug]) a partir de filas de profesional_matriculas. Puros,
// sin Supabase ni React, para poder testearlos aparte.

interface FilaMatricula {
  tipo: string | null
  numero: string
  habilitada: boolean | null
  verificada: boolean | null
}

export interface MatriculaParaMostrar {
  etiqueta: 'M.N.' | 'M.P.'
  numero: string
}

// Descarta filas deshabilitadas explícitamente (habilitada === false) o sin
// número. 'nacional' → M.N., cualquier otro tipo (incluido null/'provincial')
// → M.P. Orden: todas las M.N. primero, después las M.P. Sin duplicados por
// (etiqueta, numero).
export function matriculasParaMostrar(filas: FilaMatricula[]): MatriculaParaMostrar[] {
  const vistas = new Set<string>()
  const resultado: MatriculaParaMostrar[] = []

  for (const fila of filas) {
    if (fila.habilitada === false) continue
    if (!fila.numero) continue

    const etiqueta: 'M.N.' | 'M.P.' = fila.tipo === 'nacional' ? 'M.N.' : 'M.P.'
    const clave = `${etiqueta}|${fila.numero}`
    if (vistas.has(clave)) continue
    vistas.add(clave)

    resultado.push({ etiqueta, numero: fila.numero })
  }

  return resultado.sort((a, b) => {
    if (a.etiqueta === b.etiqueta) return 0
    return a.etiqueta === 'M.N.' ? -1 : 1
  })
}

// true si alguna fila está verificada Y habilitada (ambas condiciones).
export function tieneMatriculaVerificada(filas: FilaMatricula[]): boolean {
  return filas.some((fila) => fila.verificada === true && fila.habilitada === true)
}
