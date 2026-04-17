import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ConsultorioApp',
  description: 'Gestión de turnos y pacientes para psicólogos y terapeutas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  )
}
