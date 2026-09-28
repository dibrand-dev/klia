/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bdokvwturcbebsjxtbpi.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Link público de plan alimentario — maneja datos de salud, nunca
        // debe indexarse ni cachearse, y el Referer no debe filtrar la URL
        // (con el token) hacia sitios externos que se linkeen desde ahí.
        source: '/p/plan/:token',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
