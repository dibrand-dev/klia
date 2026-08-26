import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NuevoPacienteForm from '@/components/pacientes/NuevoPacienteForm'
import { OBRAS_SOCIALES } from '@/lib/obras-sociales'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const metadata = { title: 'Alta de Paciente — KLIA' }

export default async function NuevoPacientePage() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const { data: profOSData } = await supabase
    .from('profesional_obras_sociales')
    .select('*')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .eq('activa', true)
    .order('nombre')

  const profObrasSociales = profOSData ?? []

  // Lista maestra estática + nombres de OS del profesional que no estén ya incluidas
  const profNombres = profObrasSociales.map((o) => o.nombre)
  const obrasSociales = Array.from(new Set([...OBRAS_SOCIALES, ...profNombres])).sort()

  return <NuevoPacienteForm terapeutaId={efectivo.terapeutaId} obrasSociales={obrasSociales} profObrasSociales={profObrasSociales} esColaborador={efectivo.esColaborador} />
}
