import RegisterForm from '@/components/auth/RegisterForm'
import Logo from '@/components/ui/Logo'

export const metadata = { title: 'Crear cuenta — KLIA' }

export default function RegistroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-container-low to-secondary-fixed flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 shadow-lg">
          <div className="text-center mb-6">
            <Logo className="h-16 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Crear tu cuenta</h1>
            <p className="text-gray-500 text-sm mt-1">Accedé a 21 días de prueba gratuita con todas las funcionalidades del Plan Premium.</p>
            <p className="text-gray-400 text-xs mt-1">Sin compromiso. Sin tarjeta de crédito.</p>
          </div>
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
