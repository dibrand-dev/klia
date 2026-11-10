'use client'

import { Fragment, useMemo, useState } from 'react'
import type { Database } from '@/types/database'
import VSlideOver from './VSlideOver'
import { IconArrow, IconBank, IconCoins, IconInfo, IconX } from '@/app/vendedor/icons'
import { money, fd, fds, mesLargo } from '@/app/vendedor/utils'

type Resumen = Database['public']['Functions']['vendedor_get_resumen']['Returns'][number]
type Comision = Database['public']['Functions']['vendedor_get_comisiones']['Returns'][number]

interface Props {
  resumen: Resumen
  comisiones: Comision[]
}

type EstadoComision = 'devengada' | 'confirmada' | 'liquidada' | 'revertida'
const CEST: Record<EstadoComision, string> = { devengada: 'Devengada', confirmada: 'Confirmada', liquidada: 'Liquidada', revertida: 'Revertida' }
const FILTROS: { k: EstadoComision | 'todas'; l: string }[] = [
  { k: 'todas', l: 'Todas' }, { k: 'devengada', l: 'Devengadas' }, { k: 'confirmada', l: 'Confirmadas' }, { k: 'liquidada', l: 'Liquidadas' }, { k: 'revertida', l: 'Revertidas' },
]

function proximaLiquidacion(): string {
  const n = new Date()
  const y = n.getMonth() === 11 ? n.getFullYear() + 1 : n.getFullYear()
  const m = (n.getMonth() + 1) % 12
  return `${y}-${String(m + 1).padStart(2, '0')}-05`
}

interface Liquidacion { fecha: string; items: Comision[]; total: number }

