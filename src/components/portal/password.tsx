'use client'

import { useState } from 'react'

export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export function passwordRequisitos(a: string, b: string): { texto: string; ok: boolean }[] {
  return [
    { texto: 'Al menos 8 caracteres', ok: a.length >= 8 },
    { texto: 'Una letra mayúscula', ok: /[A-Z]/.test(a) },
    { texto: 'Un número', ok: /\d/.test(a) },
    { texto: 'Las dos contraseñas coinciden', ok: b.length > 0 && a === b },
  ]
}

const IconCheck = <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: '#fff', strokeWidth: 3, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>
const IconEye = <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'var(--muted)', strokeWidth: 1.8, fill: 'none' }}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
const IconEyeOff = <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'var(--muted)', strokeWidth: 1.8, fill: 'none' }}><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>

export function PasswordRequirementsList({ a, b }: { a: string; b: string }) {
  return (
    <ul className="pp-req" aria-live="polite">
      {passwordRequisitos(a, b).map((r) => (
        <li key={r.texto} className={r.ok ? 'ok' : ''}><i>{IconCheck}</i>{r.texto}</li>
      ))}
    </ul>
  )
}

export function PasswordField({ id, label, autoComplete, value, onChange }: {
  id: string
  label: string
  autoComplete: string
  value: string
  onChange: (v: string) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="pp-af">
      <label htmlFor={id}>{label}</label>
      <div className="pp-iw">
        <input
          className="pw" id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete}
          value={value} onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="pp-eye" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVisible((v) => !v)}>
          {visible ? IconEyeOff : IconEye}
        </button>
      </div>
    </div>
  )
}
