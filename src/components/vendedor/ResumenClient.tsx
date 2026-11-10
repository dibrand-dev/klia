'use client'

import Link from 'next/link'
import type { Database } from '@/types/database'
import type { VendedorPerfil } from '@/lib/vendedor/auth'
import { IconCheck, IconCopy, IconMail, IconShare, IconWa } from '@/app/vendedor/icons'
import { money, fds, rel, iniciales, nombreCompleto, diasLabel, diasClase, waUrl, mailUrl } from '@/app/vendedor/utils'
import { useToast, copiarAlPortapapeles } from '@/app/vendedor/Toast'

type Resumen = Database['public']['Functions']['vendedor_get_resumen']['Returns'][number]
type Cliente = Database['public']['Functions']['vendedor_get_clientes']['Returns'][number]

interface Props {
  resumen: Resumen
  clientes: Cliente[]
  perfil: VendedorPerfil | null
}

function ContactoBtns({ c }: { c: Cliente }) {
  const nombre = nombreCompleto(c.nombre, c.apellido)
  const msg = `Hola ${c.nombre}, soy de KLIA. Vi que tu prueba gratis ${c.dias_trial_restantes != null && c.dias_trial_restantes <= 1 ? (c.dias_trial_restantes === 0 ? 'vence hoy' : 'vence mañana') : 'está por vencer'}. ¿Te ayudo con algo para que sigas usando la agenda?`
  return (
    <div className="acts">
      <a className="ib" href={mailUrl(c.email, `KLIA`)} title="Email" aria-label={`Email a ${nombre}`}>
        <IconMail width={15} height={15} stroke="var(--muted)" strokeWidth={1.7} fill="none" />
      </a>
      {c.telefono && (
        <a className="ib" href={waUrl(c.telefono, msg)} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label={`WhatsApp a ${nombre}`}>
          <IconWa width={15} height={15} />
        </a>
      )}
    </div>
  )
}

