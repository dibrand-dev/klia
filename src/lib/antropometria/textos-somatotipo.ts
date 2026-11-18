// Textos descriptivos por componente del somatotipo (Heath-Carter), uno por cada
// nivel que devuelve `lecturaSomatotipo` en calculos.ts ('bajo' | 'moderado' | 'alto' |
// 'muy alto' | 'extremadamente alto'). Solo datos — la lógica de clasificación vive en calculos.ts.

export type NivelSomatotipo = 'bajo' | 'moderado' | 'alto' | 'muy alto' | 'extremadamente alto'
export type ComponenteSomatotipo = 'endo' | 'meso' | 'ecto'

export const TEXTOS_SOMATOTIPO: Record<ComponenteSomatotipo, Record<NivelSomatotipo, string>> = {
  endo: {
    bajo: 'poca grasa bajo la piel; se marcan las formas musculares y óseas.',
    moderado: 'cantidad moderada de grasa bajo la piel.',
    alto: 'adiposidad relativa alta; abundante grasa bajo la piel.',
    'muy alto': 'adiposidad relativa muy alta; grasa bajo la piel muy abundante.',
    // PENDIENTE: frase propia de la nutricionista
    'extremadamente alto': 'adiposidad relativa muy alta; grasa bajo la piel muy abundante.',
  },
  meso: {
    bajo: 'poco desarrollo muscular y óseo relativo; estructura liviana.',
    moderado: 'desarrollo muscular y óseo moderado.',
    alto: 'desarrollo muscular alto; músculos voluminosos y estructura ósea ancha.',
    'muy alto': 'desarrollo extremadamente alto; músculos muy voluminosos y esqueleto con articulaciones muy grandes.',
    // PENDIENTE: frase propia de la nutricionista
    'extremadamente alto': 'desarrollo extremadamente alto; músculos muy voluminosos y esqueleto con articulaciones muy grandes.',
  },
  ecto: {
    bajo: 'mucho volumen por unidad de altura; extremidades voluminosas.',
    moderado: 'linealidad moderada.',
    alto: 'cuerpo alargado y delgado, poco volumen por unidad de altura.',
    'muy alto': 'cuerpo muy alargado y delgado.',
    // PENDIENTE: frase propia de la nutricionista
    'extremadamente alto': 'cuerpo muy alargado y delgado.',
  },
}

export const ACLARACION_ESCALA_SOMATOTIPO = 'Son valores de una escala, no porcentajes ni kilos.'
