
'use client'

import ParishLogo from './ParishLogo'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const pathname = usePathname()
  if (!['/', '/about', '/services', '/contact', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/privacy'].includes(pathname)) return null
  return <PublicNavigation pathname={pathname} />
}

function PublicNavigation({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)
  const [accountLink, setAccountLink] = useState({ href: '/login', label: 'Dashboard' })

  useEffect(() => {
    queueMicrotask(() => setOpen(false))
  }, [pathname])

  // Keep public navigation consistent with the server-validated login session.
  useEffect(() => {
    let active = true
    const updateAccountLink = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
        if (!response.ok) {
          if (active) setAccountLink({ href: '/login', label: 'Dashboard' })
          return
        }
        const payload: { user?: { role?: string } } = await response.json()
        const href = payload.user?.role === 'ADMIN' ? '/admin'
          : ['STAFF', 'BURIAL_ADMIN'].includes(payload.user?.role || '') ? '/staff'
          : payload.user?.role === 'USER' ? '/dashboard' : '/#parish-access'
        if (active) setAccountLink({ href, label: 'Dashboard' })
      } catch {
        if (active) setAccountLink({ href: '/login', label: 'Dashboard' })
      }
    }
    void updateAccountLink()
    window.addEventListener('pageshow', updateAccountLink)
    return () => {
      active = false
      window.removeEventListener('pageshow', updateAccountLink)
    }
  }, [pathname])



  // Always show the shortcut; the server resolves /login when signed out.\n  const links = [...LINKS, accountLink]
  return <nav className="public-nav" aria-label="Parish navigation">
    <div className="nav-inner">
      <Link href="/" className="brand"><ParishLogo height={45}/><span>Iglesia Filipina Independiente<small>Maragondon, Cavite</small></span></Link>
      <div className="desktop-links">{links.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href?'page':undefined}>{link.label}</Link>)}</div>
      <button className="menu-switch" aria-expanded={open} aria-controls="mobile-links" onClick={()=>setOpen(!open)}>Menu</button>
    </div>
    {open && <div id="mobile-links" className="mobile-links">{links.map(link=><Link key={link.href} href={link.href} onClick={()=>setOpen(false)} aria-current={pathname===link.href?'page':undefined}>{link.label}</Link>)}</div>}
  </nav>
}
