import { createClient } from '@/lib/supabase/server'
import { mpPublicKey } from '@/lib/mercadopago'
import PlanesClient from './PlanesClient'

export type ModuloItem = {
  modulo_id: string
  nombre: string
  descripcion: string | null
  planes: string[]
}

export default async function PlanesPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('modulos_config')
    .select('modulo_id, nombre, descripcion, planes')
    .eq('activo', true)
    .order('modulo_id')

  return (
    <PlanesClient
      mpPublicKey={mpPublicKey}
      modulos={(data ?? []) as ModuloItem[]}
    />
  )
}
