import PlanesClient from './PlanesClient'

export default function PlanesPage() {
  const isProduction = process.env.MP_USE_PRODUCTION === 'true'
  const mpPublicKey = isProduction
    ? (process.env.MP_PUBLIC_KEY_PROD ?? '')
    : (process.env.MP_PUBLIC_KEY_TEST ?? '')
  return <PlanesClient mpPublicKey={mpPublicKey} />
}
