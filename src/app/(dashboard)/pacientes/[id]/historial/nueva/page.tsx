import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import NuevaNotaHistorialForm from '@/components/pacientes/NuevaNotaHistorialForm'

export default async function NuevaNotaPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')
  if (efectivo.esColaborador) redirect(`/pacientes/${params.id}`)

  return <NuevaNotaHistorialForm pacienteId={params.id} />
}
