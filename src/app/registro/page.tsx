import RegisterForm from '@/components/auth/RegisterForm'

export const metadata = { title: 'Crear cuenta — KLIA' }

export default function RegistroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-container-low to-secondary-fixed flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Crear tu cuenta en KLIA</h1>
            <p className="text-gray-500 text-sm mt-1">Accedé a 21 días de prueba gratuita con todas las funcionalidades del Plan Premium.</p>
            <p className="text-gray-400 text-xs mt-1">Sin compromiso. Sin tarjeta de crédito.</p>
          </div>
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
