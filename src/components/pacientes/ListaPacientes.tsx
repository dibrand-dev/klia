'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatNombreCompleto } from '@/lib/utils'
import type { Paciente } from '@/types/database'

interface ListaPacientesProps {
  pacientes: Paciente[]
}

export default function ListaPacientes({ pacientes }: ListaPacientesProps) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = pacientes.filter((p) => {
    const texto = `${p.nombre} ${p.apellido} ${p.dni ?? ''} ${p.obra_social ?? ''}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  return (
    <div>
      {/* Buscador */}
      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por nombre, DNI u obra social..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="font-medium">
            {busqueda ? 'No se encontraron pacientes' : 'Todavía no tenés pacientes cargados'}
          </p>
          {!busqueda && (
            <Link href="/pacientes/nuevo" className="btn-primary inline-block mt-4">
              Agregar primer paciente
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((paciente) => (
            <PacienteCard key={paciente.id} paciente={paciente} />
          ))}
        </div>
      )}
    </div>
  )
}

function PacienteCard({ paciente }: { paciente: Paciente }) {
  const iniciales = `${paciente.nombre[0] ?? ''}${paciente.apellido[0] ?? ''}`.toUpperCase()

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-primary-700">{iniciales}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {formatNombreCompleto(paciente.nombre, paciente.apellido)}
          </p>
          {paciente.dni && (
            <p className="text-xs text-gray-500 mt-0.5">DNI {paciente.dni}</p>
          )}
          {paciente.obra_social && (
            <span className="inline-block mt-1.5 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {paciente.obra_social}
            </span>
          )}
        </div>
      </div>
      {(paciente.telefono || paciente.email) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {paciente.telefono && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {paciente.telefono}
            </div>
          )}
          {paciente.email && (
            <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{paciente.email}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
