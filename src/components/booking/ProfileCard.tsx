'use client'

import Image from 'next/image'
import type { ProfileData } from '@/app/p/[slug]/page'

interface Props {
  profile: ProfileData
}

function Initials({ nombre, apellido }: { nombre: string; apellido: string }) {
  const initials = `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
  return (
    <div style={{
      width: 80, height: 80, borderRadius: 40,
      background: 'linear-gradient(145deg, #E3E9F6, #C9D3E9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28, fontWeight: 700, color: '#16389F',
      boxShadow: '0 8px 20px rgba(16,24,40,0.08)',
    }}>
      {initials}
    </div>
  )
}

// .pro-card del diseño — extraído de StepTipoConsulta.tsx para poder
// mostrarlo también en el paso Sede (primer paso con 2+ sedes activas).
export default function ProfileCard({ profile }: Props) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #E7E9EE',
      padding: '26px 22px 22px',
      marginBottom: 18,
      boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
      textAlign: 'center',
    }}>
      {/* Avatar with verified badge */}
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 14px' }}>
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={`${profile.nombre} ${profile.apellido}`}
            width={80}
            height={80}
            style={{ width: 80, height: 80, borderRadius: 40, objectFit: 'cover', boxShadow: '0 8px 20px rgba(16,24,40,0.08)' }}
          />
        ) : (
          <Initials nombre={profile.nombre} apellido={profile.apellido} />
        )}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 24, height: 24, borderRadius: 12,
          background: '#2563EB', border: '3px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
      </div>

      <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.3px' }}>
        {profile.nombre} {profile.apellido}
      </h1>
      {profile.especialidad && (
        <p style={{ margin: '0 0 6px', fontSize: 14, color: '#5B6472', fontWeight: 500 }}>
          {profile.especialidad}
        </p>
      )}
      {profile.matricula && (
        <span style={{
          display: 'inline-block',
          fontSize: 11, fontWeight: 600, color: '#8A93A1',
          background: '#F1F3F6', borderRadius: 6, padding: '2px 8px',
          letterSpacing: '0.02em',
        }}>
          Mat. {profile.matricula}
        </span>
      )}
      {profile.booking_bio && (
        <p style={{ margin: '14px 0 0', fontSize: 14, color: '#374151', lineHeight: 1.65, textAlign: 'left' }}>
          {profile.booking_bio}
        </p>
      )}
    </div>
  )
}
