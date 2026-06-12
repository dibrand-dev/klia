import { createClient } from '@/lib/supabase/server'
import PlanesClient from './PlanesClient'
import type { PlanFeature } from '@/types/database'

export default async function PlanesPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('plan_features')
    .select('id, plan_id, texto, incluido, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })

  return (
    <PlanesClient
      mpPublicKey={process.env.MP_PUBLIC_KEY_PROD ?? ''}
      features={(data ?? []) as PlanFeature[]}
    />
  )
}
