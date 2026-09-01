import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NuevoTurnoPageForm from '@/components/agenda/NuevoTurnoPageForm'
import { Suspense } from 'react'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import type { Paciente, PacienteColaboradorRow } from '@/types/database'

export const metadata = { title: 'Nuevo turno — KLIA' }

export default async function NuevoTurnoPage() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  let pacientes: Paciente[] | null = null

  const [, { data: profileRaw }] = await Promise.all([
    (async () => {
      if (efectivo.esColaborador) {
        const { data: todosPacientesRaw } = await supabase.rpc('get_pacientes_colaborador')
        const todosPacientes = (todosPacientesRaw ?? []) as PacienteColaboradorRow[]
        pacientes = todosPacientes
          .filter((p) => p.activo)
          .sort((a, b) => a.apellido.localeCompare(b.apellido))
          .map((p) => ({
            ...p,
            notas: null,
            motivo_consulta: null,
            codigo_diagnostico: null,
            gravedad_estimada: null,
            fecha_inicio_tratamiento: null,
          })) as Paciente[]
      } else {
        const { data } = await supabase
          .from('pacientes')
          .select('*')
          .eq('terapeuta_id', efectivo.terapeutaId)
          .eq('activo', true)
          .order('apellido')
        pacientes = data
      }
    })(),
    supabase.from('profiles').select('mp_user_id, terminologia').eq('id', efectivo.terapeutaId).single(),
  ])
  const mpConectado = !!(profileRaw as Record<string, unknown> | null)?.mp_user_id
  const terminologia = (profileRaw as Record<string, unknown> | null)?.terminologia as 'sesion' | 'consulta' | undefined

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
            <NuevoTurnoPageForm pacientes={pacientes ?? []} terapeutaId={efectivo.terapeutaId} mpConectado={mpConectado} terminologia={terminologia} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
