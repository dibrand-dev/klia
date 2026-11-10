'use client'

import { useMemo, useState } from 'react'
import type { Database } from '@/types/database'
import type { VendedorPerfil } from '@/lib/vendedor/auth'
import VSlideOver from './VSlideOver'
import { IconMail, IconSearch, IconShare, IconWa, IconX, IconLock } from '@/app/vendedor/icons'
import {
  money, fd, rel, iniciales, nombreCompleto, diasLabel, diasClase, colorAvatar,
  estadoCliente, ESTADO_LABEL, waUrl, mailUrl, type EstadoCliente,
} from '@/app/vendedor/utils'

type Resumen = Database['public']['Functions']['vendedor_get_resumen']['Returns'][number]
type Cliente = Database['public']['Functions']['vendedor_get_clientes']['Returns'][number]

interface Props {
  clientes: Cliente[]
  perfil: VendedorPerfil | null
  resumen: Resumen
  filtroInicial?: string
}

const FILTROS: { k: EstadoCliente | 'todos'; l: string }[] = [
  { k: 'todos', l: 'Todos' }, { k: 'trial', l: 'Trial' }, { k: 'pagando', l: 'Pagando' }, { k: 'bloqueado', l: 'Bloqueados' },
]

function Avance({ c, mesesComision }: { c: Cliente; mesesComision: number }) {
  const estado = estadoCliente(c.estado_cuenta)
  if (estado === 'trial') return <span className={`due ${diasClase(c.dias_trial_restantes)}`}>{diasLabel(c.dias_trial_restantes)}</span>
  if (estado === 'pagando') {
    const mes = c.mes_comision ?? 0
    const fin = mes >= mesesComision
    return (
      <span className={`prog${fin ? ' end' : ''}`}>
        <span className="bars">{Array.from({ length: mesesComision }, (_, i) => <i key={i} className={i < mes ? 'on' : ''} />)}</span>
        <span>{mes}/{mesesComision}</span>
        {fin && <span className="mut" style={{ fontSize: 12, marginLeft: 4 }}>Finalizó</span>}
      </span>
    )
  }
  return <span className="mut">{c.estado_cuenta === 'cancelada' ? 'Cuenta cancelada' : 'Cuenta bloqueada'}</span>
}

function ContactoBtns({ c }: { c: Cliente }) {
  const nombre = nombreCompleto(c.nombre, c.apellido)
  return (
    <div className="acts">
      <a className="ib" href={mailUrl(c.email, 'KLIA')} title="Email" aria-label={`Email a ${nombre}`} onClick={e => e.stopPropagation()}>
        <IconMail width={15} height={15} stroke="var(--muted)" strokeWidth={1.7} fill="none" />
      </a>
      {c.telefono && (
        <a className="ib" href={waUrl(c.telefono, `Hola ${c.nombre}, soy de KLIA. ¿Cómo te está yendo con la app?`)} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label={`WhatsApp a ${nombre}`} onClick={e => e.stopPropagation()}>
          <IconWa width={15} height={15} />
        </a>
      )}
    </div>
  )
}

