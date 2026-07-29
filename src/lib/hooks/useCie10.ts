'use client'

import { useState, useCallback } from 'react'

export interface Cie10Entry {
  codigo: string
  descripcion: string
}

let cie10Cache: Cie10Entry[] | null = null
let cie10Promise: Promise<Cie10Entry[]> | null = null

async function fetchCie10(): Promise<Cie10Entry[]> {
  if (cie10Cache) return cie10Cache
  if (!cie10Promise) {
    cie10Promise = fetch('/data/cie10.json')
      .then(res => res.json())
      .then((data: Cie10Entry[]) => {
        cie10Cache = data
        return data
      })
      .catch((err) => {
        cie10Promise = null
        throw err
      })
  }
  return cie10Promise
}

export function useCie10() {
  const [cie10, setCie10] = useState<Cie10Entry[]>(cie10Cache ?? [])

  const cargarCie10 = useCallback(() => {
    if (cie10Cache) {
      if (cie10.length === 0) setCie10(cie10Cache)
      return
    }
    fetchCie10().then(setCie10).catch(() => {})
  }, [cie10.length])

  return { cie10, cargarCie10 }
}
