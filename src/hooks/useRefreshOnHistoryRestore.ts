'use client'

import { useEffect } from 'react'

// Browser back-forward cache can restore an old rendered page without making
// a new request to the server. Reload on such restoration so Next.js repeats
// session/role checks; never try to intercept or disable the Back button.
export function useRefreshOnHistoryRestore() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload()
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
}
