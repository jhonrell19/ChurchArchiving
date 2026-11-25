'use client'

import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { validatePassword } from '@/lib/validation'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; guidance?: boolean; match?: string }

export default function PasswordField({ label, guidance, match, id, ...input }: Props) {
  const generated = useId()
  const field = id || generated
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const value = String(input.value || '')
  const [touched, setTouched] = useState(false)
  const mismatch = match !== undefined && value !== match && (value.length > 0 || touched)
  const missing = guidance ? validatePassword(value) : []
  const level = !value ? 0 : !missing.length ? 3 : missing.length <= 2 ? 2 : 1
  return <div className="relative min-w-0">
    <label htmlFor={field}>{label}</label>
    <div className="relative">
      <input {...input} id={field} type={visible ? 'text' : 'password'}
        aria-invalid={mismatch || undefined} style={{ paddingRight: '3rem', ...(mismatch && {borderColor:'#b42318', outline:'2px solid #b42318'}) }} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setTouched(true) }}
        onKeyDown={e => { if (e.key === 'Escape') setFocused(false) }}
        aria-describedby={mismatch ? field + '-mismatch' : guidance && focused ? field + '-rules' : undefined}/>
      <button type="button" aria-label={(visible ? 'Hide ' : 'Show ') + label} aria-pressed={visible} aria-controls={field}
        onClick={() => setVisible(v => !v)} className="absolute inset-y-0 right-0 min-w-11 rounded px-2 text-sm font-semibold underline">
        <i aria-hidden="true" className={visible ? 'ti ti-eye-off text-xl' : 'ti ti-eye text-xl'}/>
      </button>
    </div>
    {mismatch && <p id={field + '-mismatch'} className="text-sm text-red-700">Passwords do not match.</p>}
    {guidance && <div className="mt-2">
      <div aria-hidden="true" className="flex gap-1">
        {[1,2,3].map(n => <span key={n} className="h-1.5 flex-1 rounded" style={{
          backgroundColor: n > level ? '#d6dce0' : ['','#b42318','#ae7800','#227446'][level],
        }}/>)}
      </div>
      {value && <small aria-live="polite">{['','Weak','Almost there','Meets requirements'][level]}</small>}
      {focused && <div id={field + '-rules'} className="absolute z-20 mt-1 w-full rounded-lg border bg-white p-3 text-sm text-slate-900 shadow-lg">
        {missing.length ? 'Still needed: ' + missing.join(', ') + '.' : 'All password requirements met.'}
      </div>}
    </div>}
  </div>
}
