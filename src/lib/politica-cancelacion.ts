export function evaluarCancelacion(fechaHoraISO: string, politicaHoras: number | null | undefined, now = new Date()) {
  const horas = (new Date(fechaHoraISO).getTime() - now.getTime()) / 3_600_000
  const limite = politicaHoras ?? 24
  return { horasAnticipacion: Math.max(0, Math.floor(horas)), politicaHoras: limite, tardia: horas < limite }
}
