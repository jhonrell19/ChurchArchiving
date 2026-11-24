'use client'

import { useEffect } from 'react'

const PRIVATE_ROOTS = [
  '/admin', '/dashboard', '/staff', '/burial-admin', '/complete-profile',
  '/office-reports', '/claims', '/appointments',
]
const isPrivatePage = () => PRIVATE_ROOTS.some(root =>
  window.location.pathname === root || window.location.pathname.startsWith(root + '/')
)

/**
 * UI hygiene only; the database-backed Node Proxy and route handlers remain
 * the ONLY authorization boundary. A browser can restore a visual snapshot
 * from BFCache without a network request even with Cache-Control: no-store.
 * On history restore force a fresh server session and role check.
 */
export default function SessionHistoryGuard() {
  useEffect(() => {
    let checking = false

    function revalidateHistory() {
      if (isPrivatePage()) window.location.reload()
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) revalidateHistory()
    }
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible' || !isPrivatePage() || checking) return
      checking = true
      void fetch('/api/auth/me', {
        method: 'GET', cache: 'no-store', credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-store' },
      }).then(async response => {
        if (response.status === 401) {
          window.location.replace('/login')
          return
        }
        if (!response.ok) {
          window.location.reload()
          return
        }
        const data = await response.json()
        const role: string = data?.user?.role || ''
        const path = window.location.pathname
        const admin = path === '/admin' || path.startsWith('/admin/')
        const member = path === '/dashboard' || path.startsWith('/dashboard/') ||
          path === '/complete-profile' || path.startsWith('/complete-profile/')
        const staff = path === '/staff' || path.startsWith('/staff/') ||
          path === '/burial-admin' || path.startsWith('/burial-admin/')
        const office = path === '/office-reports' || path.startsWith('/office-reports/')
        if ((admin && role !== 'ADMIN') ||
            (member && role !== 'USER') ||
            (staff && !['STAFF', 'BURIAL_ADMIN'].includes(role)) ||
            (office && !['ADMIN','STAFF','BURIAL_ADMIN'].includes(role))) {
          window.location.reload()
        }
      }).catch(() => {
        // Fail closed visually; live private APIs are independently guarded.
        if (isPrivatePage()) window.location.reload()
      }).finally(() => { checking = false })
    }

    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('popstate', revalidateHistory)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('popstate', revalidateHistory)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
