'use client'

import ParishLogo from './ParishLogo'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Public navigation is intentionally limited to public parish information.
// A visible link is never an authorization boundary, and no private workspace
// destination belongs on the public website. Login redirects to the correct
// role-specific workspace after real server-side authentication.
const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
]

const PUBLIC_PATHS = new Set([
  '/', '/about', '/services', '/contact', '/login', '/register',
  '/forgot-password', '/reset-password', '/verify-email', '/privacy',
])

export default function Navbar() {
  const pathname = usePathname()
  if (!PUBLIC_PATHS.has(pathname)) return null
  return <PublicNavigation pathname={pathname} />
}

function PublicNavigation({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setOpen(false))
  }, [pathname])

  return <nav className="public-nav" aria-label="Parish navigation">
    <div className="nav-inner">
      <Link href="/" className="brand">
        <ParishLogo height={45}/>
        <span>Iglesia Filipina Independiente<small>Maragondon, Cavite</small></span>
      </Link>
      <div className="desktop-links">
        {PUBLIC_LINKS.map(link=><Link key={link.href} href={link.href}
          aria-current={pathname===link.href?'page':undefined}>{link.label}</Link>)}
      </div>
      <button type="button" className="menu-switch"
        aria-expanded={open} aria-controls="mobile-links"
        onClick={()=>setOpen(value=>!value)}>Menu</button>
    </div>
    {open && <div id="mobile-links" className="mobile-links">
      {PUBLIC_LINKS.map(link=><Link key={link.href} href={link.href}
        onClick={()=>setOpen(false)} aria-current={pathname===link.href?'page':undefined}>
        {link.label}
      </Link>)}
    </div>}
  </nav>
}
