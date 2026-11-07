function aStampUTC(d: Date): string {
  // YYYYMMDDTHHmmssZ — formato que espera el parámetro `dates` de Google Calendar.
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

interface WebinarParaCalendario {
  titulo: string
  fecha_inicio: string
  duracion_min: number
  url_videoconferencia: string
}

export function urlGoogleCalendar(w: WebinarParaCalendario): string {
  const inicio = new Date(w.fecha_inicio)
  const fin = new Date(inicio.getTime() + w.duracion_min * 60 * 1000)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: w.titulo,
    dates: `${aStampUTC(inicio)}/${aStampUTC(fin)}`,
    details: `Link de acceso al webinar: ${w.url_videoconferencia}`,
    location: w.url_videoconferencia,
    ctz: 'America/Argentina/Buenos_Aires',
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
