import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PerfilProfesional from '@/components/ajustes/PerfilProfesional'

export const metadata = { title: 'Ajustes — ConsultorioApp' }

export default async function AjustesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <h1 className="text-2xl font-bold text-on-surface mb-2">Ajustes</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Configurá tu perfil profesional. Esta información es visible para colegas en la solapa de Interconsultas.
      </p>
      <PerfilProfesional profile={profile} />
    </div>
  )
}
