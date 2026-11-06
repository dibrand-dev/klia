import fs from 'fs'
import path from 'path'

// Lectura server-only del mismo catálogo que usa useCie10.ts en cliente
// (public/data/cie10.json, ~8.899 códigos) — cacheada a nivel de módulo:
// el archivo no cambia entre requests, así que una sola lectura/parseo por
// instancia de servidor alcanza.
let cie10MapCache: Map<string, string> | null = null

function cargarMapa(): Map<string, string> {
  if (!cie10MapCache) {
    const raw = fs.readFileSync(path.join(process.cwd(), 'public/data/cie10.json'), 'utf-8')
    const entries = JSON.parse(raw) as { codigo: string; descripcion: string }[]
    cie10MapCache = new Map(entries.map((e) => [e.codigo, e.descripcion]))
  }
  return cie10MapCache
}

export function descripcionCie10(codigo: string): string | null {
  return cargarMapa().get(codigo) ?? null
}
