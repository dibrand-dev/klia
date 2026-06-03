export function getTerminologia(terminologia: 'sesion' | 'consulta' | null | undefined = 'sesion') {
  if (terminologia === 'consulta') {
    return {
      sesion: 'consulta',
      Sesion: 'Consulta',
      sesiones: 'consultas',
      Sesiones: 'Consultas',
      nueva_sesion: 'Nueva consulta',
      Nueva_sesion: 'Nueva Consulta',
      tipo_sesion: 'Tipo de consulta',
      nota_sesion: 'nota de consulta',
      sin_sesiones: 'Sin consultas realizadas',
      tabla_sesiones: 'Tabla de consultas',
    }
  }
  return {
    sesion: 'sesión',
    Sesion: 'Sesión',
    sesiones: 'sesiones',
    Sesiones: 'Sesiones',
    nueva_sesion: 'Nueva sesión',
    Nueva_sesion: 'Nueva Sesión',
    tipo_sesion: 'Tipo de sesión',
    nota_sesion: 'nota de sesión',
    sin_sesiones: 'Sin sesiones realizadas',
    tabla_sesiones: 'Tabla de sesiones',
  }
}
