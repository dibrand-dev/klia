'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import FirmaUploader from '@/components/ui/FirmaUploader'

export default function FirmasPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [firmaSello, setFirmaSello] = useState<string | null>(null)
  const [firmaSimple, setFirmaSimple] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('profiles')
        .select('firma_url, firma_sello_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setFirmaSello(data?.firma_sello_url ?? null)
          setFirmaSimple(data?.firma_url ?? null)
        })
    })
  }, [])

  async function actualizarFirma(campo: 'firma_sello_url' | 'firma_url', url: string | null) {
    if (!userId) return
    setGuardando(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ [campo]: url }).eq('id', userId)
    setGuardando(false)
  }

  if (!userId) {
    return (
      <div className="mx-auto w-full max-w-[860px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/ajustes"
          className="text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Firma escaneada</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Las firmas se insertan automáticamente en planillas de asistencia y documentos oficiales.
          </p>
        </div>
      </div>

      {guardando && (
        <p className="text-xs text-primary font-medium mb-4">Guardando...</p>
      )}

      <div className="space-y-4">
        {/* Firma con sello */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-on-surface">Firma con sello</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Usada en planillas de asistencia, informes y documentos oficiales
            </p>
          </div>
          <FirmaUploader
            label="Firma y sello profesional"
            descripcion="Combinación de tu firma manuscrita y sello profesional"
            instrucciones="La imagen debe mostrar tu firma y sello profesional sobre fondo blanco, en tinta negra."
            firmaUrl={firmaSello}
            bucket="firmas-profesionales"
            storagePath={`${userId}/firma-sello`}
            onUpload={(url) => { setFirmaSello(url); actualizarFirma('firma_sello_url', url) }}
            onDelete={() => { setFirmaSello(null); actualizarFirma('firma_sello_url', null) }}
          />
        </div>

        {/* Firma simple */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-on-surface">Firma simple</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Usada en planillas de sesiones simples
            </p>
          </div>
          <FirmaUploader
            label="Firma manuscrita"
            descripcion="Solo tu firma, sin sello"
            instrucciones="Solo tu firma, sin sello, sobre fondo blanco en tinta negra."
            firmaUrl={firmaSimple}
            bucket="firmas-profesionales"
            storagePath={`${userId}/firma-simple`}
            onUpload={(url) => { setFirmaSimple(url); actualizarFirma('firma_url', url) }}
            onDelete={() => { setFirmaSimple(null); actualizarFirma('firma_url', null) }}
          />
        </div>
      </div>
    </div>
  )
}