export default function ClientesClient({ clientes, perfil, resumen, filtroInicial }: Props) {
  const [filtro, setFiltro] = useState<EstadoCliente | 'todos'>((filtroInicial as EstadoCliente) ?? 'todos')
  const [busq, setBusq] = useState('')
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null)

  const filtrados = useMemo(() => {
    const q = busq.trim().toLowerCase()
    return clientes
      .filter(c => (filtro === 'todos' || estadoCliente(c.estado_cuenta) === filtro) && (!q || nombreCompleto(c.nombre, c.apellido).toLowerCase().includes(q)))
      .sort((a, b) => {
        const oa = { trial: 0, pagando: 1, bloqueado: 2 }[estadoCliente(a.estado_cuenta)]
        const ob = { trial: 0, pagando: 1, bloqueado: 2 }[estadoCliente(b.estado_cuenta)]
        if (oa !== ob) return oa - ob
        if (estadoCliente(a.estado_cuenta) === 'trial') return (a.dias_trial_restantes ?? 999) - (b.dias_trial_restantes ?? 999)
        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      })
  }, [clientes, filtro, busq])

  const cnt = (k: EstadoCliente | 'todos') => k === 'todos' ? clientes.length : clientes.filter(c => estadoCliente(c.estado_cuenta) === k).length

  if (clientes.length === 0) {
    return (
      <>
        <Header perfil={perfil} />
        <EmptyShare />
      </>
    )
  }

  return (
    <>
      <Header perfil={perfil} />
      <div className="tools">
        <label className="srch">
          <IconSearch width={15} height={15} stroke="var(--muted-2)" strokeWidth={1.8} fill="none" />
          <input type="search" placeholder="Buscar por nombre" value={busq} onChange={e => setBusq(e.target.value)} aria-label="Buscar por nombre" />
        </label>
        <div className="seg" role="tablist">
          {FILTROS.map(({ k, l }) => (
            <button key={k} type="button" className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>{l}<i>{cnt(k)}</i></button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="blank neutral">
          <div className="ic"><IconSearch width={23} height={23} stroke="var(--muted)" strokeWidth={1.7} fill="none" /></div>
          <h3>No encontramos clientes{busq ? ` con "${busq}"` : ''}</h3>
          <p>Probá con otro nombre o cambiá el filtro de estado.</p>
          <div className="acts"><button className="btn lg" type="button" onClick={() => { setFiltro('todos'); setBusq('') }}>Ver todos</button></div>
        </div>
      ) : (
        <>
          <div className="card tbl-w cl">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Profesional</th><th>Plan</th><th>Estado</th><th>Trial / comisión</th><th>Alta</th>
                  <th>Último ingreso</th><th className="r">Pacientes</th><th className="r">Turnos</th><th className="r">Contacto</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id} className="row" tabIndex={0} onClick={() => setSeleccionado(c)} onKeyDown={e => { if (e.key === 'Enter') setSeleccionado(c) }}>
                    <td>
                      <div className="pn">
                        <div className="av sm" style={{ background: colorAvatar(c.id) }}>{iniciales(c.nombre, c.apellido)}</div>
                        <div style={{ minWidth: 0 }}><b>{nombreCompleto(c.nombre, c.apellido)}</b><span>{c.especialidad ?? 'Sin especialidad'}</span></div>
                      </div>
                    </td>
                    <td>{c.plan}</td>
                    <td><span className={`bdg ${estadoCliente(c.estado_cuenta)}`}>{ESTADO_LABEL[estadoCliente(c.estado_cuenta)]}</span></td>
                    <td><Avance c={c} mesesComision={resumen.meses_comision} /></td>
                    <td className="mut">{fd(c.created_at)}</td>
                    <td className="mut">{rel(c.last_sign_in_at)}</td>
                    <td className="r">{c.pacientes.toLocaleString('es-AR')}</td>
                    <td className="r">{c.turnos.toLocaleString('es-AR')}</td>
                    <td><ContactoBtns c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mlist">
            {filtrados.map(c => (
              <div key={c.id} className="card mc" role="button" tabIndex={0} onClick={() => setSeleccionado(c)} onKeyDown={e => { if (e.key === 'Enter') setSeleccionado(c) }}>
                <div className="top">
                  <div className="av" style={{ background: colorAvatar(c.id) }}>{iniciales(c.nombre, c.apellido)}</div>
                  <div className="who"><b>{nombreCompleto(c.nombre, c.apellido)}</b><span>{c.especialidad ?? 'Sin especialidad'} · {c.plan}</span></div>
                  <span className={`bdg ${estadoCliente(c.estado_cuenta)}`}>{ESTADO_LABEL[estadoCliente(c.estado_cuenta)]}</span>
                </div>
                <div className="facts">
                  <div><small>Pacientes</small><b>{c.pacientes.toLocaleString('es-AR')}</b></div>
                  <div><small>Turnos</small><b>{c.turnos.toLocaleString('es-AR')}</b></div>
                  <div><small>Último ingreso</small><b>{rel(c.last_sign_in_at)}</b></div>
                </div>
                <div className="bot">
                  <div style={{ minWidth: 0 }}>
                    <Avance c={c} mesesComision={resumen.meses_comision} />
                    <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>Alta {fd(c.created_at)}</div>
                  </div>
                  <span className="sp" />
                  <ContactoBtns c={c} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <VSlideOver open={!!seleccionado} onClose={() => setSeleccionado(null)}>
        {seleccionado && <DetalleCliente c={seleccionado} perfil={perfil} resumen={resumen} onClose={() => setSeleccionado(null)} />}
      </VSlideOver>
    </>
  )
}

function Header({ perfil }: { perfil: VendedorPerfil | null }) {
  return (
    <div className="pg-hd">
      <div className="tx">
        <h1>Mis clientes</h1>
        <p>Profesionales registrados con tu código{perfil?.codigo ? <> <b style={{ fontFamily: 'var(--font-jbmono), monospace', fontWeight: 500, color: 'var(--ink-2)' }}>{perfil.codigo}</b></> : ''}. Solo ves datos de cuenta y cantidades, nunca información clínica.</p>
      </div>
    </div>
  )
}

function EmptyShare() {
  return (
    <div className="blank">
      <div className="ic"><IconShare width={23} height={23} stroke="var(--accent-ink)" strokeWidth={1.7} fill="none" /></div>
      <h3>Tu primer cliente está a un mensaje de distancia</h3>
      <p>Compartí tu código con los profesionales. Lo ingresan al configurar su cuenta (paso de onboarding) o en Ajustes &gt; Suscripción, y obtienen su descuento.</p>
    </div>
  )
}

function DetalleCliente({ c, perfil, resumen, onClose }: { c: Cliente; perfil: VendedorPerfil | null; resumen: Resumen; onClose: () => void }) {
  const estado = estadoCliente(c.estado_cuenta)
  const nombre = nombreCompleto(c.nombre, c.apellido)
  const mes = c.mes_comision ?? 0
  const fin = mes >= resumen.meses_comision

  const tl: { t: string; f: string | null; s: string; done: boolean }[] = [
    { t: 'Alta con tu código', f: c.created_at, s: perfil?.codigo ? `Se registró con ${perfil.codigo}` : 'Se registró con tu código', done: true },
  ]
  if (estado === 'trial') tl.push({ t: 'Fin del trial', f: c.trial_fin, s: diasLabel(c.dias_trial_restantes), done: false })
  else if (c.trial_fin && !c.primer_pago) tl.push({ t: 'Fin del trial', f: c.trial_fin, s: 'Terminó sin pago', done: true })
  if (c.primer_pago) tl.push({ t: 'Primer pago', f: c.primer_pago, s: `Empieza tu comisión · mes 1/${resumen.meses_comision}`, done: true })
  tl.push({ t: 'Último ingreso', f: c.last_sign_in_at, s: rel(c.last_sign_in_at), done: true })
  const tlOrdenado = tl.filter(x => x.f).sort((a, b) => (a.f as string).localeCompare(b.f as string))

  return (
    <>
      <div className="so-hdr">
        <div className="av lg" style={{ background: colorAvatar(c.id) }}>{iniciales(c.nombre, c.apellido)}</div>
        <div className="tt">
          <h3>{nombre}</h3>
          <p>{c.especialidad ?? 'Sin especialidad'} <span className={`bdg ${estado}`}>{ESTADO_LABEL[estado]}</span></p>
        </div>
        <button className="so-close" type="button" onClick={onClose} aria-label="Cerrar">
          <IconX width={15} height={15} stroke="var(--ink-2)" strokeWidth={1.9} fill="none" />
        </button>
      </div>
      <div className="so-body">
        <section className="so-sec">
          <h4>Contacto</h4>
          <dl className="dl">
            <dt>Email</dt><dd><a href={mailUrl(c.email, 'KLIA')}>{c.email}</a></dd>
            <dt>Teléfono</dt><dd>{c.telefono ?? '—'}</dd>
          </dl>
        </section>
        <section className="so-sec">
          <h4>Plan</h4>
          <dl className="dl">
            <dt>Plan</dt><dd style={{ textTransform: 'capitalize' }}>{c.plan}</dd>
            {perfil?.descuentoPct != null && estado === 'trial' && <><dt>Descuento</dt><dd>{perfil.descuentoPct}% con tu código</dd></>}
          </dl>
        </section>
        <section className="so-sec">
          <h4>Uso de KLIA</h4>
          <div className="mini">
            <div><small>Pacientes</small><b>{c.pacientes.toLocaleString('es-AR')}</b></div>
            <div><small>Turnos</small><b>{c.turnos.toLocaleString('es-AR')}</b></div>
            <div><small>Último ingreso</small><b style={{ fontSize: 14 }}>{rel(c.last_sign_in_at)}</b></div>
          </div>
          <div className="priv">
            <IconLock width={14} height={14} stroke="var(--muted-2)" strokeWidth={1.8} fill="none" />
            <span>Solo ves cantidades. Los datos de pacientes y las historias clínicas son confidenciales (Ley 26.529).</span>
          </div>
        </section>
        <section className="so-sec">
          <h4>Línea de tiempo</h4>
          <ol className="tl">
            {tlOrdenado.map((x, i) => (
              <li key={i} className={x.done ? 'done' : 'fut'}>
                <span className="pt" /><span><b>{x.t}</b><small>{x.s}</small></span><time>{fd(x.f)}</time>
              </li>
            ))}
          </ol>
        </section>
        <section className="so-sec">
          <h4>Tus comisiones por este cliente</h4>
          {c.primer_pago ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span className={`prog${fin ? ' end' : ''}`}>
                  <span className="bars">{Array.from({ length: resumen.meses_comision }, (_, i) => <i key={i} className={i < mes ? 'on' : ''} />)}</span>
                  <span>{mes}/{resumen.meses_comision}</span>
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 8 }}>
                  {fin ? `Completó los ${resumen.meses_comision} meses` : estado === 'bloqueado' ? 'Sin pagos nuevos' : `Quedan ${resumen.meses_comision - mes} meses`}
                </span>
              </div>
              <div className="mini">
                <div><small>Generada</small><b>{money(c.comision_generada)}</b></div>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
              {estado === 'trial' ? `Todavía no pagó. Si confirma su plan, vas a empezar a generar comisión durante ${resumen.meses_comision} meses.` : 'No generó comisiones: el trial terminó sin pago.'}
            </p>
          )}
        </section>
      </div>
      <div className="so-foot">
        <a className="btn" href={mailUrl(c.email, 'KLIA')}><IconMail width={14} height={14} stroke="currentColor" strokeWidth={1.8} fill="none" />Email</a>
        {c.telefono && (
          <a className="btn primary" href={waUrl(c.telefono, `Hola ${c.nombre}, soy de KLIA. ¿Cómo te está yendo con la app?`)} target="_blank" rel="noopener noreferrer">
            <IconWa width={14} height={14} />WhatsApp
          </a>
        )}
      </div>
    </>
  )
}
