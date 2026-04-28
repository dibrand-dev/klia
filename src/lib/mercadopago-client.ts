// Public key for Mercado Pago Checkout Bricks (browser-safe)
export const MP_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_USE_PRODUCTION === 'true'
    ? process.env.NEXT_PUBLIC_MP_PUBLIC_KEY_PROD!
    : process.env.NEXT_PUBLIC_MP_PUBLIC_KEY_TEST!
