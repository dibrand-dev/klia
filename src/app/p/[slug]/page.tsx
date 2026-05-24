import { createClient } from '@supabase/supabase-js'
import BookingClient from '@/components/booking/BookingClient'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

export type ProfileData = {
  id: string
  nombre: string
  apellido: string
  especialidad: string | null
  matricula: string | null
  avatar_url: string | null
  booking_slug: string
  booking_bio: string | null
  booking_duracion_sesion: number
  booking_duracion_entrevista: number
  booking_tiempo_entre: number
  booking_anticipacion_minutos: number
  booking_modalidades: string[]
  booking_precio_sesion: number | null
  booking_precio_entrevista: number | null
  booking_moneda: string
  booking_requiere_pago: boolean
  mp_conectado: boolean
}

async function getProfile(slug: string): Promise<ProfileData | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Test query: verify service role can see profiles
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
  console.log('🔵 BOOKING: total profiles visible:', count)

  // Debug query: check slug match and booking_activo
  const { data: debugData, error: debugError } = await supabase
    .from('profiles')
    .select('id, nombre, booking_slug, booking_activo')
    .eq('booking_slug', slug)
    .single()
  console.log('🔵 BOOKING: data:', JSON.stringify(debugData))
  console.log('🔵 BOOKING: error:', JSON.stringify(debugError))
  console.log('🔵 BOOKING: booking_activo value:', debugData?.booking_activo)
  console.log('🔵 BOOKING: typeof booking_activo:', typeof debugData?.booking_activo)

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, nombre, apellido, especialidad, matricula, avatar_url,
      booking_slug, booking_bio, booking_activo,
      booking_duracion_sesion, booking_duracion_entrevista,
      booking_tiempo_entre, booking_anticipacion_minutos,
      booking_modalidades, booking_precio_sesion, booking_precio_entrevista,
      booking_moneda, booking_requiere_pago,
      mp_access_token, mp_public_key
    `)
    .eq('booking_slug', slug)
    .single()

  console.log('🔵 BOOKING full query data:', JSON.stringify(data))
  console.log('🔵 BOOKING full query error:', JSON.stringify(error))

  if (error || !data) return null
  if (!data.booking_activo) return null

  return {
    id: data.id,
    nombre: data.nombre ?? '',
    apellido: data.apellido ?? '',
    especialidad: data.especialidad ?? null,
    matricula: data.matricula ?? null,
    avatar_url: data.avatar_url ?? null,
    booking_slug: data.booking_slug ?? slug,
    booking_bio: data.booking_bio ?? null,
    booking_duracion_sesion: data.booking_duracion_sesion ?? 50,
    booking_duracion_entrevista: data.booking_duracion_entrevista ?? 30,
    booking_tiempo_entre: data.booking_tiempo_entre ?? 10,
    booking_anticipacion_minutos: data.booking_anticipacion_minutos ?? 60,
    booking_modalidades: data.booking_modalidades ?? ['presencial'],
    booking_precio_sesion: data.booking_precio_sesion ?? null,
    booking_precio_entrevista: data.booking_precio_entrevista ?? null,
    booking_moneda: data.booking_moneda ?? 'ARS',
    booking_requiere_pago: data.booking_requiere_pago ?? true,
    mp_conectado: !!(data.mp_access_token),
  }
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  console.log('🔵 BOOKING: slug recibido:', slug)
  const profile = await getProfile(slug)
  console.log('🔵 BOOKING: profile encontrado:', profile ? 'sí' : 'no')

  if (!profile) {
    return (
      <html lang="es-AR">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Perfil no disponible — KLIA</title>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            *, *::before, *::after { box-sizing: border-box; }
            body { margin: 0; background: #FAFBFC; font-family: Inter, system-ui, sans-serif; }
          `}</style>
        </head>
        <body>
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 20px',
            background: '#FAFBFC',
          }}>
            <Image src="/logo.svg" alt="KLIA" width={90} height={30} priority />
            <div style={{
              marginTop: 48,
              background: '#fff',
              borderRadius: 20,
              border: '1px solid #E7E9EE',
              padding: '48px 40px',
              textAlign: 'center',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 1px 4px rgba(0,26,72,0.05), 0 8px 32px rgba(0,26,72,0.06)',
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 36,
                background: '#F1F3F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: 32,
              }}>🔒</div>
              <h1 style={{
                margin: '0 0 12px', fontSize: 22, fontWeight: 700,
                color: '#0B1220', letterSpacing: '-0.3px',
              }}>
                Perfil no disponible
              </h1>
              <p style={{
                margin: 0, fontSize: 15, color: '#5B6472', lineHeight: 1.6,
              }}>
                Este link de reserva no está activo en este momento. Por favor contactá directamente al profesional.
              </p>
            </div>
            <p style={{ marginTop: 32, fontSize: 13, color: '#AEB5C0' }}>
              Powered by <strong style={{ color: '#001a48' }}>KLIA</strong>
            </p>
          </div>
        </body>
      </html>
    )
  }

  return <BookingClient profile={profile} />
}
