'use client'
import PasswordField from '@/components/auth/PasswordField'
import { digitsOnly, isValidPersonName, sanitizePersonName } from '@/lib/fieldInput'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'

type Mode = 'login' | 'register'

const fieldClass = 'portal-auth-input'
const roleDestination: Record<string, string> = {
  ADMIN: '/admin', STAFF: '/staff', BURIAL_ADMIN: '/staff', USER: '/dashboard',
}

export default function HomepageAuth() {
  const [mode, setMode] = useState<Mode>('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [policyVersion, setPolicyVersion] = useState<string | undefined>()
  const [consent, setConsent] = useState(false)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [register, setRegister] = useState({
    firstName: '', middleName: '', surname: '', phoneNumber: '',
    email: '', password: '', confirmPassword: '',
  })

  useEffect(() => {
    // Begin waking the archive when a visitor arrives, while they sign in.
    void fetch('/api/ready', { cache: 'no-store' }).catch(() => undefined)
    if (new URLSearchParams(window.location.search).get('auth') === 'register') setMode('register')
    fetch('/api/portal-config', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (typeof data?.policy?.id === 'string') setPolicyVersion(data.policy.id) })
      .catch(() => undefined)
  }, [])

  function changeMode(next: Mode) {
    setMode(next)
    setMessage('')
    setIsError(false)
    setVerificationEmail('')
  }
  function inform(text: string, error = true) {
    setMessage(text)
    setIsError(error)
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); inform('', false); setVerificationEmail('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login),
      })
      const data = await response.json().catch(() => ({}))
      if (data.evidenceRequired) { window.location.assign('/verification'); return }
      if (!response.ok) {
        if (data.verificationRequired) setVerificationEmail(login.email.trim().toLowerCase())
        inform(data.message || 'Sign-in failed. Please check your details.')
        return
      }
      if (data.mfaRequired) { window.location.replace('/staff-mfa'); return }
      if (data.user?.role === 'USER' && data.needsProfileCompletion) {
        window.location.replace('/complete-profile'); return
      }
      const destination = roleDestination[data.user?.role]
      if (!destination) { inform('Account role could not be identified. Contact the parish office.'); return }
      window.location.replace(destination)
    } catch {
      inform('Unable to connect. Please try signing in again.')
    } finally { setBusy(false) }
  }

  async function signUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (register.password !== register.confirmPassword) {
      inform('Passwords do not match. Please re-enter them.'); return
    }
    if (!isValidPersonName(register.firstName, 80) || !isValidPersonName(register.surname, 80) ||
        (register.middleName && !isValidPersonName(register.middleName, 80))) {
      inform('Names must use letters, spaces, apostrophes, periods or hyphens.'); return
    }
    if (register.phoneNumber && !/^09\d{9}$/.test(register.phoneNumber.trim())) {
      inform('Enter an 11-digit Philippine mobile number starting with 09, or leave it blank.'); return
    }
    if (!consent) { inform('Please read and accept the Privacy Notice to create an account.'); return }
    setBusy(true); inform('', false)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...register, privacyConsent: consent, policyVersion }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { inform(data.message || 'Could not create an account.'); return }
      setVerificationEmail(register.email.trim().toLowerCase())
      inform([data.message || 'Account created.', data.phoneStatusNote].filter(Boolean).join(' '), false)
      if (!data.verificationRequired) changeMode('login')
    } catch {
      inform('Registration is temporarily unavailable. Please try again.')
    } finally { setBusy(false) }
  }

  async function resendEmail() {
    if (!verificationEmail || busy) return
    setBusy(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      })
      const result = await response.json().catch(() => ({}))
      inform(result.message || 'Please check your email inbox.', !response.ok)
    } catch { inform('Could not resend the email. Try again later.') }
    finally { setBusy(false) }
  }

  return <section className="portal-auth-card" aria-labelledby="portal-auth-heading">
    <div className="portal-auth-head">
      <p className="portal-eyebrow">Your parish account</p>
      <h2 id="portal-auth-heading">{mode === 'login' ? 'Welcome back' : 'Join the parish portal'}</h2>
      <p>{mode === 'login' ? 'Sign in to request or track a document.' : 'Register once, then verify your email to continue.'}</p>
    </div>
    <div className="portal-auth-tabs" role="group" aria-label="Account access">
      <button type="button" aria-pressed={mode === 'login'} onClick={() => changeMode('login')}>Log in</button>
      <button type="button" aria-pressed={mode === 'register'} onClick={() => changeMode('register')}>Register</button>
    </div>
    {message && <p className={'portal-auth-message ' + (isError ? 'is-error' : 'is-success')} role={isError ? 'alert' : 'status'}>{message}</p>}
    {mode === 'login' ? <form onSubmit={signIn} className="portal-auth-form">
      <label htmlFor="portal-login-email">Email address
        <input className={fieldClass} id="portal-login-email" type="email" required autoComplete="email" placeholder="your@email.com"
          value={login.email} onChange={event => setLogin(p => ({...p,email:event.target.value}))}/>
      </label>
      <PasswordField label="Password" className={fieldClass} id="portal-login-password" required autoComplete="current-password"
          value={login.password} onChange={event => setLogin(p => ({...p,password:event.target.value}))}/>
      <Link href="/forgot-password" className="portal-subtle-link">Forgot password?</Link>
      <button className="portal-primary-btn" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Log in to Smart Parish'}</button>
      <div className="portal-auth-divider">Or continue with Google</div>
      <GoogleAuthButton intent="login"/>
      {verificationEmail && <button type="button" onClick={() => void resendEmail()} disabled={busy} className="portal-secondary-btn">Resend verification email</button>}
    </form> : <form onSubmit={signUp} className="portal-auth-form">
      <div className="portal-auth-name-grid">
        <label htmlFor="portal-first-name">First name *
          <input className={fieldClass} id="portal-first-name" required autoComplete="given-name" value={register.firstName} maxLength={80} onChange={e=>setRegister(p=>({...p,firstName:sanitizePersonName(e.target.value)}))}/>
        </label>
        <label htmlFor="portal-surname">Surname *
          <input className={fieldClass} id="portal-surname" required autoComplete="family-name" value={register.surname} maxLength={80} onChange={e=>setRegister(p=>({...p,surname:sanitizePersonName(e.target.value)}))}/>
        </label>
      </div>
      <label htmlFor="portal-middle-name">Middle name (optional)
        <input className={fieldClass} id="portal-middle-name" autoComplete="additional-name" value={register.middleName} maxLength={80} onChange={e=>setRegister(p=>({...p,middleName:sanitizePersonName(e.target.value)}))}/>
      </label>
      <label htmlFor="portal-phone">Mobile number (optional)
        <input className={fieldClass} id="portal-phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="09[0-9]{9}" maxLength={11} placeholder="09XXXXXXXXX" value={register.phoneNumber} onChange={e=>setRegister(p=>({...p,phoneNumber:digitsOnly(e.target.value, 11)}))}/>
      </label>
      <label htmlFor="portal-register-email">Email address *
        <input className={fieldClass} id="portal-register-email" type="email" required autoComplete="email" value={register.email} onChange={e=>setRegister(p=>({...p,email:e.target.value}))}/>
      </label>
      <div className="portal-auth-name-grid">
        <PasswordField label="Password *" guidance className={fieldClass} id="portal-register-password" required minLength={12} autoComplete="new-password" value={register.password} onChange={e=>setRegister(p=>({...p,password:e.target.value}))}/>
        <PasswordField label="Confirm password *" match={register.password} className={fieldClass} id="portal-register-confirm" required minLength={12} autoComplete="new-password" value={register.confirmPassword} onChange={e=>setRegister(p=>({...p,confirmPassword:e.target.value}))}/>
      </div>
      <p className="portal-form-help">Use at least 8 characters with uppercase and lowercase letters and a number.</p>
      <label className="portal-consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>
        <span>I agree to the use of my information for parish membership review. <Link href="/privacy" target="_blank" rel="noopener noreferrer">Read the Privacy Notice.</Link></span>
      </label>
      <button type="submit" className="portal-primary-btn" disabled={busy || !consent}>{busy ? 'Creating account…' : 'Create my account'}</button>
      <div className="portal-auth-divider">Or register with Google</div>
      {consent ? <GoogleAuthButton intent="register" privacyConsent={consent} policyVersion={policyVersion}/> : <p className="portal-form-help">Please accept the Privacy Notice to register with Google.</p>}
      {verificationEmail && <button type="button" disabled={busy} className="portal-secondary-btn" onClick={() => void resendEmail()}>Resend verification email</button>}
    </form>}
    <p className="portal-auth-footnote">Church Staff and Super Admin use their assigned parish credentials. Membership approval may be required for new parishioners.</p>
  </section>
}
