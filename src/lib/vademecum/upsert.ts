import { serviceClient } from '@/lib/supabase/service'
import type { AlimentoMapeado } from './openfoodfacts'

/**
 * Upsert de un lote de productos OFF ya mapeados en vademecum_alimentos +
 * vademecum_alimento_nutrientes. Usado tanto por el import inicial resumible
 * como por el sync mensual — misma lógica de escritura, distinta fuente de páginas.
 */
export async function upsertLoteOFF(lote: AlimentoMapeado[]): Promise<{ alimentos: number; nutrientes: number }> {
  if (lote.length === 0) return { alimentos: 0, nutrientes: 0 }

  const db = serviceClient()

  const alimentos = lote.map((m) => m.alimento)
  const { error: errorAlimentos } = await db
    .from('vademecum_alimentos')
    .upsert(alimentos, { onConflict: 'id' })
  if (errorAlimentos) {
    throw new Error(`Error upsert vademecum_alimentos: ${errorAlimentos.message}`)
  }

  const nutrientes = lote.flatMap((m) => m.nutrientes)
  const { error: errorNutrientes } = await db
    .from('vademecum_alimento_nutrientes')
    .upsert(nutrientes, { onConflict: 'alimento_id,nutriente_codigo' })
  if (errorNutrientes) {
    throw new Error(`Error upsert vademecum_alimento_nutrientes: ${errorNutrientes.message}`)
  }

  return { alimentos: alimentos.length, nutrientes: nutrientes.length }
}
