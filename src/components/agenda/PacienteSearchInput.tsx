'use client'

import { useState, useRef, useEffect } from 'react'
import { cn, formatNombreCompleto } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type PacienteOpcion = { id: string; nombre: string; apellido: string }

interface PacienteSearchInputProps {
  terapeutaId: string
  value: string
  onChange: (id: string) => void
  className?: string
}

const MIN_CHARS = 2
const DEBOUNCE_MS = 250

// Caracteres que rompen o desvirtúan el patrón ilike/.or() de postgrest-js si
// el usuario los tipea (separador de .or(), paréntesis de grupo, wildcards).
function sanitizarToken(t: string): string {
  return t.replace(/[,()%*]/g, '')
}

async function buscarPacientes(texto: string, terapeutaId: string): Promise<PacienteOpcion[]> {
  const supabase = createClient()
  let query = supabase
    .from('pacientes')
    .select('id, nombre, apellido')
    .eq('terapeuta_id', terapeutaId)
    .eq('activo', true)

  for (const token of texto.split(/\s+/).map(sanitizarToken).filter(Boolean)) {
    query = query.or(`nombre.ilike.%${token}%,apellido.ilike.%${token}%`)
  }

  const { data } = await query.order('apellido').limit(20)
  return data ?? []
}

export default function PacienteSearchInput({ terapeutaId, value, onChange, className }: PacienteSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PacienteOpcion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // Id del paciente cuyo nombre ya está reflejado en `query` — evita refetchear
  // por id apenas el propio select() de abajo dispara el onChange con ese mismo id.
  const idMostradoRef = useRef<string | null>(null)

  // Preselección (pacienteIdInicial llega como `value` desde afuera) — resuelve
  // el nombre a mostrar pidiéndolo por id, sin depender de una lista precargada.
  useEffect(() => {
    if (!value || value === idMostradoRef.current) return
    let cancelado = false
    createClient()
      .from('pacientes')
      .select('nombre, apellido')
      .eq('id', value)
      .eq('terapeuta_id', terapeutaId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado || !data) return
        idMostradoRef.current = value
        setQuery(formatNombreCompleto(data.nombre, data.apellido))
      })
    return () => { cancelado = true }
  }, [value, terapeutaId])

  useEffect(() => {
    const texto = query.trim()
    if (texto.length < MIN_CHARS) {
      setResults([])
      setBuscando(false)
      setBuscado(false)
      return
    }

    let cancelado = false
    setBuscando(true)
    setBuscado(false)
    const timer = setTimeout(async () => {
      const encontrados = await buscarPacientes(texto, terapeutaId)
      if (cancelado) return
      setResults(encontrados)
      setBuscando(false)
      setBuscado(true)
      setHighlighted(0)
    }, DEBOUNCE_MS)

    return () => { cancelado = true; clearTimeout(timer) }
  }, [query, terapeutaId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        if (!value) setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  function select(p: PacienteOpcion) {
    idMostradoRef.current = p.id
    onChange(p.id)
    setQuery(formatNombreCompleto(p.nombre, p.apellido))
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); return }
      return
    }
    if (e.key === 'ArrowDown') { setHighlighted((h) => Math.min(h + 1, results.length - 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setHighlighted((h) => Math.max(h - 1, 0)); e.preventDefault() }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[highlighted]) select(results[highlighted]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          idMostradoRef.current = null
          setQuery(e.target.value)
          onChange('')
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar paciente..."
        autoComplete="off"
        className={className}
      />
      {open && buscando && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5 text-sm text-gray-400">
          Buscando...
        </div>
      )}
      {open && !buscando && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 hover:bg-primary-50',
                i === highlighted && 'bg-primary-50'
              )}
              onMouseDown={(e) => { e.preventDefault(); select(p) }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="font-medium text-gray-900 truncate">
                {formatNombreCompleto(p.nombre, p.apellido)}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && !buscando && buscado && results.length === 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5 text-sm text-gray-400">
          No se encontraron pacientes
        </div>
      )}
    </div>
  )
}
