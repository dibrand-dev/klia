import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import PrivacidadContent from '@/components/layout/PrivacidadContent'

export const metadata = {
  title: 'Política de Privacidad — KLIA',
  description: 'Política de privacidad y tratamiento de datos personales de KLIA',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <Link href="/" className="w-fit">
          <Logo className="h-7 w-auto" />
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <PrivacidadContent />
      </div>

      <div className="border-t border-gray-200 px-6 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} KLIA. Todos los derechos reservados.
      </div>
    </div>
  )
}