export default function ResumenClient({ resumen, clientes, perfil }: Props) {
  const toast = useToast()
  const nombre = perfil?.nombre || 'vendedor/a'

  if (resumen.registrados === 0) {
    return (
      <>
        <Header perfil={perfil} nombre={nombre} toast={toast} />
        <EmptyShare />
      </>
    )
  }

  const trials = clientes
    .filter(c => c.estado_cuenta === 'trial')
    .sort((a, b) => (a.dias_trial_restantes ?? 999) - (b.dias_trial_restantes ?? 999))
    .slice(0, 4)

  const hot = clientes.some(c => c.estado_cuenta === 'trial' && (c.dias_trial_restantes ?? 999) <= 1)
  const porVencer = clientes.filter(c => c.estado_cuenta === 'trial' && (c.dias_trial_restantes ?? 999) <= 7).length

  return (
    <>
      <Header perfil={perfil} nombre={nombre} toast={toast} />

      <div className="kpis">
        <Link href="/vendedor/clientes" className="card kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="lb">Registrados</span><span className="v">{resumen.registrados}</span>
          <span className="nt">{perfil?.codigo ? `Con tu código ${perfil.codigo}` : 'Con tu código'}</span>
        </Link>
        <Link href="/vendedor/clientes?f=trial" className="card kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="lb">En trial</span><span className="v">{resumen.en_trial}</span>
          <span className="nt">21 días de prueba gratis</span>
        </Link>
        <Link href="/vendedor/clientes?f=trial" className={`card kpi${porVencer ? ` alert${hot ? ' hot' : ''}` : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="lb">Trials por vencer</span><span className="v">{resumen.trials_por_vencer}</span>
          <span className="nt">{porVencer ? 'Vencen en los próximos 7 días' : 'Ninguno vence esta semana'}</span>
        </Link>
        <Link href="/vendedor/clientes?f=pagando" className="card kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="lb">Pagando</span><span className="v">{resumen.pagando}</span>
          <span className="nt">{resumen.pagando ? 'Generan comisión todos los meses' : 'Todavía ninguno'}</span>
        </Link>
        <Link href="/vendedor/clientes?f=bloqueado" className="card kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="lb">Bloqueados</span><span className="v">{resumen.bloqueados}</span>
          <span className="nt">{resumen.bloqueados ? 'Trial vencido o pago rechazado' : 'Ninguno'}</span>
        </Link>
      </div>

      <div className="sec-t"><h2>Comisiones</h2></div>
      <div className="card">
        <div className="com">
          <div><span className="lb"><i className="sw mes" />Este mes</span><div className="v">{money(resumen.comision_mes)}</div><div className="nt">Generada este mes</div></div>
          <div><span className="lb"><i className="sw dev" />Por cobrar</span><div className="v">{money(resumen.comision_por_cobrar)}</div><div className="nt">Devengada, en días de espera</div></div>
          <div><span className="lb"><i className="sw con" />Liquidable</span><div className="v">{money(resumen.comision_liquidable)}</div><div className="nt">Se paga el día 5 del próximo mes</div></div>
          <div><span className="lb"><i className="sw liq" />Ya liquidada</span><div className="v">{money(resumen.comision_liquidada)}</div><div className="nt">Transferida a tu cuenta</div></div>
          <div className="proj"><span className="lb"><i className="sw pro" />Proyección mensual</span><div className="v">{money(resumen.proyeccion_mensual)}</div><div className="nt">Si tus clientes activos siguen pagando</div></div>
        </div>
        <div className="cfoot">
          <span>Ganás <b>{resumen.comision_pct}%</b> del neto de cada pago durante <b>{resumen.meses_comision} meses</b> desde el primer pago.</span>
          <span className="sp" />
          <Link href="/vendedor/comisiones">Ver comisiones</Link>
        </div>
      </div>

      <div className="sec-t"><h2>Para actuar hoy</h2><p>Trials que vencen primero</p></div>
      {trials.length === 0 ? (
        <div className="card">
          <div className="blank neutral inl">
            <div className="ic"><IconCheck width={23} height={23} stroke="var(--muted)" strokeWidth={1.7} fill="none" /></div>
            <h3>No hay trials para seguir hoy</h3>
            <p>Cuando alguien registrado con tu código esté por terminar la prueba gratis, lo vas a ver acá.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <ul className="todo">
            {trials.map(c => (
              <li key={c.id}>
                <div className="av" style={{ background: '#D6E0F5' }}>{iniciales(c.nombre, c.apellido)}</div>
                <div className="who">
                  <b>{nombreCompleto(c.nombre, c.apellido)}</b>
                  <span>{c.especialidad ?? 'Sin especialidad'} · {c.pacientes} pacientes · {c.turnos} turnos</span>
                </div>
                <span className={`due ${diasClase(c.dias_trial_restantes)}`}>{diasLabel(c.dias_trial_restantes)}</span>
                <ContactoBtns c={c} />
              </li>
            ))}
          </ul>
          <div className="cfoot">
            <span>Ordenados por fecha de vencimiento.</span>
            <span className="sp" />
            <Link href="/vendedor/clientes?f=trial">Ver todos los trials</Link>
          </div>
        </div>
      )}
    </>
  )
}

function Header({ perfil, nombre, toast }: { perfil: VendedorPerfil | null; nombre: string; toast: (m: string) => void }) {
  return (
    <div className="pg-hd">
      <div className="tx">
        <h1>Hola, {nombre}</h1>
        <p>Así vienen los profesionales que se registraron con tu código.</p>
      </div>
      <div className="acts">
        {perfil?.codigo && (
          <span className="code-chip">
            <span className="lb">Tu código</span><b>{perfil.codigo}</b>
            <button type="button" onClick={() => copiarAlPortapapeles(perfil.codigo!, toast, 'Código copiado')} aria-label="Copiar código" title="Copiar código">
              <IconCopy width={14} height={14} stroke="var(--ink-2)" strokeWidth={1.8} fill="none" />
            </button>
          </span>
        )}
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
      <div className="steps">
        <div><span className="n">1</span><span><b>Compartí tu código</b>Por WhatsApp, Instagram o email.</span></div>
        <div><span className="n">2</span><span><b>Prueban 21 días gratis</b>Vas a ver cuándo se registran y cuándo vence la prueba.</span></div>
        <div><span className="n">3</span><span><b>Cobrás tu comisión</b>Desde el primer pago, todos los meses.</span></div>
      </div>
    </div>
  )
}
