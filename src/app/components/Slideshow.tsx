'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const SLIDES = [
  {
    background: 'from-[#0d2a47] via-[#17456f] to-[#d8b35c]',
    image: '/slides/slide1.jpg',
    label: 'Welcome',
    title: 'Iglesia Filipina Independiente',
    verse: '"For God so loved the world that he gave his one and only Son." — John 3:16',
    btn:   'Join Us This Sunday',
    href:  '/services',
  },
  {
    background: 'from-[#17365a] via-[#345f82] to-[#efe4c7]',
    image: '/slides/slide2.jpg',
    label: 'Our Church',
    title: 'A Place of Faith & Tradition',
    verse: '"The Lord is my shepherd; I shall not want." — Psalm 23:1',
    btn:   'Learn About Us',
    href:  '/about',
  },
  {
    background: 'from-[#122b46] via-[#24577f] to-[#cfaa4d]',
    image: '/slides/slide3.png',
    label: 'Worship With Us',
    title: 'Sunday Mass Every Week',
    verse: '"Where two or three gather in my name, there am I." — Matthew 18:20',
    btn:   'View Schedule',
    href:  '/services',
  },
  {
    background: 'from-[#1c3b5b] via-[#567995] to-[#f4ead2]',
    image: '/slides/slide4.jpg',
    label: 'Community',
    title: 'Growing Together in Christ',
    verse: '"Love one another as I have loved you." — John 13:34',
    btn:   'Get Involved',
    href:  '/contact',
  },
]

export default function Slideshow() {
  const [cur, setCur]           = useState(0)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const goTo = useCallback((n: number) => {
    setCur(((n % SLIDES.length) + SLIDES.length) % SLIDES.length)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => goTo(cur + 1), 5000)
    return () => clearInterval(t)
  }, [cur, goTo, mounted])

  if (!mounted) return (
    <section className="relative h-screen min-h-[560px] bg-navy" />
  )

  return (
    <section className="relative h-screen min-h-[560px] overflow-hidden">
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br
            ${s.background} transition-opacity duration-1000
            ${i === cur ? 'opacity-100' : 'opacity-0'}`}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `linear-gradient(rgba(7, 25, 48, 0.64), rgba(7, 25, 48, 0.64)), url("${s.image}")`,
            }}
          />
          <div className="absolute inset-0 bg-white/10" />
          <div className="absolute inset-0 bg-grid-gold pointer-events-none" />

          <div className="relative z-10 text-center px-6 max-w-4xl">
            <span className="block font-display text-[15px] md:text-[17px] font-bold tracking-[2px] uppercase text-white mb-4 drop-shadow-lg">
              {s.label}
            </span>
            <div className="text-gold text-4xl mb-4 animate-pulse-cross">✝</div>
            <h1
              className="font-display font-extrabold text-white leading-tight mb-4 drop-shadow-[0_4px_16px_rgba(0,0,0,0.75)]"
              style={{ fontSize: 'clamp(38px, 5.6vw, 68px)' }}
            >
              {s.title}
            </h1>
            <p
              className="font-body italic font-bold text-white leading-relaxed max-w-3xl mx-auto mb-7 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
              style={{ fontSize: 'clamp(17px, 2.2vw, 23px)' }}
            >
              {s.verse}
            </p>
            <Link
              href={s.href}
              className="inline-block font-display text-[11px] tracking-[2px] uppercase
                bg-gold text-navy px-8 py-3 rounded-md hover:bg-gold-lt
                transition-all duration-300 hover:-translate-y-1"
            >
              {s.btn}
            </Link>
          </div>
        </div>
      ))}

      {/* Arrows */}
      <button
        onClick={() => goTo(cur - 1)}
        className="absolute left-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full
          border border-gold/35 bg-gold/10 text-gold text-2xl
          flex items-center justify-center hover:bg-gold/25 transition-all duration-200"
        aria-label="Previous"
      >&#8249;</button>
      <button
        onClick={() => goTo(cur + 1)}
        className="absolute right-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full
          border border-gold/35 bg-gold/10 text-gold text-2xl
          flex items-center justify-center hover:bg-gold/25 transition-all duration-200"
        aria-label="Next"
      >&#8250;</button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full border border-gold/40 transition-all duration-300
              ${i === cur ? 'bg-gold scale-125' : 'bg-gold/30'}`}
          />
        ))}
      </div>
    </section>
  )
}