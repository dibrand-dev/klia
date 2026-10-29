'use client'

import { useState } from 'react'
import type { ResultadoCalc } from '@/lib/notas/calc-utils'

// Átomos de campo genéricos para los módulos de nota clínica por
// especialidad — puerto 1:1 de los helpers H.num/H.txt/H.seg/H.sel/H.sub/H.cie
// del diseño de referencia, ya como componentes React controlados.

export function Grilla({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  return <div className={`gr ${cols === 2 ? 'g2' : 'g3'}`}>{children}</div>
}

export function CampoNum({ label, unit, value, onChange, placeholder = '0' }: {
  label: string
  unit?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="f">
      <span className="fl">{label}</span>
      <span className="in">
        <input inputMode="decimal" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  )
}

export function CampoTexto({ label, value, onChange, placeholder, rows = 2 }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="f" style={{ gridColumn: '1 / -1' }}>
      <span className="fl">{label}</span>
      <textarea rows={rows} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function CampoSegmentado({ label, opciones, valor, onChange, multi = false }: {
  label: string
  opciones: string[]
  valor: string[]
  onChange: (v: string[]) => void
  multi?: boolean
}) {
  function toggle(o: string) {
    if (multi) {
      onChange(valor.includes(o) ? valor.filter((x) => x !== o) : [...valor, o])
    } else {
      onChange(valor.includes(o) ? [] : [o])
    }
  }
  return (
    <div className="f" style={{ gridColumn: '1 / -1' }}>
      <span className="fl">{label}</span>
      <div className="sg">
        {opciones.map((o) => (
          <button key={o} type="button" className={valor.includes(o) ? 'on' : ''} onClick={() => toggle(o)}>{o}</button>
        ))}
      </div>
    </div>
  )
}

export function CampoEva({ label, valor, onChange }: { label: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="f" style={{ gridColumn: '1 / -1' }}>
      <span className="fl">{label}</span>
      <div className="eva">
        {Array.from({ length: 11 }, (_, i) => String(i)).map((i) => (
          <button key={i} type="button" className={valor === i ? 'on' : ''} onClick={() => onChange(i)}>{i}</button>
        ))}
      </div>
      <span className="cap2"><span>Sin dolor</span><span>Máximo</span></span>
    </div>
  )
}

export function CampoSelect({ label, opciones, valor, onChange }: {
  label: string
  opciones: string[]
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <label className="f">
      <span className="fl">{label}</span>
      <span className="in">
        <select value={valor} onChange={(e) => onChange(e.target.value)}>
          <option value="">Elegí</option>
          {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </span>
    </label>
  )
}

export function Colapsable({ titulo, open, onToggle, children }: {
  titulo: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`sub ${open ? 'open' : ''}`}>
      <button type="button" className="subh" onClick={onToggle}>
        {titulo}
        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="subb">{children}</div>
    </div>
  )
}

export function CampoCie10({ chips, onChange }: { chips: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div className="f" style={{ gridColumn: '1 / -1' }}>
      <span className="fl">Diagnóstico CIE-10</span>
      <div className="cie">
        <span className="chips">
          {chips.map((c, i) => {
            const [codigo, ...resto] = c.split(' ')
            return (
              <span className="ch" key={`${c}-${i}`}>
                <b>{codigo}</b>{resto.length ? ` ${resto.join(' ')}` : ''}
                <button type="button" aria-label="Quitar" onClick={() => onChange(chips.filter((_, j) => j !== i))}>×</button>
              </span>
            )
          })}
        </span>
        <input
          placeholder="Buscá por código o nombre"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              e.preventDefault()
              onChange([...chips, input.trim()])
              setInput('')
            }
          }}
        />
      </div>
    </div>
  )
}

const CUADRANTES: number[][] = [
  [18, 17, 16, 15, 14, 13, 12, 11],
  [21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41],
  [31, 32, 33, 34, 35, 36, 37, 38],
]

export function Odontograma({ piezas, onChange }: { piezas: string[]; onChange: (v: string[]) => void }) {
  function toggle(p: number) {
    const s = String(p)
    onChange(piezas.includes(s) ? piezas.filter((x) => x !== s) : [...piezas, s])
  }
  function fila(a: number[], b: number[]) {
    return (
      <div className="odr">
        {a.map((p) => (
          <button key={p} type="button" data-p={p} className={piezas.includes(String(p)) ? 'on' : ''} onClick={() => toggle(p)}>{p}</button>
        ))}
        <i />
        {b.map((p) => (
          <button key={p} type="button" data-p={p} className={piezas.includes(String(p)) ? 'on' : ''} onClick={() => toggle(p)}>{p}</button>
        ))}
      </div>
    )
  }
  return (
    <div className="f" style={{ gridColumn: '1 / -1' }}>
      <span className="fl">Piezas (FDI)</span>
      <div className="odo">
        {fila(CUADRANTES[0], CUADRANTES[1])}
        <div className="odm" />
        {fila(CUADRANTES[2], CUADRANTES[3])}
      </div>
    </div>
  )
}

export function BarraProgreso({ pct }: { pct: number }) {
  return <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>
}

export function TarjetaCalc({ label, resultado, tog }: {
  label: string
  resultado: ResultadoCalc
  tog?: { opciones: string[]; valor: number; onChange: (i: number) => void }
}) {
  return (
    <div className={`cc ${resultado.warn ? 'warn' : ''}`}>
      <span className="cl">{label}</span>
      {resultado.hint ? (
        <span className="ch2">{resultado.hint}</span>
      ) : (
        <>
          {resultado.val && <span className="cv" dangerouslySetInnerHTML={{ __html: resultado.val }} />}
          <span className="cs" dangerouslySetInnerHTML={{ __html: resultado.sub ?? '' }} />
        </>
      )}
      {tog && (
        <div className="tg">
          {tog.opciones.map((t, i) => (
            <button key={t} type="button" className={tog.valor === i ? 'on' : ''} onClick={() => tog.onChange(i)}>{t}</button>
          ))}
        </div>
      )}
    </div>
  )
}
