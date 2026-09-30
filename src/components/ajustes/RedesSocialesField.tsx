'use client'

import { useEffect, useRef, useState } from 'react'

export interface RedesSociales {
  instagram_url: string | null
  facebook_url: string | null
  x_url: string | null
  tiktok_url: string | null
  linkedin_url: string | null
}

type NetKey = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'linkedin'

// Orden fijo de visualización — también usado acá como orden por default al
// reconstruir las filas desde las 5 columnas guardadas (no persistimos un
// orden de carga separado, así que mostrar siempre en este orden es
// consistente con lo que ve el paciente en el link público).
const ORDEN: NetKey[] = ['instagram', 'facebook', 'x', 'tiktok', 'linkedin']
const MAX = 3

const NETS: Record<NetKey, { nombre: string; dominios: string[]; url: (h: string) => string; placeholder: string; icon: React.ReactNode }> = {
  instagram: {
    nombre: 'Instagram', dominios: ['instagram.com', 'instagr.am'], url: (h) => `instagram.com/${h}`,
    placeholder: '@usuario o instagram.com/usuario',
    icon: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  },
  facebook: {
    nombre: 'Facebook', dominios: ['facebook.com', 'fb.com', 'fb.me'], url: (h) => `facebook.com/${h}`,
    placeholder: 'facebook.com/tu.pagina',
    icon: <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h3l.5-4H12V7.5c0-.6.4-1 1-1h2z" />,
  },
  x: {
    nombre: 'X', dominios: ['x.com', 'twitter.com'], url: (h) => `x.com/${h}`,
    placeholder: '@usuario o x.com/usuario',
    icon: <><path d="M4 4l11.7 16H20L8.3 4z" /><path d="M4 20l6.8-6.8M20 4l-6.6 6.6" /></>,
  },
  tiktok: {
    nombre: 'TikTok', dominios: ['tiktok.com'], url: (h) => `tiktok.com/@${h}`,
    placeholder: '@usuario o tiktok.com/@usuario',
    icon: <><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2.3 4.4 5 4.6" /></>,
  },
  linkedin: {
    nombre: 'LinkedIn', dominios: ['linkedin.com', 'lnkd.in'], url: (h) => `linkedin.com/in/${h}`,
    placeholder: 'linkedin.com/in/tu-perfil',
    icon: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V17M8 7.2v.01M12 17v-6.5M12 13.5a2.5 2.5 0 0 1 5 0V17" /></>,
  },
}

const ICON_CHEV = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'var(--muted-2)', strokeWidth: 2, fill: 'none' }}><path d="M6 9l6 6 6-6" /></svg>
const ICON_CHECK = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', strokeWidth: 2.2, fill: 'none' }}><path d="M20 6 9 17l-5-5" /></svg>
const ICON_WARN = <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: 'currentColor', strokeWidth: 2, fill: 'none', flexShrink: 0 }}><path d="M12 4l9 16H3l9-16z" /><path d="M12 10v4M12 17h.01" /></svg>
const ICON_X = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M6 6l12 12M18 6L6 18" /></svg>
const ICON_PLUS = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M12 5v14M5 12h14" /></svg>

