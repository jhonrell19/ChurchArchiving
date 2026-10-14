'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

type GoogleAuthIntent = 'login' | 'register'

type Props = {
  intent: GoogleAuthIntent
}

export default function GoogleAuthButton({ intent }: Props) {
  const router = useRouter()
  const buttonRef = useRef<HTMLDivElement | null>(null)

  const [googleReady, setGoogleReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  const handleCredential = useCallback(
    async (googleResponse: GoogleCredentialResponse) => {
      if (!googleResponse.credential) {
        alert('Google did not return a valid credential.')
        return
      }

      try {
        setLoading(true)

        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            credential: googleResponse.credential,
            intent,
          }),
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          alert(
            data.message ||
              'Google authentication could not be completed.'
          )
          return
        }

        if (data.user?.role !== 'USER') {
          alert(
            'Google authentication is available only for parishioner accounts.'
          )
          return
        }

        if (data.needsProfileCompletion) {
          router.replace('/complete-profile')
          router.refresh()
          return
        }

        router.replace('/dashboard')
        router.refresh()
      } catch (error) {
        console.error('GOOGLE AUTH ERROR:', error)
        alert('Unable to continue with Google right now.')
      } finally {
        setLoading(false)
      }
    },
    [intent, router]
  )

  useEffect(() => {
    if (
      !googleReady ||
      !clientId ||
      !buttonRef.current ||
      !window.google
    ) {
      return
    }

    const container = buttonRef.current
    container.innerHTML = ''

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    })

    const availableWidth = container.clientWidth || 350

    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text:
        intent === 'register'
          ? 'signup_with'
          : 'signin_with',
      shape: 'rectangular',
      width: Math.min(350, availableWidth),
      logo_alignment: 'left',
    })
  }, [
    googleReady,
    clientId,
    handleCredential,
    intent,
  ])

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          setLoadError(false)
          setGoogleReady(true)
        }}
        onReady={() => {
          setLoadError(false)
          setGoogleReady(true)
        }}
        onError={() => setLoadError(true)}
      />

      {!clientId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800">
          Google authentication is not configured. Add
          NEXT_PUBLIC_GOOGLE_CLIENT_ID to your .env file.
        </div>
      ) : (
        <div
          ref={buttonRef}
          className="flex min-h-[44px] w-full justify-center"
        />
      )}

      {loading && (
        <p className="mt-2 text-center text-xs text-slate-600">
          Verifying Google account...
        </p>
      )}

      {loadError && (
        <p className="mt-2 text-center text-xs text-red-600">
          Google authentication could not be loaded. Check your
          internet connection and OAuth configuration.
        </p>
      )}
    </>
  )
}
