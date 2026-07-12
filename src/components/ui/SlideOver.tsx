'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
  header?: React.ReactNode
  footer?: React.ReactNode
  noPadding?: boolean
}

const WIDTH_MAP = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-[760px]',
}

export default function SlideOver({
  open, onClose, title, subtitle, children, width = 'md', header, footer, noPadding,
}: SlideOverProps) {
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-xl w-full transition-transform duration-300',
          WIDTH_MAP[width],
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {header ?? (
          <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
            <div className="min-w-0 pr-4">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
              {subtitle && (
                <p className="text-sm text-gray-500 mt-0.5 truncate capitalize">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className={cn('flex-1 overflow-y-auto', noPadding ? '' : 'p-6')}>
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0">{footer}</div>
        )}
      </div>
    </>
  )
}
