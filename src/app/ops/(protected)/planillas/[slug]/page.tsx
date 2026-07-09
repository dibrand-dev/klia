import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PlantillaEditor from '@/components/ops/PlantillaEditor'

export const metadata = { title: 'Editar plantilla — Klia Ops' }

export default async function PlantillaPage({ params }: { params: { slug: string } }) {
  await requireAdminUser()
  const supabase = createClient()

  if (params.slug === 'nueva') {
    return <PlantillaEditor template={null} />
  }

  const { data: template } = await supabase
    .from('planilla_templates')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!template) notFound()

  return <PlantillaEditor template={template} />
}
