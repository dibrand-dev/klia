'use client'

import { useCallback, useRef, useState } from 'react'

export interface AlimentoVademecum {
  id: string
  fuente: string
  nombre: string
  grupo: string
  kcalPor100g: number | null
  proteinasPor100g: number | null
  grasasPor100g: number | null
  carbohidratosPor100g: number | null
}

// Mismo patrón que useCie10.ts: caché a nivel de módulo por término de
// búsqueda (no useState), para que no se repita el fetch de la misma
// consulta dentro de la misma sesión — pero la búsqueda en sí es server-side
// (471 alimentos, no pesado mandar cada término al backend).
const cache = new Map<string, AlimentoVademecum[]>()
let pendientes = new Map<string, Promise<AlimentoVademecum[]>>()
const cachePorId = new Map<string, AlimentoVademecum>()

async function fetchAlimentos(q: string): Promise<AlimentoVademecum[]> {
  const key = q.trim().toLowerCase()
  if (cache.has(key)) return cache.get(key)!
  if (pendientes.has(key)) return pendientes.get(key)!

  const promise = fetch(`/api/vademecum/alimentos?q=${encodeURIComponent(key)}`)
    .then((res) => res.json())
    .then((data) => {
      const alimentos: AlimentoVademecum[] = data.alimentos ?? []
      cache.set(key, alimentos)
      for (const a of alimentos) cachePorId.set(String(a.id), a)
      return alimentos
    })
    .catch((err) => {
      pendientes.delete(key)
      throw err
    })

  pendientes.set(key, promise)
  return promise
}

// Lookup batch para reconstruir el preview de macros de ítems ya guardados
// (el item solo persiste alimento_id, no sus valores por 100g).
export async function buscarAlimentosPorIds(ids: string[]): Promise<Map<string, AlimentoVademecum>> {
  const faltantes = ids.filter((id) => !cachePorId.has(id))
  if (faltantes.length > 0) {
    const res = await fetch(`/api/vademecum/alimentos?ids=${faltantes.join(',')}`)
    const data = await res.json()
    for (const a of (data.alimentos ?? []) as AlimentoVademecum[]) {
      cachePorId.set(String(a.id), a)
    }
  }
  const resultado = new Map<string, AlimentoVademecum>()
  for (const id of ids) {
    const a = cachePorId.get(id)
    if (a) resultado.set(id, a)
  }
  return resultado
}

export function useVademecumAlimentos() {
  const [resultados, setResultados] = useState<AlimentoVademecum[]>([])
  const [buscando, setBuscando] = useState(false)
  const ultimaConsulta = useRef('')

  const buscar = useCallback((q: string) => {
    ultimaConsulta.current = q
    setBuscando(true)
    fetchAlimentos(q)
      .then((alimentos) => {
        if (ultimaConsulta.current === q) {
          setResultados(alimentos)
          setBuscando(false)
        }
      })
      .catch(() => {
        if (ultimaConsulta.current === q) setBuscando(false)
      })
  }, [])

  return { resultados, buscando, buscar }
}
