// Mapeo registro de `registros_antropometricos` (Supabase) → Medidas de la librería de
// cálculo. Única fuente de este mapeo — usado por el slide de alta/edición y por el
// informe profesional, para no duplicar el DB→Medidas en los dos lugares.
import type { Medidas } from './calculos'

/** Subconjunto de columnas de `registros_antropometricos` que alimentan `Medidas`. */
export interface RegistroMedidasDB {
  peso?: number | null; altura?: number | null; talla_sentado?: number | null; envergadura?: number | null
  pliegue_tricipital?: number | null; pliegue_subescapular?: number | null; pliegue_biceps?: number | null; pliegue_cresta_iliaca?: number | null
  pliegue_supraespinal?: number | null; pliegue_abdominal?: number | null; pliegue_muslo?: number | null; pliegue_pantorrilla?: number | null
  perimetro_brazo?: number | null; perimetro_brazo_contraido?: number | null; cintura?: number | null; cadera?: number | null
  perimetro_muslo_medio?: number | null; perimetro_pierna?: number | null
  diametro_humero?: number | null; diametro_biestiloideo?: number | null; diametro_femur?: number | null
}

export function medidasDesdeRegistro(r: RegistroMedidasDB): Medidas {
  return {
    masa: r.peso ?? null, talla: r.altura ?? null, tallaSentado: r.talla_sentado ?? null, envergadura: r.envergadura ?? null,
    triceps: r.pliegue_tricipital ?? null, subescapular: r.pliegue_subescapular ?? null, biceps: r.pliegue_biceps ?? null, crestaIliaca: r.pliegue_cresta_iliaca ?? null,
    supraespinal: r.pliegue_supraespinal ?? null, abdominal: r.pliegue_abdominal ?? null, muslo: r.pliegue_muslo ?? null, pantorrilla: r.pliegue_pantorrilla ?? null,
    brazoRelajado: r.perimetro_brazo ?? null, brazoContraido: r.perimetro_brazo_contraido ?? null, cintura: r.cintura ?? null, cadera: r.cadera ?? null,
    musloMedio: r.perimetro_muslo_medio ?? null, pierna: r.perimetro_pierna ?? null,
    humero: r.diametro_humero ?? null, biestiloideo: r.diametro_biestiloideo ?? null, femur: r.diametro_femur ?? null,
  }
}
