import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NuevoTurnoPageForm from '@/components/agenda/NuevoTurnoPageForm'
import { Suspense } from 'react'

export const metadata = { title: 'Nuevo turno — KLIA' }

export default async function NuevoTurnoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('*')
    .eq('terapeuta_id', user.id)
    .eq('activo', true)
    .order('apellido')

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/agenda" className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Nuevo turno</h1>
            <p className="text-sm text-gray-500">Completá los datos del turno</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <Suspense>
            <NuevoTurnoPageForm pacientes={pacientes ?? []} terapeutaId={user.id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
