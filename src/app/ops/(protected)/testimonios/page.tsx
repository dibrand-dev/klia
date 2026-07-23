import { requireAdminUser } from '@/lib/ops/auth'
import { createClient } from '@/lib/supabase/server'
import TestimoniosClient from '@/components/ops/TestimoniosClient'
import type { Testimonio } from '@/types/database'

export const metadata = { title: 'Testimonios — Klia Ops' }

export default async function TestimoniosPage() {
  await requireAdminUser()
  const supabase = createClient()

  const { data: testimoniosData } = await supabase
    .from('testimonios')
    .select('*')
    .order('orden', { ascending: true })

  return (
    <div className="px-6 md:px-8 pt-8 pb-20 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Testimonios</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Testimonios de profesionales mostrados en la landing pública.
        </p>
      </div>

      <TestimoniosClient testimoniosIniciales={(testimoniosData ?? []) as Testimonio[]} />
    </div>
  )
}
