'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PrestadorEditSlide from './PrestadorEditSlide'
import type { Profile } from '@/types/database'

export default function PrestadorEditButton({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border border-outline-variant/30 bg-white text-on-surface hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
        Editar perfil
      </button>

      <PrestadorEditSlide
        prestador={profile}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); router.refresh() }}
      />
    </>
  )
}
