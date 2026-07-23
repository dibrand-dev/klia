export async function POST() {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    console.error('REVALIDATE_SECRET no configurado')
    return Response.json({ ok: false }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://www.klia.com.ar/api/revalidate?secret=${secret}`,
      { method: 'POST' }
    )
    if (!res.ok) {
      console.error('Revalidate landing falló:', res.status)
      return Response.json({ ok: false }, { status: 502 })
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error llamando a revalidate landing:', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
