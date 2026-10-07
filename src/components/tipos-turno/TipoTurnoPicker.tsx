'use client'

import type { TipoTurno } from '@/types/database'

// Picker compartido entre NuevoTurnoPageForm y TurnoDetalleModal — reemplaza
// el toggle Sesión/Entrevista cuando el profesional tiene tipos propios
// activos. Las filas de "Tipos base" van sin duración/precio a la derecha
// (esos valores no existen para Sesión/Entrevista, se definen al agendar);
// los tipos propios sí muestran duración y precio del catálogo.
export interface TipoTurnoPick {
  tipo: 'sesion' | 'entrevista'
  tipoTurnoId: string | null
  duracionMin?: number
  precio?: number | null
  moneda?: string
}

interface Props {
  tiposTurno: TipoTurno[]
  tipo: 'sesion' | 'entrevista'
  tipoTurnoId: string | null
  nombreSesion: string
  onPick: (pick: TipoTurnoPick) => void
  // false en edición de un turno ya existente — pasar de Sesión a Entrevista
  // ahí implicaría moverlo a la tabla `entrevistas`, que no es parte de este
  // flujo (edición de turnos no soporta ese cambio de tabla).
  showEntrevista?: boolean
  // Si viene, "Tus tipos" muestra "· en {sedeNombre}" — quien no lo pase
  // (ej. TurnoDetalleModal, que edita un turno ya creado sin campo Sede)
  // sigue exactamente igual que antes.
  sedeNombre?: string
}

const SYM: Record<string, string> = { ARS: '$', USD: 'US$', EUR: '€' }

function money(precio: number | null, moneda: string): string {
  return precio != null && precio > 0 ? `${SYM[moneda] ?? '$'} ${Number(precio).toLocaleString('es-AR')}` : 'Sin costo'
}

export default function TipoTurnoPicker({ tiposTurno, tipo, tipoTurnoId, nombreSesion, onPick, showEntrevista = true, sedeNombre }: Props) {
  return (
    <div className="tt-tlist">
      <div className="tt-tl-h">Tipos base</div>
      <button
        type="button"
        className={`tt-topt ${tipo === 'sesion' && !tipoTurnoId ? 'on' : ''}`}
        onClick={() => onPick({ tipo: 'sesion', tipoTurnoId: null })}
      >
        <span className="tt-rd" />
        <span className="tt-tn">{nombreSesion}</span>
      </button>
      {showEntrevista && (
        <button
          type="button"
          className={`tt-topt ${tipo === 'entrevista' ? 'on' : ''}`}
          onClick={() => onPick({ tipo: 'entrevista', tipoTurnoId: null })}
        >
          <span className="tt-rd" />
          <span className="tt-tn">Entrevista</span>
        </button>
      )}
      {tiposTurno.length > 0 && (
        <>
          <div className="tt-tl-h">Tus tipos{sedeNombre && <span> · en {sedeNombre}</span>}</div>
          {tiposTurno.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`tt-topt ${tipoTurnoId === p.id ? 'on' : ''}`}
              onClick={() => onPick({
                tipo: 'sesion',
                tipoTurnoId: p.id,
                duracionMin: p.duracion_min,
                precio: p.precio,
                moneda: p.moneda,
              })}
            >
              <span className="tt-rd" />
              <span className="tt-tn">{p.nombre}</span>
              <span className="tt-tm2">{p.duracion_min} min · {money(p.precio, p.moneda)}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
