'use client'

import ParishLogo from './ParishLogo'



import Link from 'next/link'

const LINKS = [
  { href: '/',         label: 'Home'     },
  { href: '/about',    label: 'About'    },
  { href: '/services', label: 'Services' },
  { href: '/contact',  label: 'Contact'  },
  { href: '/#parish-access', label: 'Account access' },
]

export default function Footer({address='Poblacion 2-B, Maragondon, Cavite, Philippines'}:{address?:string}) {
  return (
    <footer className="site-footer border-t border-gold/20 pt-12 pb-7 px-7">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-5">

        <div className="flex items-center gap-4">
          <ParishLogo height={56} />
          <div>
            <p className="font-display text-gold text-sm tracking-wide mb-1">
              Iglesia Filipina Independiente
            </p>
            <p className="font-body text-txt-md text-[13px]">
              {address}
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm h-px bg-gold/15" />

        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-display text-[11px] tracking-wider text-gold/60 hover:text-gold transition-all duration-200"
            >
              {label}
            </Link>
          ))}
        </nav>

        <p className="font-body text-[12px] text-gold/25 text-center">
          &copy; 2026 Iglesia Filipina Independiente. All rights reserved.
        </p>
      </div>
    </footer>
  )
}