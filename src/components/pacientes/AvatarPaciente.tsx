'use client'

import { useState } from 'react'
import './foto-paciente.css'

interface Props {
  pacienteId: string
  avatarPath: string | null
  avatarUpdatedAt: string | null
  iniciales: string
  alt?: string
  className: string
  style?: React.CSSProperties
}

// Avatar con foto reutilizable (Atenciones del día + resumen IA) — mismo
// patrón que ListaPacientes.tsx: si hay avatar_path y no falló la carga,
// foto vía /api/pacientes/[id]/foto (nunca URL de Blob directa); si no,
// el círculo de iniciales de siempre, sin tocar tamaño/color/radio — eso
// lo define el `className`/`style` que pasa cada call site.
export default function AvatarPaciente({ pacienteId, avatarPath, avatarUpdatedAt, iniciales, alt, className, style }: Props) {
  const [fotoError, setFotoError] = useState(false)
  const conFoto = !!avatarPath && !fotoError

  return (
    <div className={conFoto ? `${className} pav has-img` : className} style={conFoto ? undefined : style}>
      {conFoto ? (
        <img
          src={`/api/pacientes/${pacienteId}/foto?v=${new Date(avatarUpdatedAt ?? 0).getTime()}`}
          alt={alt ?? ''}
          loading="lazy"
          decoding="async"
          onError={() => setFotoError(true)}
        />
      ) : iniciales}
    </div>
  )
}
