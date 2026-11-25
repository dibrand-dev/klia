'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'

// Allowlist: Pixel/GTM cargan SOLO en estas rutas (adquisición/conversión). Todo lo
// autenticado (pacientes, agenda, atenciones, cobros, ajustes, informes, /ops, /vendedor,
// /portal, etc.) queda afuera por default — no hace falta listarlo.
//
// '/' y '/registro' son redirects server-side a la landing (klia-landing, otro repo): nunca
// pintan <body> en el navegador, así que no hay nada que trackear acá aunque se incluyeran.
// '/login' en producción es el mismo caso (solo renderiza form propio en staging) y
// '/recuperar'/'/nueva-contrasena' son utilidades para usuarios existentes, no funnel de
// adquisición — no se encontró necesidad de atribución para ninguna de las tres, quedan afuera.
const RUTAS_PERMITIDAS = [
  '/bienvenida', // dispara fbq('track', 'CompleteRegistration') en BienvenidaClient.tsx
  '/p', // booking público (/p/[slug]) — excepto antropometría/plan, ver RUTAS_EXCLUIDAS
  '/pagar', // pago de sesión particular (link enviado al paciente)
]

// Dentro de /p: antropometría y plan llevan datos de salud/plan del paciente en la
// URL/contenido — nunca tracking, aunque /p esté en la allowlist de arriba.
const RUTAS_EXCLUIDAS = ['/p/antropometria', '/p/plan']

/** Coincidencia por segmento completo: pathname === ruta, o ruta es un segmento padre
 * completo de pathname. Nunca por prefijo suelto (p. ej. '/p' no matchea '/pagar'). */
function coincideSegmento(pathname: string, ruta: string): boolean {
  return pathname === ruta || pathname.startsWith(`${ruta}/`)
}

export function TrackingScripts() {
  const pathname = usePathname()
  if (!pathname) return null
  if (RUTAS_EXCLUIDAS.some((r) => coincideSegmento(pathname, r))) return null
  if (!RUTAS_PERMITIDAS.some((r) => coincideSegmento(pathname, r))) return null

  return (
    <>
      {/* Google Tag Manager */}
      <Script id="gtm" strategy="beforeInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NRJKS2G7');`}
      </Script>
      <noscript>
        <iframe
          src="https://www.googletagmanager.com/ns.html?id=GTM-NRJKS2G7"
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        ></iframe>
      </noscript>
      {/* Meta Pixel */}
      <Script id="meta-pixel" strategy="beforeInteractive">
        {`!function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '1330774269119331');
        fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src="https://www.facebook.com/tr?id=1330774269119331&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
    </>
  )
}
