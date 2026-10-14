import type { NextRequest } from 'next/server'
import crypto from 'crypto'

// Falla cerrado: sin CRON_SECRET configurado, nunca autoriza — nunca cae de
// vuelta al header x-vercel-cron (cualquiera puede mandarlo, no es un secreto).
export function verificarCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = req.headers.get('authorization') ?? ''
  const esperado = `Bearer ${secret}`

  const a = Buffer.from(auth)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false

  return crypto.timingSafeEqual(a, b)
}