function icono(net: NetKey, size = 17): React.ReactNode {
  return <svg viewBox="0 0 24 24" style={{ width: size, height: size, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>{NETS[net].icon}</svg>
}

type Chequeo = { st: 'empty' } | { st: 'warn'; t: string } | { st: 'ok'; url: string }

function chequear(net: NetKey, valorCrudo: string): Chequeo {
  const s = valorCrudo.trim()
  if (!s) return { st: 'empty' }
  const N = NETS[net]
  const m = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  const host = m.split('/')[0].toLowerCase()
  if (host.includes('.')) {
    const otra = ORDEN.find((k) => k !== net && NETS[k].dominios.some((d) => host.endsWith(d)))
    if (otra) return { st: 'warn', t: `Parece un link de ${NETS[otra].nombre}, no de ${N.nombre}.` }
    if (!N.dominios.some((d) => host.endsWith(d))) return { st: 'warn', t: `No parece un link de ${N.nombre}. Revisalo antes de guardar.` }
    if (!m.split('/')[1]) return { st: 'warn', t: 'Falta el usuario al final del link.' }
    return { st: 'ok', url: m.replace(/\/+$/, '') }
  }
  const h = s.replace(/^@/, '')
  if (!/^[\w.-]{2,40}$/.test(h)) return { st: 'warn', t: 'No parece un @usuario ni un link. Revisalo antes de guardar.' }
  return { st: 'ok', url: N.url(h) }
}

interface Fila { id: number; net: NetKey; valor: string }

let uidSeq = 0
const nextUid = () => uidSeq++

function filasIniciales(value: RedesSociales): Fila[] {
  const columnaPorNet: Record<NetKey, string | null> = {
    instagram: value.instagram_url, facebook: value.facebook_url, x: value.x_url,
    tiktok: value.tiktok_url, linkedin: value.linkedin_url,
  }
  return ORDEN.filter((net) => columnaPorNet[net]).map((net) => ({ id: nextUid(), net, valor: columnaPorNet[net]! }))
}

function filasAColumnas(filas: Fila[]): RedesSociales {
  const out: RedesSociales = { instagram_url: null, facebook_url: null, x_url: null, tiktok_url: null, linkedin_url: null }
  for (const f of filas) {
    const c = chequear(f.net, f.valor)
    if (c.st === 'ok') out[`${f.net}_url`] = c.url
  }
  return out
}

interface Props {
  initialValue: RedesSociales
  onChange: (value: RedesSociales) => void
}

export default function RedesSocialesField({ initialValue, onChange }: Props) {
  const [filas, setFilas] = useState<Fila[]>(() => filasIniciales(initialValue))
  const [abierto, setAbierto] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (abierto == null) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(null)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setAbierto(null) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onEsc) }
  }, [abierto])

  function emitir(next: Fila[]) {
    setFilas(next)
    onChange(filasAColumnas(next))
  }

  function agregar() {
    const usados = new Set(filas.map((f) => f.net))
    const libre = ORDEN.find((n) => !usados.has(n))
    if (!libre) return
    emitir([...filas, { id: nextUid(), net: libre, valor: '' }])
  }

  function quitar(id: number) {
    emitir(filas.filter((f) => f.id !== id))
  }

  function cambiarRed(id: number, net: NetKey) {
    emitir(filas.map((f) => (f.id === id ? { ...f, net } : f)))
    setAbierto(null)
  }

  function cambiarValor(id: number, valor: string) {
    emitir(filas.map((f) => (f.id === id ? { ...f, valor } : f)))
  }

  const usadas = new Set(filas.map((f) => f.net))

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {filas.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--muted)', padding: '2px 0 4px', margin: 0 }}>Todavía no agregaste redes sociales.</p>
      )}
      {filas.map((f) => {
        const c = chequear(f.net, f.valor)
        return (
          <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '168px minmax(0,1fr) 32px', gap: 8, alignItems: 'start' }}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setAbierto((o) => (o === f.id ? null : f.id))}
                aria-haspopup="listbox"
                aria-expanded={abierto === f.id}
                style={{
                  width: '100%', height: 38, display: 'flex', alignItems: 'center', gap: 9, padding: '0 10px 0 11px',
                  border: `1px solid ${abierto === f.id ? 'var(--accent)' : 'var(--border)'}`,
                  boxShadow: abierto === f.id ? '0 0 0 3px var(--accent-soft)' : 'none',
                  borderRadius: 8, background: 'var(--surface)', font: 'inherit', fontSize: 14, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                {icono(f.net)}
                <span style={{ flex: 1 }}>{NETS[f.net].nombre}</span>
                {ICON_CHEV}
              </button>
              {abierto === f.id && (
                <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30, width: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 30px rgba(14,20,48,.14)', padding: 4 }}>
                  {ORDEN.map((k) => {
                    const tomada = k !== f.net && usadas.has(k)
                    const activa = k === f.net
                    return (
                      <button
                        key={k}
                        type="button"
                        role="option"
                        aria-selected={activa}
                        disabled={tomada}
                        onClick={() => cambiarRed(f.id, k)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', border: 'none',
                          background: activa ? 'var(--accent-soft)' : 'transparent', borderRadius: 7, font: 'inherit', fontSize: 13.5,
                          color: tomada ? 'var(--muted-2)' : activa ? 'var(--accent)' : 'var(--ink)', fontWeight: activa ? 600 : 400,
                          cursor: tomada ? 'default' : 'pointer', textAlign: 'left',
                        }}
                      >
                        {icono(k, 15)}
                        <span style={{ flex: 1 }}>{NETS[k].nombre}</span>
                        {tomada ? <em style={{ fontStyle: 'normal', fontSize: 11, color: 'var(--muted-2)' }}>Ya agregada</em> : activa ? ICON_CHECK : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <input
                type="text"
                value={f.valor}
                onChange={(e) => cambiarValor(f.id, e.target.value)}
                placeholder={NETS[f.net].placeholder}
                aria-label={`Link o usuario de ${NETS[f.net].nombre}`}
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: '100%', height: 38, border: `1px solid ${c.st === 'warn' ? 'var(--warn)' : 'var(--border)'}`,
                  boxShadow: c.st === 'warn' ? '0 0 0 3px var(--warn-soft)' : 'none',
                  borderRadius: 8, padding: '0 11px', font: 'inherit', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', outline: 'none',
                }}
              />
              <span style={{ fontSize: 11.5, color: c.st === 'warn' ? '#92400E' : 'var(--muted-2)', display: 'flex', gap: 5, alignItems: 'center', minHeight: 15 }}>
                {c.st === 'warn' && <>{ICON_WARN}{c.t}</>}
                {c.st === 'ok' && <>Abre <b style={{ fontWeight: 500, color: 'var(--ink-2)' }}>&nbsp;{c.url}</b></>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => quitar(f.id)}
              title={`Quitar ${NETS[f.net].nombre}`}
              aria-label={`Quitar ${NETS[f.net].nombre}`}
              style={{ width: 32, height: 38, border: 'none', background: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--muted-2)', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.color = 'var(--danger)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-2)' }}
            >
              {ICON_X}
            </button>
          </div>
        )
      })}
      {filas.length < MAX ? (
        <button
          type="button"
          onClick={agregar}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px dashed var(--border)',
            background: 'none', borderRadius: 8, height: 36, padding: '0 12px', font: 'inherit', fontSize: 13, fontWeight: 600,
            color: 'var(--ink)', cursor: 'pointer', marginTop: 2,
          }}
        >
          {ICON_PLUS}Agregar red social
        </button>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted-2)', margin: '2px 0 0' }}>Llegaste al máximo de 3 redes. Quitá una para sumar otra.</p>
      )}
    </div>
  )
}
