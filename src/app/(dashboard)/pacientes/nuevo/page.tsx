import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NuevoPacienteForm from '@/components/pacientes/NuevoPacienteForm'
import { OBRAS_SOCIALES, combinarObrasSociales } from '@/lib/obras-sociales'
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

  const { data: osValidadasData } = await supabase
    .from('obras_sociales')
    .select('nombre')
    .eq('validada', true)

  // Lista maestra estática + nombres de OS del profesional + validadas en OPS,
  // sin duplicados (sin mayúsculas/tildes) y ordenada alfabéticamente.
  const profNombres = profObrasSociales.map((o) => o.nombre)
  const osValidadasNombres = (osValidadasData ?? []).map((o) => o.nombre)
  const obrasSociales = combinarObrasSociales(OBRAS_SOCIALES, profNombres, osValidadasNombres)

  return <NuevoPacienteForm terapeutaId={efectivo.terapeutaId} obrasSociales={obrasSociales} profObrasSociales={profObrasSociales} esColaborador={efectivo.esColaborador} />
}
