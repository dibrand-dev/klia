import LoginForm from '@/components/auth/LoginForm'
import Logo from '@/components/ui/Logo'

export const metadata = { title: 'Iniciar sesión — KLIA' }

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-container-low to-secondary-fixed flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 shadow-lg">
          <div className="text-center mb-8">
            <Logo className="h-16 w-auto mx-auto mb-4" />
            <p className="text-gray-500 text-sm mt-1">Gestión de turnos y pacientes</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
