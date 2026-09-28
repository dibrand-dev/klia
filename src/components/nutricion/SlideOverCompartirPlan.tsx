'use client'

import { useEffect, useState } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'
import SlideOver from '@/components/ui/SlideOver'
import type { PlanAlimentario, Paciente } from '@/types/database'

// 'AR' como país default: hoy no guardamos el país del paciente en la ficha,
// así que asumimos Argentina (caso dominante en KLIA). Revisar esto cuando se
// agregue el selector de país al formulario de pacientes.
function telefonoWhatsappValido(telefono: string | null): string | null {
  if (!telefono) return null
  const numero = parsePhoneNumberFromString(telefono, 'AR')
  if (!numero || !numero.isValid()) return null
  return numero.number
}

interface ShareRow {
  token: string
  creado_en: string
  vence_en: string | null
  enviado_a: string | null
  enviado_en: string | null
}

interface Props {
  plan: PlanAlimentario
  paciente: Paciente
  readOnly: boolean
  open: boolean
  onClose: () => void
  onAbrirDetalles: () => void
  onShareChanged: (activo: boolean) => void
}

const ICON_X = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M6 6l12 12M18 6l-12 12" /></svg>
const ICON_LINK = <svg viewBox="0 0 24 24" style={{ width: 21, height: 21, stroke: 'var(--accent-ink, #1F4FD9)', strokeWidth: 1.7, fill: 'none' }}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>
const ICON_EXT = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M14 3h7v7M21 3l-9 9M19 14v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></svg>
const ICON_COPY = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>
const ICON_CHAT = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1-5.4A8.5 8.5 0 1 1 21 11.5z" /></svg>
const ICON_MAIL = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
const ICON_CHEVR = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--muted-3, #AEB5C0)', strokeWidth: 1.9, fill: 'none', marginLeft: 'auto' }}><path d="M9 6l6 6-6 6" /></svg>
const ICON_CHECK = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>
const ICON_CHECKBOX = <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: '#fff', strokeWidth: 3, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>
const ICON_WARN = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--warn, #A65A06)', strokeWidth: 1.9, fill: 'none', flexShrink: 0, marginTop: 2 }}><path d="M12 9v4M12 17h.01M10.3 3.9L2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
const ICON_UNLINK = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none' }}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1M3 3l18 18" /></svg>
const ICON_EYE = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none' }}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></svg>

const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

