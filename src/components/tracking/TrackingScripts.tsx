'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'

// Páginas públicas con token de paciente (datos de salud/plan en la URL/contenido):
// nunca cargan Pixel ni GTM. El resto de las rutas públicas (booking, pagar, landing) sigue igual.
const RUTAS_SIN_TRACKING = ['/p/antropometria', '/p/plan']

export function TrackingScripts() {
  const pathname = usePathname()
  if (RUTAS_SIN_TRACKING.some((r) => pathname?.startsWith(r))) return null

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
