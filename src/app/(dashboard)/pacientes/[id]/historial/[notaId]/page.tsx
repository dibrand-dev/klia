import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NotaDetalleEditor from '@/components/pacientes/NotaDetalleEditor'

export const metadata = { title: 'Nota de sesión — ConsultorioApp' }

export default async function NotaDetallePage({ params }: { params: { id: string; notaId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: nota } = await supabase
    .from('notas_clinicas')
    .select('*')
    .eq('id', params.notaId)
    .eq('terapeuta_id', user.id)
    .single()

  if (!nota) notFound()

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href={`/pacientes/${params.id}/historial`}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nota de sesión</h1>
          <p className="text-sm text-gray-500">← Volver al historial</p>
        </div>
      </div>

      <NotaDetalleEditor nota={nota} pacienteId={params.id} />
    </div>
  )
}
