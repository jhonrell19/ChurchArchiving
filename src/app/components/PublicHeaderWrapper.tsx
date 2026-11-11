'use client'

import ParishLogo from './ParishLogo'


import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function PublicHeaderWrapper() {
  const pathname = usePathname()

  const hiddenRoutes = [
    '/admin',
    '/burial-admin',
    '/dashboard',
  ]

  const shouldHide = hiddenRoutes.some(route => pathname.startsWith(route))

  if (shouldHide) {
    return null
  }

  return (
    <header className="bg-navy border-b border-gold/20">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ParishLogo height={44} />
          <div>
            <p className="font-display text-gold text-[13px] tracking-wide">
              Iglesia Filipina Independiente
            </p>
            <p className="font-body text-gold/60 text-[10px]">
              Maragondon, Cavite
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-8 font-display text-[11px] tracking-wider text-gold">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/services">Services</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login" className="border border-gold/40 px-4 py-2 rounded-lg">
            Login
          </Link>
        </nav>
      </div>
    </header>
  )
}