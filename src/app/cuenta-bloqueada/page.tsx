import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import PlanesSection from './PlanesSection'
import LogoutButton from './LogoutButton'

type ModuloItem = {
  modulo_id: string
  nombre: string
  descripcion: string | null
  planes: string[]
}

export const metadata = { title: 'Acceso pausado — KLIA' }

export default async function CuentaBloqueadaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { data: ultimaSuscripcion }, { data: modulosData }, { data: planesData }] = await Promise.all([
    supabase.from('profiles')
      .select('plan, estado_cuenta, mp_preapproval_id, trial_fin, nombre, codigo_descuento_id')
      .eq('id', user.id)
      .single(),
    supabase.from('suscripciones')
      .select('estado, updated_at')
      .eq('terapeuta_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('modulos_config')
      .select('modulo_id, nombre, descripcion, planes')
      .eq('activo', true)
      .order('modulo_id'),
    supabase.from('planes')
      .select('slug, precio_mensual, precio_anual_mensual')
      .eq('activo', true)
      .not('slug', 'is', null),
  ])

  if (profile?.estado_cuenta !== 'bloqueada' && profile?.estado_cuenta !== 'cancelada') redirect('/dashboard')

  const motivoBloqueo = profile.estado_cuenta === 'cancelada'
    ? 'cancelada'
    : (!profile.mp_preapproval_id || !ultimaSuscripcion)
      ? 'trial_vencido'
      : 'pago_fallido'

  const nombre = profile?.nombre ?? ''

  // Código de descuento ya aplicado de antes (Ajustes, o una sesión previa de
  // este mismo flujo) — se hidrata acá para no depender de que el profesional
  // lo vuelva a aplicar en cada visita a esta pantalla.
  let codigoAplicadoInicial: number | null = null
  let colegioAplicadoNombre: string | null = null
  if (profile.codigo_descuento_id) {
    const { data: codigo } = await supabase
      .from('codigos_descuento')
      .select('porcentaje_descuento, colegio_id')
      .eq('id', profile.codigo_descuento_id)
      .single()
    if (codigo) {
      codigoAplicadoInicial = Number(codigo.porcentaje_descuento)
      const { data: colegio } = await supabase
        .from('colegios')
        .select('nombre')
        .eq('id', codigo.colegio_id)
        .single()
      colegioAplicadoNombre = colegio?.nombre ?? null
    }
  }

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#0B1220',
      background: '#FAFBFC',
      backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(79,70,229,0.04) 0%, transparent 35%), radial-gradient(circle at 90% 30%, rgba(135,206,235,0.05) 0%, transparent 30%)',
      fontSize: 14,
      lineHeight: 1.55,
      WebkitFontSmoothing: 'antialiased' as const,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
    }}>

      {/* Logo */}
      <div style={{ padding: '28px 24px 0', display: 'flex', justifyContent: 'center' }}>
        <Image src="/logo.svg" alt="KLIA" width={80} height={36} style={{ height: 36, width: 'auto' }} />
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: 1180, margin: '0 auto', padding: '40px 24px 60px' }}>

        {/* ======================== TRIAL VENCIDO ======================== */}
        {motivoBloqueo === 'trial_vencido' && (
          <>
            <div style={{ maxWidth: 640, margin: '0 auto 36px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 18px', borderRadius: 18,
                display: 'grid', placeItems: 'center', position: 'relative',
                background: 'linear-gradient(145deg, #FDEBE3 0%, #F8CFB8 100%)',
                color: '#B5503A',
                boxShadow: '0 8px 22px rgba(224,122,95,0.18), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}>
                <svg viewBox="0 0 24 24" width="30" height="30" stroke="currentColor" strokeWidth="1.7" fill="none">
                  <path d="M6 2h12M6 22h12"/>
                  <path d="M6 2v3a6 6 0 0 0 6 6 6 6 0 0 0 6-6V2"/>
                  <path d="M6 22v-3a6 6 0 0 1 6-6 6 6 0 0 1 6 6v3"/>
                  <path d="M9 8.5h6"/>
                </svg>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#5B6472', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E07A5F', display: 'inline-block' }} />
                Período de prueba finalizado
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 12px', lineHeight: 1.1 }}>
                Tu prueba gratuita ha concluido
              </h1>
              <p style={{ fontSize: 16, color: '#5B6472', margin: 0, lineHeight: 1.6 }}>
                {nombre && <><b style={{ color: '#1F2937', fontWeight: 600 }}>{nombre}</b>, </>}
                Gracias por explorar KLIA durante estos 21 días. Para seguir gestionando tu agenda, pacientes e historial clínico, elegí el plan que mejor se adapta a tu consultorio.
              </p>
            </div>

            <PlanesSection
              modulos={(modulosData ?? []) as ModuloItem[]}
              precios={(planesData ?? []).reduce((acc, p) => {
                if (p.slug) acc[p.slug] = { precio_mensual: Number(p.precio_mensual), precio_anual_mensual: p.precio_anual_mensual != null ? Number(p.precio_anual_mensual) : null }
                return acc
              }, {} as Record<string, { precio_mensual: number; precio_anual_mensual: number | null }>)}
              codigoAplicadoInicial={codigoAplicadoInicial}
              colegioAplicadoNombre={colegioAplicadoNombre}
            />

            <div style={{ maxWidth: 720, margin: '36px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' as const, gap: 24, padding: '18px 24px', borderTop: '1px dashed #E7E9EE', borderBottom: '1px dashed #E7E9EE' }}>
              {[
                { label: <><b style={{ color: '#1F2937', fontWeight: 600 }}>Datos cifrados</b> en Argentina</> },
                { label: <>Cumple <b style={{ color: '#1F2937', fontWeight: 600 }}>Ley 26.529</b> de derechos del paciente</> },
                { label: 'Cancelás cuando quieras' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#5B6472' }}>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ maxWidth: 720, margin: '28px auto 0', textAlign: 'center', fontSize: 13.5, color: '#5B6472' }}>
              ¿Tenés dudas?{' '}
              <a href="mailto:hola@klia.com.ar" style={{ color: '#1F2937', fontWeight: 600, textDecoration: 'none' }}>
                Hablá con nuestro equipo
              </a>
              <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: '#AEB5C0', verticalAlign: 'middle', margin: '0 10px' }} />
              <Link href="/planes" style={{ color: '#1F2937', fontWeight: 600, textDecoration: 'none' }}>
                Comparar planes en detalle
              </Link>
            </div>
          </>
        )}

        {/* ======================== SUSCRIPCIÓN CANCELADA ======================== */}
        {motivoBloqueo === 'cancelada' && (
          <>
            <div style={{ maxWidth: 640, margin: '0 auto 36px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 18px', borderRadius: 18,
                display: 'grid', placeItems: 'center', position: 'relative',
                background: 'linear-gradient(145deg, #E9EAFB 0%, #C7C9F5 100%)',
                color: '#4F46E5',
                boxShadow: '0 8px 22px rgba(79,70,229,0.16), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}>
                <svg viewBox="0 0 24 24" width="30" height="30" stroke="currentColor" strokeWidth="1.7" fill="none">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#5B6472', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5', display: 'inline-block' }} />
                Suscripción cancelada
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 12px', lineHeight: 1.1 }}>
                Tu suscripción fue cancelada
              </h1>
              <p style={{ fontSize: 16, color: '#5B6472', margin: 0, lineHeight: 1.6 }}>
                {nombre && <><b style={{ color: '#1F2937', fontWeight: 600 }}>{nombre}</b>, </>}
                podés reactivarla eligiendo un plan cuando quieras — tus datos, pacientes e historial clínico siguen guardados.
              </p>
            </div>

            <PlanesSection
              modulos={(modulosData ?? []) as ModuloItem[]}
              precios={(planesData ?? []).reduce((acc, p) => {
                if (p.slug) acc[p.slug] = { precio_mensual: Number(p.precio_mensual), precio_anual_mensual: p.precio_anual_mensual != null ? Number(p.precio_anual_mensual) : null }
                return acc
              }, {} as Record<string, { precio_mensual: number; precio_anual_mensual: number | null }>)}
              codigoAplicadoInicial={codigoAplicadoInicial}
              colegioAplicadoNombre={colegioAplicadoNombre}
            />

            <div style={{ maxWidth: 720, margin: '28px auto 0', textAlign: 'center', fontSize: 13.5, color: '#5B6472' }}>
              ¿Tenés dudas?{' '}
              <a href="mailto:hola@klia.com.ar" style={{ color: '#1F2937', fontWeight: 600, textDecoration: 'none' }}>
                Hablá con nuestro equipo
              </a>
              <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: '#AEB5C0', verticalAlign: 'middle', margin: '0 10px' }} />
              <Link href="/planes" style={{ color: '#1F2937', fontWeight: 600, textDecoration: 'none' }}>
                Comparar planes en detalle
              </Link>
            </div>
          </>
        )}

        {/* ======================== PAGO FALLIDO ======================== */}
        {motivoBloqueo === 'pago_fallido' && (
          <>
            <div style={{ maxWidth: 640, margin: '0 auto 36px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 18px', borderRadius: 18,
                display: 'grid', placeItems: 'center', position: 'relative',
                background: 'linear-gradient(145deg, #FCE1E4 0%, #F5B4BB 100%)',
                color: '#BE3144',
                boxShadow: '0 8px 22px rgba(190,49,68,0.16), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}>
                <svg viewBox="0 0 24 24" width="30" height="30" stroke="currentColor" strokeWidth="1.7" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="2.5"/>
                  <path d="M2 10h20"/>
                  <path d="M6 15h4"/>
                </svg>
                <span style={{
                  position: 'absolute', bottom: -4, right: -4,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#BE3144', color: 'white',
                  display: 'grid', placeItems: 'center',
                  border: '3px solid #FAFBFC',
                  fontSize: 12, fontWeight: 700, lineHeight: 1,
                }}>!</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#5B6472', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BE3144', display: 'inline-block' }} />
                Problema con tu método de pago
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 12px', lineHeight: 1.1 }}>
                No pudimos procesar tu último pago
              </h1>
              <p style={{ fontSize: 16, color: '#5B6472', margin: 0, lineHeight: 1.6 }}>
                Tu tarjeta puede haber vencido o no tener fondos suficientes.{' '}
                <b style={{ color: '#1F2937', fontWeight: 600 }}>Actualizá tu método de pago desde Mercado Pago para reactivar tu cuenta de inmediato.</b>
              </p>
            </div>

            <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #E7E9EE', borderRadius: 20, boxShadow: '0 2px 4px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)', padding: '28px 28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 18, background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: 12 }}>
                <div style={{ width: 40, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #1A237E, #4F46E5)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                    <path d="M2 7h20v4H2zM2 13h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z" fillRule="evenodd"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#1F2937', fontWeight: 600 }}>Método de pago</div>
                  <div style={{ fontSize: 12, color: '#5B6472', marginTop: 1 }}>Verificá y actualizá tu tarjeta en Mercado Pago</div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', background: '#FDECEE', color: '#BE3144', borderRadius: 100, whiteSpace: 'nowrap' as const }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                  Rechazada
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#AEB5C0', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                Reintentaremos el cobro en 48 hs si no actualizás
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                <a
                  href="https://www.mercadopago.com.ar/subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', color: 'white', textDecoration: 'none', boxShadow: '0 12px 28px rgba(79,70,229,.18)' }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" strokeWidth="2" fill="none"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>
                  Actualizar método de pago
                </a>
                <Link href="/planes" style={{ display: 'block', padding: '8px 12px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, color: '#5B6472', textDecoration: 'none', textAlign: 'center' }}>
                  Cambiar de plan
                </Link>
              </div>
            </div>

            <div style={{ maxWidth: 720, margin: '28px auto 0', textAlign: 'center', fontSize: 13.5, color: '#5B6472' }}>
              ¿No reconocés este cobro?{' '}
              <a href="mailto:hola@klia.com.ar" style={{ color: '#1F2937', fontWeight: 600, textDecoration: 'none' }}>
                Contactá a soporte
              </a>
            </div>
          </>
        )}

        <div style={{ maxWidth: 640, margin: '32px auto 0', textAlign: 'center' }}>
          <LogoutButton />
        </div>
      </main>

      <footer style={{ marginTop: 'auto', padding: '22px 24px 28px', textAlign: 'center', fontSize: 12, color: '#AEB5C0', lineHeight: 1.7 }}>
        <span style={{ display: 'block', marginBottom: 4 }}>© 2026 KLIA. Todos los derechos reservados.</span>
        <a href="/privacidad" style={{ color: '#8A93A1', textDecoration: 'none' }}>Política de Privacidad</a>
        <span style={{ color: '#AEB5C0', margin: '0 6px' }}>·</span>
        <a href="mailto:hola@klia.com.ar" style={{ color: '#8A93A1', textDecoration: 'none' }}>Soporte: hola@klia.com.ar</a>
      </footer>
    </div>
  )
}
