'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

const offices = ['/admin', '/dashboard', '/staff', '/burial-admin', '/office-reports', '/appointments', '/claims']

export default function ApiWorkspace({ children }: { children: ReactNode }) {
  const path = usePathname()
  return offices.some(root => path === root || path.startsWith(root + '/'))
    ? <Connection>{children}</Connection> : children
}

function Connection({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<'connecting' | 'ready' | 'offline'>('connecting')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let checking = false
    let connected = false
    let hiddenAt = document.hidden ? Date.now() : 0
    let started = Date.now()
    async function check() {
      if (checking || controller.signal.aborted || document.hidden) return
      checking = true
      connected = false
      setStatus('connecting')
      let delay = 5000
      try {
        const response = await fetch('/api/ready', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(22000)]),
        })
        if (response.ok && (await response.text()).trim() === 'ready') {
          if (!controller.signal.aborted) { connected = true; setStatus('ready'); setMounted(true) }
          return
        }
        const retry = Number(response.headers.get('retry-after'))
        if (Number.isFinite(retry) && retry > 0) delay = retry * 1000
      } catch {
        // A waking Render instance can time out or return its own loading page.
      } finally { checking = false }
      if (controller.signal.aborted) return
      if (Date.now() + delay - started > 120000) setStatus('offline')
      else timer = setTimeout(check, delay)
    }
    function visibility() {
      if (document.hidden) {
        hiddenAt = Date.now()
        clearTimeout(timer)
      } else if (hiddenAt) {
        const longAbsence = Date.now() - hiddenAt >= 15 * 60000
        hiddenAt = 0
        if (longAbsence || !connected) { clearTimeout(timer); started = Date.now(); void check() }
      }
    }
    // A short tab switch also resumes an interrupted initial check.
    void check()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [attempt])

  return <>
    {status !== 'ready' && <section aria-live="polite" className="mx-auto w-full max-w-3xl rounded-xl border bg-white p-5">
      <p>{status === 'connecting' ? 'Connecting to the parish service. This can take a minute after inactivity.' : 'The parish service is still unavailable.'}</p>
      {status === 'offline' && <button type="button" className="mt-3 rounded-lg border px-4 py-2" onClick={() => setAttempt(n => n + 1)}>Reconnect</button>}
      {!mounted && <button type="button" className="ml-2 rounded-lg px-4 py-2 underline" onClick={() => setMounted(true)}>Open workspace now</button>}
    </section>}
    {mounted && children}
  </>
}
