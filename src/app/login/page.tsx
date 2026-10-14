'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

type GoogleCredentialResponse = {
  credential: string
  select_by?: string
}

type GoogleIdentityWindow = Window & {
  google?: {
    accounts: {
      id: {
        initialize: (options: {
          client_id: string
          callback: (response: GoogleCredentialResponse) => void
        }) => void

        renderButton: (
          parent: HTMLElement,
          options: {
            type?: 'standard' | 'icon'
            theme?: 'outline' | 'filled_blue' | 'filled_black'
            size?: 'large' | 'medium' | 'small'
            text?:
              | 'signin_with'
              | 'signup_with'
              | 'continue_with'
              | 'signin'
            shape?: 'rectangular' | 'pill' | 'circle' | 'square'
            width?: number
            logo_alignment?: 'left' | 'center'
          }
        ) => void
      }
    }
  }
}

export default function LoginPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)

  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [developmentVerificationUrl, setDevelopmentVerificationUrl] =
    useState('')

  const [googleReady, setGoogleReady] = useState(false)
  const [googleLoadError, setGoogleLoadError] = useState(false)

  const googleButtonRef = useRef<HTMLDivElement | null>(null)

  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(previous => ({
      ...previous,
      [e.target.name]: e.target.value,
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setVerificationMessage('')
    setDevelopmentVerificationUrl('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.verificationRequired) {
          setVerificationEmail(
            form.email.trim().toLowerCase()
          )

          setVerificationMessage(
            data.message ||
              'Please verify your email address before signing in.'
          )
        } else {
          alert(data.message || 'Login failed.')
        }

        return
      }

      switch (data.user?.role) {
        case 'ADMIN':
          router.replace('/admin')
          break

        case 'BURIAL_ADMIN':
          router.replace('/burial-admin')
          break

        case 'USER':
          router.replace('/dashboard')
          break

        default:
          alert('Unknown account role.')
          return
      }

      router.refresh()
    } catch (error) {
      console.error('LOGIN ERROR:', error)

      alert(
        'Unable to sign in right now. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!verificationEmail) return

    try {
      const res = await fetch(
        '/api/auth/resend-verification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: verificationEmail,
          }),
        }
      )

      const data = await res.json().catch(() => ({}))

      setVerificationMessage(
        data.message || 'Verification request processed.'
      )

      setDevelopmentVerificationUrl(
        data.developmentVerificationUrl || ''
      )
    } catch {
      setVerificationMessage(
        'Unable to resend verification right now.'
      )
    }
  }

  const handleGoogleCredential = useCallback(
    async (googleResponse: GoogleCredentialResponse) => {
      if (!googleResponse.credential) {
        alert(
          'Google did not return a valid login credential.'
        )
        return
      }

      try {
        setSocialLoading(true)

        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            credential: googleResponse.credential,
          }),
        })

        const data = await response
          .json()
          .catch(() => ({}))

        if (!response.ok) {
          alert(
            data.message ||
              'Google login could not be completed.'
          )
          return
        }

        if (data.user?.role !== 'USER') {
          alert(
            'Google Sign-In is available only for parishioner accounts.'
          )
          return
        }

        router.replace('/dashboard')
        router.refresh()
      } catch (error) {
        console.error('GOOGLE LOGIN ERROR:', error)

        alert(
          'Unable to sign in with Google right now.'
        )
      } finally {
        setSocialLoading(false)
      }
    },
    [router]
  )

  useEffect(() => {
    if (
      !googleReady ||
      !googleClientId ||
      !googleButtonRef.current
    ) {
      return
    }

    const googleWindow =
      window as GoogleIdentityWindow

    if (!googleWindow.google) {
      return
    }

    const container = googleButtonRef.current

    container.innerHTML = ''

    googleWindow.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    })

    const availableWidth =
      container.clientWidth || 320

    googleWindow.google.accounts.id.renderButton(
      container,
      {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(350, availableWidth),
        logo_alignment: 'left',
      }
    )
  }, [
    googleReady,
    googleClientId,
    handleGoogleCredential,
  ])

  const inputCls =
    'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-body text-[15px] text-navy-mid outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/10 transition-all'

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          setGoogleLoadError(false)
          setGoogleReady(true)
        }}
        onError={() => {
          setGoogleLoadError(true)
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-[#fffaf0] via-white to-[#eaf4ff] flex items-center justify-center px-6 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-gold opacity-60 pointer-events-none" />

        <div className="relative z-10 w-full max-w-md bg-white border border-amber-100 rounded-3xl px-8 md:px-10 py-10 shadow-xl shadow-slate-200/60">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <span className="text-gold text-3xl">
                ✝
              </span>
            </div>

            <h1 className="font-display text-navy-mid text-lg tracking-wide mb-2 font-semibold">
              Iglesia Filipina Independiente
            </h1>

            <p className="font-body italic text-slate-600 text-[13px]">
              Parish Portal — Maragondon, Cavite
            </p>
          </div>

          <h2 className="text-center text-navy-mid text-xl font-semibold mb-2">
            Sign In
          </h2>

          <p className="text-center text-slate-600 text-sm mb-8">
            Enter your account credentials. Your role
            will be detected automatically.
          </p>

          {/* Normal email/password login */}
          <form
            onSubmit={submit}
            className="flex flex-col gap-5"
          >
            <div>
              <label className="block text-navy-mid mb-2 text-sm font-semibold">
                Email Address
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={change}
                placeholder="your@email.com"
                autoComplete="email"
                required
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2 gap-3">
                <label className="text-navy-mid text-sm font-semibold">
                  Password
                </label>

                <Link
                  href="/forgot-password"
                  className="text-gold hover:text-amber-600 text-xs font-semibold"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={change}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={loading || socialLoading}
              className="bg-navy text-white py-3.5 rounded-xl font-display text-[12px] uppercase tracking-wider hover:bg-navy-mid transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Signing In...'
                : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px bg-slate-200 flex-1" />

            <span className="text-[10px] md:text-[11px] uppercase tracking-wider text-slate-600 font-semibold whitespace-nowrap">
              Or continue with
            </span>

            <div className="h-px bg-slate-200 flex-1" />
          </div>

          {/* Google Login */}
          <div className="space-y-3">
            {googleClientId ? (
              <div
                ref={googleButtonRef}
                className="w-full flex justify-center min-h-[44px]"
              />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-amber-800 text-xs text-center">
                  Google Sign-In is not configured.
                  Add NEXT_PUBLIC_GOOGLE_CLIENT_ID
                  to your .env file.
                </p>
              </div>
            )}

            {googleLoadError && (
              <p className="text-center text-red-600 text-xs">
                Google Sign-In could not be loaded.
                Check your internet connection and
                Google OAuth configuration.
              </p>
            )}

            {socialLoading && (
              <p className="text-center text-slate-600 text-xs">
                Signing in with Google...
              </p>
            )}
          </div>

          {/* Future social login buttons */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              type="button"
              disabled
              title="Facebook login will be connected next."
              className="flex items-center justify-center gap-2 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
            >
              <i className="ti ti-brand-facebook text-[19px]" />
              Facebook
            </button>

            <button
              type="button"
              disabled
              title="Phone OTP login will be connected next."
              className="flex items-center justify-center gap-2 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
            >
              <i className="ti ti-phone text-[18px]" />
              Phone
            </button>
          </div>

          <p className="text-center text-slate-500 text-[11px] mt-2">
            Facebook and phone login will be enabled
            after their authentication providers are
            configured.
          </p>

          {/* Email verification warning */}
          {verificationEmail && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-amber-800 text-sm">
                {verificationMessage}
              </p>

              <button
                type="button"
                onClick={() =>
                  void resendVerification()
                }
                className="mt-2 text-gold font-semibold text-xs underline"
              >
                Resend verification link
              </button>

              {developmentVerificationUrl && (
                <a
                  href={developmentVerificationUrl}
                  className="block mt-2 text-blue-700 text-xs underline break-all"
                >
                  Development verification link
                </a>
              )}
            </div>
          )}

          {/* Register */}
          <p className="text-center text-slate-600 mt-7 text-sm">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-gold font-semibold hover:text-amber-600"
            >
              Register
            </Link>
          </p>

          {/* Staff notice */}
          <p className="text-center text-slate-500 mt-3 text-[11px] leading-relaxed">
            Google, Facebook, and phone authentication
            are for parishioner accounts. Authorized
            staff accounts retain protected staff
            access.
          </p>
        </div>
      </div>
    </>
  )
}