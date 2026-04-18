import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ListaPacientes from '@/components/pacientes/ListaPacientes'

export const metadata = { title: 'Pacientes — ConsultorioApp' }

export default async function PacientesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('*')
    .eq('terapeuta_id', user.id)
    .order('apellido')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pacientes?.length ?? 0} paciente{(pacientes?.length ?? 0) !== 1 ? 's' : ''} registrado{(pacientes?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/pacientes/nuevo" className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo paciente
        </Link>
      </div>

      <ListaPacientes pacientes={pacientes ?? []} />
    </div>
  )
}
