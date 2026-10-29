'use client'

import type { ValoresModulo } from '@/lib/notas/modulos'
import ModuloNutricion from './modulos/ModuloNutricion'
import ModuloOftalmologia from './modulos/ModuloOftalmologia'
import ModuloKinesiologia from './modulos/ModuloKinesiologia'
import ModuloOdontologia from './modulos/ModuloOdontologia'
import ModuloPsicologia from './modulos/ModuloPsicologia'
import ModuloClinicaMedica from './modulos/ModuloClinicaMedica'

interface Props {
  especialidad: string | null | undefined
  pacienteId: string
  valores: ValoresModulo
  onChange: (key: string, val: string | string[]) => void
  edadPaciente: number | null
  sexoPaciente: 'M' | 'F' | null
}

// Especialidades sin módulo propio (incluye 'Otra especialidad' del diseño):
// solo queda el placeholder de la nota, sin panel ni columna de cálculos.
export function tieneModulo(especialidad: string | null | undefined): boolean {
  return !!especialidad && ['Nutrición', 'Oftalmología', 'Kinesiología', 'Odontología', 'Psicología', 'Clínica Médica'].includes(especialidad)
}

export default function ModuloEspecialidad({ especialidad, pacienteId, valores, onChange, edadPaciente, sexoPaciente }: Props) {
  switch (especialidad) {
    case 'Nutrición':
      return <ModuloNutricion pacienteId={pacienteId} valores={valores} onChange={onChange} edadPaciente={edadPaciente} sexoPaciente={sexoPaciente} />
    case 'Oftalmología':
      return <ModuloOftalmologia pacienteId={pacienteId} valores={valores} onChange={onChange} />
    case 'Kinesiología':
      return <ModuloKinesiologia pacienteId={pacienteId} valores={valores} onChange={onChange} />
    case 'Odontología':
      return <ModuloOdontologia pacienteId={pacienteId} valores={valores} onChange={onChange} />
    case 'Psicología':
      return <ModuloPsicologia pacienteId={pacienteId} valores={valores} onChange={onChange} />
    case 'Clínica Médica':
      return <ModuloClinicaMedica pacienteId={pacienteId} valores={valores} onChange={onChange} />
    default:
      return null
  }
}
