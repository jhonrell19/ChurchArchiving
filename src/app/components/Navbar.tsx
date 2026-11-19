
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
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [accountLink, setAccountLink] = useState({ href: '/login', label: 'Login' })
  const pathname = usePathname()

  useEffect(() => {
    queueMicrotask(() => setMounted(true))

    const fn = () => setScrolled(window.scrollY > 50)

    window.addEventListener('scroll', fn)

    return () => window.removeEventListener('scroll', fn)
  }, [])

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
          if (active) setAccountLink({ href: '/login', label: 'Login' })
          return
        }
        const payload: { user?: { role?: string } } = await response.json()
        const href = payload.user?.role === 'ADMIN' ? '/admin'
          : payload.user?.role === 'BURIAL_ADMIN' ? '/burial-admin'
          : payload.user?.role === 'USER' ? '/dashboard' : '/login'
        if (active) setAccountLink({ href, label: href === '/login' ? 'Login' : 'Dashboard' })
      } catch {
        if (active) setAccountLink({ href: '/login', label: 'Login' })
      }
    }
    void updateAccountLink()
    window.addEventListener('pageshow', updateAccountLink)
    return () => {
      active = false
      window.removeEventListener('pageshow', updateAccountLink)
    }
  }, [pathname])

  if (!mounted) return null

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/burial-admin')
  ) {
    return null
  }

  const navBg = scrolled
    ? 'bg-navy/95 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
    : 'bg-navy'

  // Navigation text: 16px / 18px on large screens
  const linkCls = (href: string) =>
    `font-display text-base lg:text-lg font-bold tracking-wide
    px-3 py-2 rounded border-b-[2px]
    transition-all duration-200 ${
      pathname === href
        ? 'text-white border-gold'
        : 'text-white border-transparent hover:border-gold'
    }`

  const mobileLinkCls = (href: string) =>
    `font-display text-base font-bold tracking-wide
    py-3 border-b border-gold/10 ${
      pathname === href
        ? 'text-white'
        : 'text-white/90 hover:text-white'
    }`

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b border-gold/20 transition-all duration-300 ${navBg}`}
    >
      <div
        className="max-w-8xl mx-auto px-5 flex items-center justify-between"
        style={{ height: '76px' }}
      >
        {/* Church Logo and Name */}
        <Link href="/" className="flex items-center gap-3">
          <ParishLogo height={44} />

          <div className="flex flex-col">
            <span className="font-display text-white text-[16px] md:text-[18px] font-extrabold tracking-wide leading-tight">
              Iglesia Filipina Independiente
            </span>

            <span className="font-body text-white text-[13px] font-bold tracking-wide">
              Maragondon, Cavite
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <ul className="hidden lg:flex items-center gap-2">
          {LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={linkCls(href)}>
                {label}
              </Link>
            </li>
          ))}

          <li>
            <Link
              href={accountLink.href}
              className="font-display text-lg font-bold tracking-wide text-white px-6 py-2 rounded-md border border-gold/60 bg-gold/10 hover:bg-gold/20 transition-all duration-200 ml-2"
            >
              {accountLink.label}
            </Link>
          </li>
        </ul>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setOpen(p => !p)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="block w-6 h-0.5 bg-gold rounded"
            />
          ))}
        </button>
      </div>

      {/* Mobile Navigation */}
      {open && (
        <div className="lg:hidden bg-navy border-t border-gold/10 px-7 py-4 flex flex-col gap-1">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={mobileLinkCls(href)}
            >
              {label}
            </Link>
          ))}

          <Link
            href={accountLink.href}
            className="font-display text-base font-bold tracking-wide text-white px-4 py-3 rounded-md"
          >
            {accountLink.label}
          </Link>
        </div>
      )}
    </nav>
  )
}
