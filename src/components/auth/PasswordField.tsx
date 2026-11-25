'use client'

import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { validatePassword } from '@/lib/validation'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; guidance?: boolean }

export default function PasswordField({ label, guidance, id, ...input }: Props) {
  const generated = useId()
  const field = id || generated
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const value = String(input.value || '')
  const missing = guidance ? validatePassword(value) : []
  const level = !value ? 0 : !missing.length ? 3 : missing.length <= 2 ? 2 : 1
  return <div className="relative min-w-0">
    <label htmlFor={field}>{label}</label>
    <div className="relative">
      <input {...input} id={field} type={visible ? 'text' : 'password'}
        style={{ paddingRight: '4.5rem' }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === 'Escape') setFocused(false) }}
        aria-describedby={guidance && focused ? field + '-rules' : undefined}/>
      <button type="button" aria-label={(visible ? 'Hide ' : 'Show ') + label} aria-controls={field}
        onClick={() => setVisible(v => !v)} className="absolute inset-y-0 right-0 min-w-16 rounded px-2 text-sm font-semibold underline">
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
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
