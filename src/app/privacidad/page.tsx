import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export const metadata = {
  title: 'Política de Privacidad — KLIA',
  description: 'Política de privacidad y tratamiento de datos personales de KLIA',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <Link href="/" className="w-fit">
          <Logo className="h-7 w-auto" />
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 prose prose-gray">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: abril de 2026</p>

        <Section title="1. Introducción">
          <p>
            KLIA (&quot;nosotros&quot;, &quot;nuestra plataforma&quot;) es un sistema de gestión de consultorios para
            profesionales de la salud, desarrollado y operado en la República Argentina. Esta
            Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos
            la información personal de nuestros usuarios, en cumplimiento de la{' '}
            <strong>Ley 25.326 de Protección de Datos Personales</strong> de la República Argentina
            y demás normativa aplicable.
          </p>
          <p>
            Al utilizar KLIA, aceptás los términos de esta política. Si tenés preguntas, podés
            contactarnos en{' '}
            <a href="mailto:hola@klia.com.ar" className="text-primary">hola@klia.com.ar</a>.
          </p>
        </Section>

        <Section title="2. Información que recopilamos">
          <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.1 Datos del profesional (usuario de KLIA)</h3>
          <ul>
            <li>Nombre, apellido y dirección de correo electrónico</li>
            <li>Especialidad profesional y matrícula (opcional)</li>
            <li>Teléfono de contacto (opcional)</li>
            <li>Información de facturación y suscripción (procesada por Mercado Pago)</li>
          </ul>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.2 Datos de pacientes ingresados por el profesional</h3>
          <p>
            Los profesionales pueden cargar información clínica de sus pacientes en KLIA.
            Esta información es ingresada y controlada exclusivamente por el profesional y puede incluir:
          </p>
          <ul>
            <li>Datos de identificación: nombre, apellido, DNI, fecha de nacimiento</li>
            <li>Datos de contacto: teléfono, email, domicilio</li>
            <li>Información de obra social y cobertura médica</li>
            <li>Historial clínico, notas de sesión y objetivos terapéuticos</li>
            <li>Datos de facturación relacionados con las sesiones</li>
          </ul>
          <p>
            KLIA actúa como <strong>encargado del tratamiento</strong> de estos datos —
            el profesional es el responsable del tratamiento ante sus pacientes.
          </p>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">2.3 Datos de uso</h3>
          <ul>
            <li>Registros de acceso e interacciones con la plataforma</li>
            <li>Dirección IP y tipo de dispositivo/navegador</li>
            <li>Datos de sesión necesarios para el funcionamiento del servicio</li>
          </ul>
        </Section>

        <Section title="3. Integración con Google Calendar">
          <p>
            KLIA ofrece la posibilidad de conectar tu cuenta de Google Calendar de forma opcional.
            Esta integración permite:
          </p>
          <ul>
            <li>Sincronizar los turnos creados en KLIA con tu Google Calendar</li>
            <li>
              Visualizar en la agenda de KLIA los eventos ya existentes en tu Google Calendar,
              para evitar solapamientos
            </li>
          </ul>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">Qué accedemos de tu Google Calendar</h3>
          <p>
            Cuando conectás tu Google Calendar, KLIA solicita acceso a los siguientes scopes:
          </p>
          <ul>
            <li>
              <code>https://www.googleapis.com/auth/calendar.events</code> — para crear y eliminar
              eventos de sesiones en tu calendario
            </li>
            <li>
              <code>https://www.googleapis.com/auth/calendar</code> — para leer los eventos
              existentes y mostrar horarios ocupados en tu agenda
            </li>
          </ul>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">Cómo usamos los datos de Google Calendar</h3>
          <ul>
            <li>
              <strong>Solo leemos</strong> el título, horario de inicio y fin de tus eventos
              existentes para mostrarlos como bloques en tu agenda
            </li>
            <li>
              <strong>Solo creamos</strong> eventos con el nombre del paciente, fecha y duración
              de cada sesión registrada en KLIA
            </li>
            <li>No compartimos datos de tu Google Calendar con terceros</li>
            <li>No usamos los datos de Google Calendar para publicidad ni análisis</li>
            <li>No almacenamos el contenido de tus eventos de Google Calendar en nuestra base de datos</li>
          </ul>

          <h3 className="font-semibold text-gray-800 mt-4 mb-2">Tokens de acceso</h3>
          <p>
            Los tokens de acceso y actualización de Google se almacenan de forma encriptada en
            nuestra base de datos. Podés revocar el acceso en cualquier momento desde
            <strong> Ajustes → Integraciones → Desconectar</strong>, o directamente desde{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary">
              Permisos de tu cuenta de Google
            </a>.
          </p>
          <p>
            El uso de KLIA de la información recibida de las APIs de Google se adhiere a la{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary">
              Política de datos de usuario de los servicios de API de Google
            </a>
            , incluidos los requisitos de uso limitado.
          </p>
        </Section>

        <Section title="4. Cómo usamos la información">
          <ul>
            <li>Proveer y mantener el servicio de gestión de consultorios</li>
            <li>Procesar pagos y gestionar suscripciones</li>
            <li>Enviar notificaciones relacionadas con el servicio</li>
            <li>Mejorar y desarrollar nuevas funcionalidades</li>
            <li>Cumplir con obligaciones legales</li>
          </ul>
          <p>
            <strong>No vendemos, alquilamos ni compartimos</strong> datos personales con terceros
            para fines comerciales o publicitarios.
          </p>
        </Section>

        <Section title="5. Almacenamiento y seguridad">
          <p>
            Los datos se almacenan en servidores seguros provistos por{' '}
            <strong>Supabase</strong> (PostgreSQL con cifrado en reposo y en tránsito mediante TLS).
            Implementamos las siguientes medidas de seguridad:
          </p>
          <ul>
            <li>Cifrado de datos en tránsito (HTTPS/TLS)</li>
            <li>Control de acceso mediante Row Level Security (RLS) — cada profesional solo
            accede a sus propios datos</li>
            <li>Autenticación segura con tokens JWT</li>
            <li>Acceso restringido a la base de datos mediante roles y permisos</li>
          </ul>
        </Section>

        <Section title="6. Compartir datos con terceros">
          <p>KLIA utiliza los siguientes proveedores de servicios que pueden procesar datos:</p>
          <ul>
            <li><strong>Supabase</strong> — base de datos y autenticación</li>
            <li><strong>Vercel</strong> — infraestructura de hosting</li>
            <li><strong>Mercado Pago</strong> — procesamiento de pagos</li>
            <li><strong>Google LLC</strong> — integración opcional con Google Calendar</li>
          </ul>
          <p>
            Todos estos proveedores cuentan con sus propias políticas de privacidad y son
            seleccionados por cumplir estándares adecuados de seguridad y protección de datos.
          </p>
        </Section>

        <Section title="7. Retención de datos">
          <p>
            Conservamos los datos mientras la cuenta del profesional esté activa. Al solicitar
            la eliminación de la cuenta, los datos se eliminan en un plazo máximo de 30 días,
            excepto aquellos que debamos conservar por obligaciones legales o contables.
          </p>
        </Section>

        <Section title="8. Derechos del usuario">
          <p>
            En cumplimiento de la Ley 25.326, los usuarios tienen derecho a:
          </p>
          <ul>
            <li><strong>Acceso</strong> — solicitar copia de sus datos personales</li>
            <li><strong>Rectificación</strong> — corregir datos inexactos o incompletos</li>
            <li><strong>Supresión</strong> — solicitar la eliminación de sus datos (&quot;derecho al olvido&quot;)</li>
            <li><strong>Oposición</strong> — oponerse al tratamiento de sus datos</li>
          </ul>
          <p>
            Para ejercer estos derechos, escribinos a{' '}
            <a href="mailto:hola@klia.com.ar" className="text-primary">hola@klia.com.ar</a>.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            KLIA utiliza cookies estrictamente necesarias para el funcionamiento de la sesión
            de usuario. No utilizamos cookies de seguimiento ni publicitarias.
          </p>
        </Section>

        <Section title="10. Cambios a esta política">
          <p>
            Podemos actualizar esta política ocasionalmente. Notificaremos cambios significativos
            por email o mediante un aviso destacado en la plataforma. La fecha de última
            actualización se indica al inicio del documento.
          </p>
        </Section>

        <Section title="11. Contacto">
          <p>
            Para consultas sobre esta política o el tratamiento de tus datos:
          </p>
          <ul>
            <li>Email: <a href="mailto:hola@klia.com.ar" className="text-primary">hola@klia.com.ar</a></li>
            <li>Sitio web: <a href="https://klia.com.ar" className="text-primary">klia.com.ar</a></li>
          </ul>
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} KLIA. Todos los derechos reservados.
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">{title}</h2>
      <div className="text-gray-700 text-sm leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs">
        {children}
      </div>
    </section>
  )
}