export default function SlideOverCompartirPlan({ plan, paciente, readOnly, open, onClose, onAbrirDetalles, onShareChanged }: Props) {
  const [cargando, setCargando] = useState(true)
  const [share, setShare] = useState<ShareRow | null>(null)
  const [ultimoRevocadoEn, setUltimoRevocadoEn] = useState<string | null>(null)
  const [profesionalNombre, setProfesionalNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revocando, setRevocando] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const [mailTo, setMailTo] = useState('')
  const [mailAsunto, setMailAsunto] = useState('')
  const [mailMensaje, setMailMensaje] = useState('')
  const [mailGuardar, setMailGuardar] = useState(true)
  const [mailTouched, setMailTouched] = useState(false)
  const [mailEnviando, setMailEnviando] = useState(false)
  const [flash, setFlash] = useState<'link' | 'wa' | null>(null)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar').replace(/\/$/, '')
  const pacienteEmail = paciente.email ?? ''
  const pacientePrimer = paciente.nombre

  useEffect(() => {
    if (!open) return
    let cancelado = false
    setCargando(true)
    setConfirmRevoke(false)
    setMailOpen(false)
    fetch(`/api/planes-alimentarios/${plan.id}/compartir`)
      .then((r) => jsonOrNull(r))
      .then((data) => {
        if (cancelado) return
        setShare(data?.share ?? null)
        setUltimoRevocadoEn(data?.ultimoRevocadoEn ?? null)
        setProfesionalNombre(data?.profesionalNombre ?? '')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [open, plan.id])

  useEffect(() => {
    if (!mailOpen) return
    setMailTo(pacienteEmail)
    setMailAsunto(`Tu plan alimentario — ${plan.nombre}`)
    setMailMensaje('')
    setMailGuardar(true)
    setMailTouched(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailOpen])

  const telefonoE164 = telefonoWhatsappValido(paciente.telefono)

  function shareUrl(s: ShareRow) { return `${appUrl}/p/plan/${s.token}` }
  // wa.me quiere el número en dígitos, sin el "+" del formato E.164.
  function waHref(s: ShareRow) { return `https://wa.me/${telefonoE164!.replace('+', '')}?text=${encodeURIComponent(waMsg(s))}` }
  function waMsg(s: ShareRow) {
    return `Hola ${pacientePrimer}, te comparto tu plan alimentario: ${shareUrl(s)}\nLo podés abrir desde el celular cuando quieras. Si hago cambios, los vas a ver en el mismo link.${profesionalNombre ? `\n${profesionalNombre}` : ''}`
  }
  function copyText(t: string) { try { navigator.clipboard.writeText(t).catch(() => {}) } catch { /* noop */ } }

  async function crearLink() {
    setCreando(true)
    try {
      const res = await fetch(`/api/planes-alimentarios/${plan.id}/compartir`, { method: 'POST' })
      const data = await jsonOrNull(res)
      if (res.ok && data?.share) {
        setShare(data.share)
        onShareChanged(true)
      }
    } finally {
      setCreando(false)
    }
  }

  async function cambiarVencimiento(exp: 'none' | '30' | '90') {
    const res = await fetch(`/api/planes-alimentarios/${plan.id}/compartir`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exp }),
    })
    const data = await jsonOrNull(res)
    if (res.ok && data?.share) setShare(data.share)
  }

  async function revocar() {
    setRevocando(true)
    try {
      const res = await fetch(`/api/planes-alimentarios/${plan.id}/compartir`, { method: 'DELETE' })
      if (res.ok) {
        setShare(null)
        setUltimoRevocadoEn(new Date().toISOString())
        setConfirmRevoke(false)
        onShareChanged(false)
      }
    } finally {
      setRevocando(false)
    }
  }

  function mailError(): string {
    if (!mailTo.trim()) return mailTouched ? 'Escribí un email para poder enviar el link.' : ''
    return EMAIL_RE.test(mailTo.trim()) ? '' : 'Revisá el formato del email.'
  }

  async function enviarMail() {
    if (mailEnviando) return
    setMailEnviando(true)
    try {
      const res = await fetch(`/api/planes-alimentarios/${plan.id}/compartir/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mailTo.trim(), asunto: mailAsunto, mensaje: mailMensaje, guardar_en_ficha: !pacienteEmail && mailGuardar }),
      })
      const data = await jsonOrNull(res)
      if (!res.ok || data?.error) {
        setMailTouched(true)
        setMailEnviando(false)
        return
      }
      setShare((prev) => (prev ? { ...prev, enviado_a: data.enviado_a, enviado_en: data.enviado_en } : prev))
      setMailOpen(false)
    } finally {
      setMailEnviando(false)
    }
  }

  const faltan: string[] = []
  if (!plan.objetivo_titulo?.trim()) faltan.push('objetivo')
  if (!plan.fecha_fin) faltan.push('vigencia')
  if (!plan.indicaciones?.trim()) faltan.push('indicaciones')
  const mostrarFaltan = faltan.length > 0 && !readOnly

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Compartir con el paciente"
      subtitle={plan.nombre}
      width="md"
      footer={
        <div style={{ padding: '12px 16px', background: 'var(--surface-2, #F6F7F9)', borderTop: '1px solid var(--border, #E7E9EE)' }}>
          <button type="button" onClick={onClose} className="btn" style={{ width: '100%', justifyContent: 'center' }}>Listo</button>
        </div>
      }
    >
      {cargando ? (
        <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)' }}>Cargando…</p>
      ) : (
        <>
          {readOnly && (
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted, #5B6472)', marginBottom: 20 }}>
              <span style={{ flexShrink: 0, marginTop: 2 }}>{ICON_EYE}</span>
              <span><b style={{ color: 'var(--ink-2, #1F2937)' }}>{plan.estado === 'archivado' ? 'Plan archivado.' : 'Plan anterior.'}</b> Si querés que {pacientePrimer} vea su plan actual, compartí el vigente.</span>
            </div>
          )}

          {!share ? (
            <>
              <div style={{ textAlign: 'center', padding: '10px 6px 22px' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-soft, #EAF0FE)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>{ICON_LINK}</div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--ink, #0B1220)' }}>Compartí el plan con un link</h3>
                <p style={{ margin: '0 auto 16px', fontSize: 13, lineHeight: 1.6, color: 'var(--muted, #5B6472)', maxWidth: 330 }}>
                  {pacientePrimer} lo abre desde el celular, sin crear cuenta. El link muestra siempre la versión actual: si editás el plan, ve los cambios.
                </p>
                {ultimoRevocadoEn && (
                  <p style={{ fontSize: 12, color: 'var(--muted-2, #8A93A1)', background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)', padding: '9px 11px', margin: '0 0 16px' }}>
                    Dejaste de compartir el link anterior el {fmtFecha(ultimoRevocadoEn)}. Si creás uno nuevo, la dirección cambia.
                  </p>
                )}
                {!readOnly && (
                  <button type="button" onClick={crearLink} disabled={creando} className="btn primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: creando ? 0.6 : 1 }}>
                    {ICON_LINK}Crear link
                  </button>
                )}
              </div>
              {mostrarFaltan && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--r-md, 8px)', background: 'var(--warn-soft, #FEF3E2)', fontSize: 12.5, lineHeight: 1.5, color: '#7A4405', marginBottom: 20 }}>
                  {ICON_WARN}
                  <span>El plan se ve sin {faltan.length === 3 ? 'objetivo, vigencia ni indicaciones' : faltan.join(' ni ')}. <button type="button" onClick={onAbrirDetalles} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: '#7A4405', textDecoration: 'underline', cursor: 'pointer' }}>Completar detalles</button></span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--muted, #5B6472)', marginBottom: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok, #10B981)', boxShadow: '0 0 0 3px var(--ok-soft, #DFF3E8)' }} />
                <b style={{ color: 'var(--ink, #0B1220)', fontWeight: 600 }}>Link activo</b>
                <span>desde el {fmtFecha(share.creado_en)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-2, #F6F7F9)', padding: '4px 4px 4px 12px', marginBottom: 12 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: 'var(--ink, #0B1220)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl(share).replace(/^https?:\/\//, '')}</span>
                <a href={shareUrl(share)} target="_blank" rel="noreferrer" title="Ver como paciente" style={{ width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--muted, #5B6472)' }}>{ICON_EXT}</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => { copyText(shareUrl(share)); setFlash('link'); setTimeout(() => setFlash(null), 1800) }}
                  className="btn primary"
                  style={{ height: 38, justifyContent: 'center', ...(flash === 'link' ? { background: 'var(--ok-soft, #DFF3E8)', borderColor: 'transparent', color: 'var(--ok-ink, #17663F)' } : {}) }}
                >
                  {flash === 'link' ? ICON_CHECK : ICON_COPY}{flash === 'link' ? 'Link copiado' : 'Copiar link'}
                </button>
                {telefonoE164 && (
                  <a
                    href={waHref(share)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn"
                    style={{ height: 38, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                  >
                    {ICON_CHAT}Enviar por WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => { copyText(waMsg(share)); setFlash('wa'); setTimeout(() => setFlash(null), 1800) }}
                  className="btn"
                  style={{ height: 38, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, ...(flash === 'wa' ? { background: 'var(--ok-soft, #DFF3E8)', borderColor: 'transparent', color: 'var(--ok-ink, #17663F)' } : {}) }}
                >
                  {flash === 'wa' ? ICON_CHECK : ICON_COPY}{flash === 'wa' ? 'Mensaje copiado' : (telefonoE164 ? 'Copiar mensaje para WhatsApp' : 'Copiar mensaje para WhatsApp (sin teléfono en la ficha)')}
                </button>
              </div>
              <div style={{ margin: '12px 0 18px', padding: '10px 12px', borderRadius: 'var(--r-md, 8px)', border: '1px dashed var(--border-strong, #D6DAE1)' }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted-3, #AEB5C0)' }}>Vista previa del mensaje</span>
                <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted, #5B6472)', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>{waMsg(share)}</p>
              </div>

              {!mailOpen ? (
                <button
                  type="button"
                  onClick={() => setMailOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 12px', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', background: 'var(--surface, #fff)', font: 'inherit', textAlign: 'left', cursor: 'pointer', marginBottom: 20 }}
                >
                  <span style={{ color: 'var(--ink-2, #1F2937)' }}>{ICON_MAIL}</span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink, #0B1220)' }}>Enviar por email</b>
                    <em style={{ display: 'block', fontStyle: 'normal', fontSize: 11.5, color: (!share.enviado_a && !pacienteEmail) ? 'var(--warn, #A65A06)' : 'var(--muted-2, #8A93A1)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {share.enviado_a ? `Enviado a ${share.enviado_a}${share.enviado_en ? ` · ${fmtFecha(share.enviado_en)}` : ''}` : (pacienteEmail || 'Sin email en la ficha')}
                    </em>
                  </span>
                  {ICON_CHEVR}
                </button>
              ) : (
                <div style={{ border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', padding: '12px 14px 2px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <b style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink, #0B1220)', flex: 1 }}>Enviar por email</b>
                    <button type="button" onClick={() => setMailOpen(false)} title="Cerrar" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted, #5B6472)' }}>{ICON_X}</button>
                  </div>
                  {!pacienteEmail && (
                    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 'var(--r-md, 8px)', background: 'var(--warn-soft, #FEF3E2)', fontSize: 12.5, lineHeight: 1.5, color: '#7A4405', marginBottom: 14 }}>
                      {ICON_WARN}<span><b>{pacientePrimer} no tiene email en su ficha.</b> Escribilo para enviarle el link.</span>
                    </div>
                  )}
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Para</label>
                    <input
                      type="email" value={mailTo} autoComplete="off"
                      onChange={(e) => { setMailTo(e.target.value); if (EMAIL_RE.test(e.target.value.trim())) setMailTouched(true) }}
                      onBlur={() => setMailTouched(true)}
                      placeholder="nombre@email.com"
                      style={inpStyle}
                    />
                    {mailError() && <p style={{ fontSize: 11.5, color: 'var(--danger, #B42318)', marginTop: 7 }}>{mailError()}</p>}
                    {!pacienteEmail ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 2px 0', fontSize: 13, fontWeight: 500, color: 'var(--ink-2, #1F2937)', cursor: 'pointer' }}>
                        <span onClick={(e) => { e.preventDefault(); setMailGuardar((v) => !v) }} style={{ width: 16, height: 16, borderRadius: 4, border: mailGuardar ? 'none' : '1.5px solid var(--border-strong, #D6DAE1)', background: mailGuardar ? 'var(--accent, #1F4FD9)' : 'var(--surface, #fff)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          {mailGuardar && ICON_CHECKBOX}
                        </span>
                        Guardar este email en la ficha de {pacientePrimer}
                      </label>
                    ) : (
                      <p style={helpStyle}>Tomado de la ficha. Si lo cambiás acá, la ficha no se modifica.</p>
                    )}
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Asunto</label>
                    <input value={mailAsunto} onChange={(e) => setMailAsunto(e.target.value)} style={inpStyle} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Mensaje <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-3, #AEB5C0)', marginLeft: 4 }}>opcional</span></label>
                    <textarea
                      value={mailMensaje} onChange={(e) => setMailMensaje(e.target.value)} rows={3}
                      placeholder={`Hola ${pacientePrimer}, te comparto el plan que armamos en la consulta.`}
                      style={{ ...inpStyle, height: 'auto', minHeight: 86, padding: '10px 11px', resize: 'vertical', lineHeight: 1.5, fontSize: 13.5, marginTop: 0, display: 'block' }}
                    />
                    <p style={helpStyle}>El email incluye el botón para abrir el plan. Las respuestas te llegan a tu casilla.</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 0 12px' }}>
                    <button type="button" onClick={enviarMail} disabled={mailEnviando || !EMAIL_RE.test(mailTo.trim()) || !mailAsunto.trim()} className="btn primary" style={{ opacity: (mailEnviando || !EMAIL_RE.test(mailTo.trim()) || !mailAsunto.trim()) ? 0.6 : 1 }}>
                      {mailEnviando ? 'Enviando…' : 'Enviar'}
                    </button>
                  </div>
                </div>
              )}

              {!readOnly && (() => {
                let expActual: 'none' | '30' | '90' = 'none'
                if (share.vence_en) {
                  const dias = Math.round((new Date(share.vence_en).getTime() - new Date(share.creado_en).getTime()) / 86400000)
                  expActual = dias >= 60 ? '90' : '30'
                }
                return (
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Vencimiento</label>
                    <div style={{ display: 'flex', width: '100%', padding: 2, background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 7, gap: 2 }}>
                      {([['none', 'Sin vencimiento'], ['30', '30 días'], ['90', '90 días']] as const).map(([v, l]) => (
                        <button
                          key={v} type="button" onClick={() => cambiarVencimiento(v)}
                          style={{ flex: 1, border: 'none', background: expActual === v ? 'var(--ink, #0B1220)' : 'transparent', padding: '7px 6px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: expActual === v ? '#fff' : 'var(--muted, #5B6472)', borderRadius: 5, cursor: 'pointer' }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <p style={helpStyle}>
                      {share.vence_en ? `Vence el ${fmtFecha(share.vence_en)}. Después, ${pacientePrimer} ve un aviso de enlace no disponible.` : 'El link funciona hasta que dejes de compartirlo.'}
                    </p>
                  </div>
                )
              })()}

              {mostrarFaltan && (
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--r-md, 8px)', background: 'var(--warn-soft, #FEF3E2)', fontSize: 12.5, lineHeight: 1.5, color: '#7A4405', marginBottom: 20 }}>
                  {ICON_WARN}
                  <span>El plan se ve sin {faltan.length === 3 ? 'objetivo, vigencia ni indicaciones' : faltan.join(' ni ')}. <button type="button" onClick={onAbrirDetalles} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: '#7A4405', textDecoration: 'underline', cursor: 'pointer' }}>Completar detalles</button></span>
                </div>
              )}

              {!readOnly && (
                <div style={{ borderTop: '1px solid var(--border, #E7E9EE)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {confirmRevoke ? (
                    <div style={{ width: '100%', background: 'var(--danger-soft, #FEF2F2)', borderRadius: 'var(--r-lg, 12px)', padding: '13px 14px' }}>
                      <b style={{ display: 'block', fontSize: 13.5, color: '#7A1A12' }}>¿Dejar de compartir este plan?</b>
                      <p style={{ margin: '4px 0 12px', fontSize: 12.5, lineHeight: 1.5, color: '#7A1A12' }}>El link deja de funcionar al instante. Si {pacientePrimer} lo abre, ve un aviso de enlace no disponible.</p>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => setConfirmRevoke(false)} className="btn">Cancelar</button>
                        <button type="button" onClick={revocar} disabled={revocando} className="btn" style={{ background: 'var(--danger, #B42318)', borderColor: 'var(--danger, #B42318)', color: '#fff', opacity: revocando ? 0.6 : 1 }}>Dejar de compartir</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => setConfirmRevoke(true)} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--danger, #B42318)', display: 'inline-flex', gap: 7, alignItems: 'center', cursor: 'pointer', padding: '6px 8px', marginLeft: -8, borderRadius: 6 }}>
                        {ICON_UNLINK}Dejar de compartir
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--muted-2, #8A93A1)' }}>El link deja de funcionar al instante.</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </SlideOver>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted-2, #8A93A1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }
const helpStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', marginTop: 7, lineHeight: 1.5 }
const inpStyle: React.CSSProperties = { width: '100%', height: 42, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)', padding: '0 11px', font: 'inherit', fontSize: 14.5, color: 'var(--ink, #0B1220)', background: 'var(--surface, #fff)', outline: 'none' }
