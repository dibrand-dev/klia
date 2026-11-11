'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DbIcon from './icons'

export interface DrilldownRow {
  id: string
  avatarText?: string
  avatarVariant?: 1 | 2 | 3 | 4 | 5 | 'os'
  primary: string
  tagsNode?: React.ReactNode
  secondaryNode?: React.ReactNode
  kvNode?: React.ReactNode
  kvSmall?: string
  kvClass?: 'danger' | 'ok' | ''
  href?: string
  actionsNode?: React.ReactNode
  filterKey?: string
  searchText?: string
}

export interface DrilldownGroup {
  heading?: string
  totalNode?: React.ReactNode
  totalSub?: string
  rows: DrilldownRow[]
}

export interface DrilldownSection {
  heading?: string
  description?: string
  groups: DrilldownGroup[]
}

export interface DrilldownFiltro {
  value: string
  onChange: (v: string) => void
  options: { key: string; label: string; count: number }[]
}

export interface DrilldownFootAction {
  label: string
  href?: string
  onClick?: () => void
  primary?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  sections: DrilldownSection[]
  filtro?: DrilldownFiltro
  footActions?: DrilldownFootAction[]
  emptyMessage?: string
}

const PAGINA = 50

function Avatar({ text, variant }: { text: string; variant?: 1 | 2 | 3 | 4 | 5 | 'os' }) {
  const cls = variant === 'os' ? 'os' : variant ? `a${variant}` : ''
  return <span className={`db-av ${cls}`} aria-hidden="true">{text}</span>
}

function Row({ row }: { row: DrilldownRow }) {
  const contenido = (
    <>
      {row.avatarText && <Avatar text={row.avatarText} variant={row.avatarVariant} />}
      <span style={{ minWidth: 0 }}>
        <span className="db-nm" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {row.primary}{row.tagsNode}
        </span>
        {row.secondaryNode && <span className="db-sc">{row.secondaryNode}</span>}
      </span>
      <span className={`db-kv ${row.kvClass ?? ''}`}>
        {row.kvNode}
        {row.kvSmall && <small>{row.kvSmall}</small>}
      </span>
      {row.actionsNode ?? <span />}
    </>
  )
  if (row.href) {
    return <li className={row.avatarText ? undefined : 'db-no-av'}><Link href={row.href} style={{ display: 'contents' }}>{contenido}</Link></li>
  }
  return <li className={row.avatarText ? undefined : 'db-no-av'}>{contenido}</li>
}

export default function DashboardDrilldownSlide({ open, onClose, title, subtitle, sections, filtro, footActions, emptyMessage }: Props) {
  const [visibles, setVisibles] = useState(PAGINA)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) { setVisibles(PAGINA); setQuery('') }
  }, [open, title])

  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const q = query.trim().toLowerCase()
  const totalRowsAll = sections.reduce((a, s) => a + s.groups.reduce((b, g) => b + g.rows.length, 0), 0)

  let presupuesto = visibles
  let totalMatches = 0
  let shownMatches = 0

  const seccionesRender = sections.map((sec) => {
    const grupos = sec.groups
      .map((g) => {
        const filas = g.rows.filter((r) => {
          if (filtro && filtro.value !== 'all' && r.filterKey && r.filterKey !== filtro.value) return false
          if (q && !(r.searchText ?? r.primary).toLowerCase().includes(q)) return false
          return true
        })
        totalMatches += filas.length
        const visibles2 = filas.slice(0, Math.max(0, presupuesto))
        presupuesto -= visibles2.length
        shownMatches += visibles2.length
        return { ...g, filasVisibles: visibles2, filasTotal: filas.length }
      })
      .filter((g) => g.filasTotal > 0 || !g.heading)
    return { ...sec, grupos }
  }).filter((s) => s.grupos.length > 0 || sections.length === 1)

  const quedanMas = totalMatches > shownMatches
  const sinResultados = q && shownMatches === 0

  return (
    <>
      <div className={`db-so-scrim ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`db-so ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div className="db-so-hdr">
          <div className="db-so-h-info">
            <h2 className="db-so-name">{title}</h2>
            {subtitle && <div className="db-so-meta">{subtitle}</div>}
          </div>
          <button className="db-so-close" onClick={onClose} aria-label="Cerrar">
            <DbIcon name="x" />
          </button>
        </div>

        {(totalRowsAll > 10 || filtro) && (
          <div className="db-so-tools">
            {totalRowsAll > 10 && (
              <label className="db-so-search">
                <span className="db-sr">Buscar</span>
                <DbIcon name="search" />
                <input className="db-af" type="search" placeholder="Buscar por nombre" value={query} onChange={(e) => { setQuery(e.target.value); setVisibles(PAGINA) }} />
              </label>
            )}
            {filtro && (
              <div className="db-seg" role="group" aria-label="Filtrar">
                {filtro.options.map((opt) => (
                  <button key={opt.key} type="button" aria-pressed={filtro.value === opt.key} onClick={() => { filtro.onChange(opt.key); setVisibles(PAGINA) }}>
                    {opt.label}<span className="db-n">{opt.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="db-so-body">
          {totalMatches === 0 && !sinResultados && (
            <div className="db-so-empty">{emptyMessage ?? 'No hay nada para mostrar.'}</div>
          )}
          {sinResultados && (
            <div className="db-so-empty">No hay resultados para &ldquo;{query}&rdquo;.</div>
          )}

          {!sinResultados && seccionesRender.map((sec, si) => (
            <div key={si}>
              {sec.heading && (
                <div className="db-so-sec-h">{sec.heading}{sec.description && <span>{sec.description}</span>}</div>
              )}
              {sec.grupos.map((g, gi) => (
                <div key={gi}>
                  {g.heading && (
                    <div className="db-so-grp-h">
                      <h4>{g.heading}</h4>
                      {g.totalNode && <span className="db-t">{g.totalNode}{g.totalSub && <small> · {g.totalSub}</small>}</span>}
                    </div>
                  )}
                  {g.filasVisibles.length > 0 && (
                    <ul className="db-so-rows">
                      {g.filasVisibles.map((row) => <Row key={row.id} row={row} />)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ))}

          {quedanMas && (
            <div className="db-so-more">
              <button className="btn" type="button" onClick={() => setVisibles((v) => v + PAGINA)}>
                Mostrar {Math.min(PAGINA, totalMatches - shownMatches)} más
                <span style={{ color: 'var(--muted-2)' }}> · {shownMatches} de {totalMatches}</span>
              </button>
            </div>
          )}
        </div>

        {footActions && footActions.length > 0 && (
          <div className="db-so-foot">
            {footActions.map((a, i) => a.href ? (
              <Link key={i} href={a.href} className={`btn ${a.primary ? 'primary' : ''}`}>{a.label}{a.primary && <DbIcon name="arrowR" />}</Link>
            ) : (
              <button key={i} type="button" className={`btn ${a.primary ? 'primary' : ''}`} onClick={a.onClick}>{a.label}{a.primary && <DbIcon name="arrowR" />}</button>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
