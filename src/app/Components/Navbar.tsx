'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/',         label: 'Home'     },
  { href: '/about',    label: 'About'    },
  { href: '/services', label: 'Services' },
  { href: '/contact',  label: 'Contact'  },
]

export default function Navbar() {
  const [mounted, setMounted]   = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  // --- CRITICAL RETURN ---
  // If we are on the server, return nothing. This prevents the server/client HTML mismatch.
  if (!mounted) {
    return null 
  }

  // --- HIDE ON DASHBOARD & ADMIN ROUTES ---
  // If the URL path starts with /dashboard or /admin, do not render the navbar.
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    return null
  }

  // Now that we've checked !mounted, we know safely we are on the client side!
  const navBg = scrolled ? 'bg-navy/95 shadow-[0_4px_24px_rgba(0,0,0,0.3)]' : 'bg-navy'
  const linkCls = (href: string) => `font-display text-[11px] tracking-wider px-3 py-1.5 rounded border-b-[1.5px] transition-all duration-200 ${pathname === href ? 'text-gold border-gold' : 'text-gold/70 border-transparent hover:text-gold hover:border-gold'}`
  const mobileLinkCls = (href: string) => `font-display text-[11px] tracking-wider py-2 border-b border-gold/10 ${pathname === href ? 'text-gold' : 'text-gold/60 hover:text-gold'}`

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-gold/20 transition-all duration-300 ${navBg}`}>
      <div className="max-w-6xl mx-auto px-7 flex items-center justify-between" style={{ height: '68px' }}>

        <Link href="/" className="flex items-center gap-3">
          <span className="text-gold text-2xl animate-pulse-cross">✝</span>
          <div className="flex flex-col">
            <span className="font-display text-gold text-[13px] tracking-wide leading-tight">Iglesia Filipina Independiente</span>
            <span className="font-body text-gold/50 text-[10px] tracking-widest">Maragondon, Cavite</span>
          </div>
        </Link>

        <ul className="hidden md:flex items-center gap-1">
          {LINKS.map(({ href, label }) => (
            <li key={href}><Link href={href} className={linkCls(href)}>{label}</Link></li>
          ))}
          <li><Link href="/login" className="font-display text-[11px] tracking-wider text-gold px-4 py-1.5 rounded-md border border-gold/40 bg-gold/10 hover:bg-gold/20 transition-all duration-200 ml-2">Login</Link></li>
        </ul>

        <button className="md:hidden flex flex-col gap-1.5 p-1" onClick={() => setOpen(p => !p)} aria-label="Toggle menu">
          {[0,1,2].map(i => <span key={i} className="block w-6 h-0.5 bg-gold rounded" />)}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-navy border-t border-gold/10 px-7 py-4 flex flex-col gap-1">
          {LINKS.map(({ href, label }) => <Link key={href} href={href} className={mobileLinkCls(href)}>{label}</Link>)}
          <Link href="/login" className="font-display text-[11px] tracking-wider text-gold px-4 py-1.5 rounded-md">Login</Link>
        </div>
      )}
    </nav>
  )
}