export default function ComisionesClient({ resumen, comisiones }: Props) {
  const [filtro, setFiltro] = useState<EstadoComision | 'todas'>('todas')
  const [agrupar, setAgrupar] = useState(true)
  const [liqAbierta, setLiqAbierta] = useState<Liquidacion | null>(null)

  const liquidaciones = useMemo(() => {
    const map = new Map<string, Liquidacion>()
    comisiones.filter(x => x.estado === 'liquidada' && x.liquidada_at).forEach(x => {
      const k = x.liquidada_at as string
      const g = map.get(k) ?? { fecha: k, items: [], total: 0 }
      g.items.push(x); g.total += x.monto_comision
      map.set(k, g)
    })
    return Array.from(map.values()).sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [comisiones])

  const totalesPorEstado = (k: EstadoComision) => {
    const l = comisiones.filter(x => x.estado === k)
    return { v: l.reduce((a, x) => a + x.monto_comision, 0), n: l.length }
  }
  const confirmadas = comisiones.filter(x => x.estado === 'confirmada')

  if (comisiones.length === 0) {
    return (
      <>
        <Header />
        <div className="blank">
          <div className="ic"><IconCoins width={23} height={23} stroke="var(--accent-ink)" strokeWidth={1.7} fill="none" /></div>
          <h3>Todavía no generaste comisiones</h3>
          <p>Cuando un profesional registrado con tu código haga su primer pago, vas a ver acá tu <em>{resumen.comision_pct}%</em> de cada mes.</p>
        </div>
        <Ayuda resumen={resumen} />
      </>
    )
  }

  const cnt = (k: EstadoComision | 'todas') => k === 'todas' ? comisiones.length : comisiones.filter(x => x.estado === k).length
  const filtradas = comisiones.filter(x => filtro === 'todas' || x.estado === filtro)

  const grupos: { k: string; items: Comision[] }[] = []
  filtradas.forEach(x => {
    const k = agrupar ? x.fecha_pago.slice(0, 7) : ''
    let g = grupos[grupos.length - 1]
    if (!g || g.k !== k) { g = { k, items: [] }; grupos.push(g) }
    g.items.push(x)
  })
  const totalGrupo = (items: Comision[]) => items.filter(x => x.estado !== 'revertida').reduce((a, x) => a + x.monto_comision, 0)

  return (
    <>
      <Header />
      <div className="tots">
        <div className="card kpi"><span className="lb"><i className="sw dev" />Devengada</span><span className="v">{money(totalesPorEstado('devengada').v)}</span><span className="nt">{totalesPorEstado('devengada').n} en espera</span></div>
        <div className="card kpi"><span className="lb"><i className="sw con" />Confirmada</span><span className="v">{money(totalesPorEstado('confirmada').v)}</span><span className="nt">{totalesPorEstado('confirmada').n} se paga el {fds(proximaLiquidacion())}</span></div>
        <div className="card kpi"><span className="lb"><i className="sw liq" />Liquidada</span><span className="v">{money(totalesPorEstado('liquidada').v)}</span><span className="nt">{totalesPorEstado('liquidada').n} ya cobrada</span></div>
        <div className="card kpi"><span className="lb"><i className="sw rev" />Revertida</span><span className="v">{money(totalesPorEstado('revertida').v)}</span><span className="nt">{totalesPorEstado('revertida').n} por reembolso</span></div>
      </div>

      <Ayuda resumen={resumen} />

      <div className="sec-t"><h2>Detalle</h2></div>
      <div className="tools">
        <div className="seg">
          {FILTROS.map(({ k, l }) => (
            <button key={k} type="button" className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>{l}<i>{cnt(k)}</i></button>
          ))}
        </div>
        <span className="sp" />
        <label className="tg">
          <input type="checkbox" checked={agrupar} onChange={e => setAgrupar(e.target.checked)} /><span className="tr" />Agrupar por mes
        </label>
      </div>

      {filtradas.length === 0 ? (
        <div className="blank neutral">
          <div className="ic"><IconCoins width={23} height={23} stroke="var(--muted)" strokeWidth={1.7} fill="none" /></div>
          <h3>No hay comisiones {CEST[filtro as EstadoComision]?.toLowerCase()}s</h3>
          <p>Probá con otro estado.</p>
        </div>
      ) : (
        <>
          <div className="card tbl-w cl">
            <table className="tbl">
              <thead>
                <tr><th>Fecha de pago</th><th>Cliente</th><th>Mes</th><th className="r">Cobrado</th><th className="r">Neto</th><th className="r">%</th><th className="r">Comisión</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {grupos.map((g, gi) => (
                  <Fragment key={`g-${gi}`}>
                    {agrupar && (
                      <tr className="grp">
                        <td colSpan={8}><b>{mesLargo(g.k)}</b>{g.items.length} {g.items.length === 1 ? 'pago' : 'pagos'}<span className="tot">{money(totalGrupo(g.items))}</span></td>
                      </tr>
                    )}
                    {g.items.map(x => (
                      <tr key={x.id} className={x.estado === 'revertida' ? 'rev' : ''}>
                        <td>{fd(x.fecha_pago)}</td>
                        <td>{x.terapeuta_nombre ?? '—'}</td>
                        <td className="mut tn">{x.mes_numero}/{resumen.meses_comision}</td>
                        <td className="r">{money(x.monto_cobrado)}</td>
                        <td className="r mut">{money(x.monto_neto)}</td>
                        <td className="r mut">{resumen.comision_pct}%</td>
                        <td className="r com-v">{money(x.monto_comision)}</td>
                        <td><span className={`bdg ${x.estado}`}>{CEST[x.estado as EstadoComision] ?? x.estado}</span></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {grupos.map((g, gi) => (
              <div key={`m-${gi}`}>
                {agrupar && <div className="mgrp"><b>{mesLargo(g.k)}</b><span className="tn">{money(totalGrupo(g.items))}</span></div>}
                {g.items.map(x => (
                  <div key={x.id} className={`card mc cm${x.estado === 'revertida' ? ' rev' : ''}`}>
                    <div className="row1"><b>{x.terapeuta_nombre ?? '—'}</b><span className="amt"><b>{money(x.monto_comision)}</b></span></div>
                    <div className="row2"><span>{fds(x.fecha_pago)} · mes {x.mes_numero}/{resumen.meses_comision} · cobró {money(x.monto_cobrado)}</span><span className="sp" /><span className={`bdg ${x.estado}`}>{CEST[x.estado as EstadoComision] ?? x.estado}</span></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec-t"><h2>Liquidaciones</h2><p>Transferencias de tus comisiones liquidadas</p></div>
      {liquidaciones.length === 0 && confirmadas.length === 0 ? (
        <div className="card">
          <div className="blank neutral inl">
            <div className="ic"><IconBank width={23} height={23} stroke="var(--muted)" strokeWidth={1.7} fill="none" /></div>
            <h3>Todavía no recibiste liquidaciones</h3>
            <p>La primera se transfiere el día 5 del mes siguiente a que se confirme tu primera comisión.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card tbl-w cl">
            <table className="tbl">
              <thead><tr><th>Fecha</th><th className="r">Comisiones</th><th>Clientes</th><th className="r">Total</th><th>Estado</th></tr></thead>
              <tbody>
                {confirmadas.length > 0 && (
                  <tr>
                    <td><b style={{ fontWeight: 600 }}>{fd(proximaLiquidacion())}</b></td>
                    <td className="r">{confirmadas.length}</td>
                    <td className="mut">Próxima liquidación</td>
                    <td className="r com-v">{money(confirmadas.reduce((a, x) => a + x.monto_comision, 0))}</td>
                    <td><span className="bdg confirmada">Programada</span></td>
                  </tr>
                )}
                {liquidaciones.map(l => (
                  <tr key={l.fecha} className="row" tabIndex={0} onClick={() => setLiqAbierta(l)} onKeyDown={e => { if (e.key === 'Enter') setLiqAbierta(l) }}>
                    <td>{fd(l.fecha)}</td>
                    <td className="r">{l.items.length}</td>
                    <td className="mut">{new Set(l.items.map(x => x.terapeuta_nombre)).size} clientes</td>
                    <td className="r com-v">{money(l.total)}</td>
                    <td><span className="bdg liquidada">Liquidada</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            <div className="card">
              <ul className="todo">
                {confirmadas.length > 0 && (
                  <li>
                    <div className="who"><b>{fd(proximaLiquidacion())} · próxima</b><span>{confirmadas.length} comisiones confirmadas</span></div>
                    <b className="tn">{money(confirmadas.reduce((a, x) => a + x.monto_comision, 0))}</b>
                  </li>
                )}
                {liquidaciones.map(l => (
                  <li key={l.fecha} role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => setLiqAbierta(l)}>
                    <div className="who"><b>{fd(l.fecha)}</b><span>{l.items.length} comisiones</span></div>
                    <b className="tn">{money(l.total)}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <VSlideOver open={!!liqAbierta} onClose={() => setLiqAbierta(null)}>
        {liqAbierta && (
          <>
            <div className="so-hdr">
              <div className="tt">
                <h3>Liquidación del {fd(liqAbierta.fecha)}</h3>
                <p>{liqAbierta.items.length} comisiones <span className="bdg liquidada">Liquidada</span></p>
              </div>
              <button className="so-close" type="button" onClick={() => setLiqAbierta(null)} aria-label="Cerrar">
                <IconX width={15} height={15} stroke="var(--ink-2)" strokeWidth={1.9} fill="none" />
              </button>
            </div>
            <div className="so-body">
              <section className="so-sec">
                <h4>Total</h4>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.025em' }} className="tn">{money(liqAbierta.total)}</div>
              </section>
              <section className="so-sec">
                <h4>Comisiones incluidas</h4>
                <div className="plist">
                  {liqAbierta.items.map(x => (
                    <div key={x.id}>
                      <span>{x.terapeuta_nombre ?? '—'} <span className="m">· {fds(x.fecha_pago)} · mes {x.mes_numero}/{resumen.meses_comision}</span></span>
                      <span className="m tn">{money(x.monto_cobrado)}</span>
                      <span className="a">{money(x.monto_comision)}</span>
                    </div>
                  ))}
                  <div className="tot"><span>Total transferido</span><span /><span className="a">{money(liqAbierta.total)}</span></div>
                </div>
              </section>
            </div>
            <div className="so-foot">
              <button className="btn" type="button" onClick={() => setLiqAbierta(null)}>Cerrar</button>
            </div>
          </>
        )}
      </VSlideOver>
    </>
  )
}

function Header() {
  return (
    <div className="pg-hd">
      <div className="tx"><h1>Mis comisiones</h1><p>Cada pago de tus clientes genera una comisión. Acá ves en qué estado está cada una.</p></div>
    </div>
  )
}

function Ayuda({ resumen }: { resumen: Resumen }) {
  return (
    <div className="card help">
      <span className="ic"><IconInfo width={16} height={16} stroke="var(--ink-2)" strokeWidth={1.7} fill="none" /></span>
      <div>
        <p><b>Cómo se calcula:</b> {resumen.comision_pct}% del neto de cada pago (lo que paga el cliente, sin IVA), durante {resumen.meses_comision} meses desde su primer pago.</p>
        <p><b>Cuándo se cobra:</b> la comisión queda devengada un tiempo por si hay reembolsos o contracargos. Después pasa a confirmada (liquidable) y se transfiere el día 5 del mes siguiente.</p>
        <div className="flow">
          <span className="bdg devengada">Devengada</span>
          <IconArrow width={12} height={12} stroke="var(--muted-3)" strokeWidth={2} fill="none" />
          <span className="bdg confirmada">Confirmada</span>
          <IconArrow width={12} height={12} stroke="var(--muted-3)" strokeWidth={2} fill="none" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>día 5</span>
          <IconArrow width={12} height={12} stroke="var(--muted-3)" strokeWidth={2} fill="none" />
          <span className="bdg liquidada">Liquidada</span>
        </div>
      </div>
    </div>
  )
}
