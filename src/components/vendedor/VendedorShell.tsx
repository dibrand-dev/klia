'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { IconCoins, IconHome, IconOut, IconUsers } from '@/app/vendedor/icons'
import { iniciales } from '@/app/vendedor/utils'

const NAV = [
  { href: '/vendedor', label: 'Resumen', Icon: IconHome },
  { href: '/vendedor/clientes', label: 'Clientes', Icon: IconUsers },
  { href: '/vendedor/comisiones', label: 'Comisiones', Icon: IconCoins },
]

interface Props {
  nombre: string
  apellido: string
  email: string
  children: React.ReactNode
}

export default function VendedorShell({ nombre, apellido, email, children }: Props) {
  const pathname = usePathname()
  const esActivo = (href: string) => (href === '/vendedor' ? pathname === href : pathname.startsWith(href))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/vendedor/login'
  }

  const inic = iniciales(nombre, apellido)

  return (
    <div className="app vend">
      <aside className="side">
        <div className="side-head">
          <img src="/logo.svg" alt="Klia" className="brand-logo" />
          <div className="brand-sub">Acceso Comercial</div>
        </div>
        <nav className="nav">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={esActivo(href) ? 'active' : ''}>
              <Icon />
              <span className="label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me">
            <div className="me-av">{inic}</div>
            <div style={{ minWidth: 0 }}>
              <div className="me-name">{nombre} {apellido}</div>
              <div className="me-email">{email}</div>
            </div>
          </div>
          <nav className="nav">
            <a className="out" href="#" onClick={e => { e.preventDefault(); handleLogout() }}>
              <IconOut />
              <span className="label">Salir</span>
            </a>
          </nav>
        </div>
      </aside>

      <div className="main">
        <header className="mtop">
          <img src="/logo.svg" alt="Klia" />
          <span className="sub">Comercial</span>
          <span className="sp" />
          <div className="me-av" title={`${nombre} ${apellido}`}>{inic}</div>
        </header>
        <main className="wrap">{children}</main>
      </div>

      <nav className="tabbar" aria-label="Navegación">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={esActivo(href) ? 'on' : ''}>
            <Icon />
            {label}
          </Link>
        ))}
        <a href="#" onClick={e => { e.preventDefault(); handleLogout() }}>
          <IconOut />
          Salir
        </a>
      </nav>
    </div>
  )
}
