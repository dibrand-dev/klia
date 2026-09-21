// Mapeo Open Food Facts → Vademécum (fuente='off'). Este módulo solo hace
// fetch + mapeo — no toca la base, para poder testear/inspeccionar el mapeo
// sin efectos secundarios. La escritura vive en los endpoints que lo consumen.

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/api/v2/search'
const OFF_FIELDS = 'code,product_name,categories_tags,nutriments,last_modified_t'

// Únicos 4 códigos que el resto de la app lee de vademecum_alimento_nutrientes
// (ver NUTRIENTES_CODIGOS en src/app/api/planes-alimentarios/[id]/macros/route.ts
// y src/app/api/vademecum/alimentos/route.ts) — deben existir de antemano en
// vademecum_nutrientes.codigo (FK ON DELETE RESTRICT), no se crean acá.
const OFF_A_VADEMECUM: Record<string, string> = {
  'energy-kcal_100g': 'ENERC_KCAL',
  proteins_100g: 'PROTCNT',
  fat_100g: 'FAT',
  carbohydrates_100g: 'CHOCDF',
}

export interface OFFProducto {
  code?: string
  product_name?: string
  categories_tags?: string[]
  nutriments?: Record<string, unknown>
  last_modified_t?: number
}

export interface OFFSearchResponse {
  count: number
  page: number
  page_count: number
  page_size: number
  products: OFFProducto[]
}

export interface AlimentoMapeado {
  alimento: { id: string; fuente: 'off'; nombre: string; grupo: string }
  nutrientes: { alimento_id: string; nutriente_codigo: string; valor: number }[]
}

/**
 * Primera categoría en español del array categories_tags (formato "es:bebidas"),
 * humanizada. Si no hay ninguna con prefijo "es:", cae al genérico del catálogo.
 */
export function grupoDesdeCategorias(categoriesTags: string[] | undefined): string {
  const tagEs = (categoriesTags ?? []).find((t) => t.startsWith('es:'))
  if (!tagEs) return 'Productos de marca'
  const sinPrefijo = tagEs.slice(3).replace(/-/g, ' ').trim()
  if (!sinPrefijo) return 'Productos de marca'
  return sinPrefijo.charAt(0).toUpperCase() + sinPrefijo.slice(1)
}

function numeroValido(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

/**
 * Mapea un producto de OFF a filas de vademecum_alimentos/vademecum_alimento_nutrientes.
 * Devuelve null si el producto no aporta nada útil al buscador: sin código de
 * barras, sin nombre, o sin ningún macro de los 4 que usa el resto de la app.
 */
export function mapearProductoOFF(producto: OFFProducto): AlimentoMapeado | null {
  const id = producto.code?.trim()
  const nombre = producto.product_name?.trim()
  if (!id || !nombre) return null

  const nutrientes: { alimento_id: string; nutriente_codigo: string; valor: number }[] = []
  for (const [campoOFF, codigoVademecum] of Object.entries(OFF_A_VADEMECUM)) {
    const valor = numeroValido(producto.nutriments?.[campoOFF])
    if (valor !== null) {
      nutrientes.push({ alimento_id: id, nutriente_codigo: codigoVademecum, valor })
    }
  }
  if (nutrientes.length === 0) return null

  return {
    alimento: { id, fuente: 'off', nombre, grupo: grupoDesdeCategorias(producto.categories_tags) },
    nutrientes,
  }
}

/**
 * Trae una única página de resultados de Argentina. sortByLastModified se usa
 * en el sync incremental (recorrer de más reciente a más antiguo hasta llegar
 * a la última corrida exitosa).
 */
export async function buscarPaginaOFF(params: {
  page: number
  pageSize?: number
  sortByLastModified?: boolean
}): Promise<OFFSearchResponse> {
  const { page, pageSize = 100, sortByLastModified = false } = params
  const url = new URL(OFF_SEARCH_URL)
  url.searchParams.set('countries_tags_en', 'argentina')
  url.searchParams.set('page', String(page))
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('fields', OFF_FIELDS)
  if (sortByLastModified) url.searchParams.set('sort_by', 'last_modified_t')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'KLIA-Vademecum/1.0 (https://klia.com.ar; hola@klia.com.ar)' },
  })
  if (!res.ok) {
    throw new Error(`Open Food Facts respondió ${res.status} para page=${page}`)
  }
  return (await res.json()) as OFFSearchResponse
}

/** Mapea una lista de productos, descartando los inválidos. */
export function mapearPaginaOFF(productos: OFFProducto[]): AlimentoMapeado[] {
  const resultado: AlimentoMapeado[] = []
  for (const producto of productos) {
    const mapeado = mapearProductoOFF(producto)
    if (mapeado) resultado.push(mapeado)
  }
  return resultado
}
