import { requireVendedor, getClientes, getComisiones } from '@/lib/vendedor/auth'

// TEMPORAL: sin diseño todavía (ver prompt), solo para verificar que el
// login + guard + las 3 RPC funcionan de punta a punta. Se reemplaza por la
// UI real cuando llegue el diseño del panel del vendedor.
export default async function VendedorPage() {
  const [resumen, clientes, comisiones] = await Promise.all([
    requireVendedor(),
    getClientes(),
    getComisiones(),
  ])

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13 }}>
      <h1>Panel de vendedores (temporal, sin diseño)</h1>
      <h2>Resumen</h2>
      <pre>{JSON.stringify(resumen, null, 2)}</pre>
      <h2>Clientes</h2>
      <pre>{JSON.stringify(clientes, null, 2)}</pre>
      <h2>Comisiones</h2>
      <pre>{JSON.stringify(comisiones, null, 2)}</pre>
    </div>
  )
}
