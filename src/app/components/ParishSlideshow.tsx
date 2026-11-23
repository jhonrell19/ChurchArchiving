'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function ParishSlideshow({ photos }: { photos: string[] }) {
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    if (!playing || photos.length < 2) return
    const interval = window.setInterval(() => setCurrent(index => (index + 1) % photos.length), 6500)
    return () => window.clearInterval(interval)
  }, [playing, photos.length])
  const selected = photos[current] || photos[0]
  return <section aria-label="Parish photo slideshow" className="portal-slideshow">
    <div className="portal-slide-photo">
      <Image key={selected} src={selected} alt={`Parish photo ${current + 1} of ${photos.length}`} fill
        priority={current === 0} sizes="(max-width: 900px) 100vw, 60vw" className="object-cover"/>
      <div className="portal-slide-caption">
        <span>Our parish community</span>
        <strong>Iglesia Filipina Independiente · Maragondon</strong>
      </div>
    </div>
    <div className="portal-slide-controls">
      <button type="button" aria-label="Previous parish photo" onClick={() => setCurrent(v => (v - 1 + photos.length) % photos.length)}>‹</button>
      <span className="portal-slide-count" aria-live="polite">Photo {current + 1} of {photos.length}</span>
      <button type="button" aria-label="Next parish photo" onClick={() => setCurrent(v => (v + 1) % photos.length)}>›</button>
      <button type="button" className="portal-slide-toggle" aria-pressed={!playing} onClick={() => setPlaying(v => !v)}>{playing ? 'Pause' : 'Play'}</button>
    </div>
  </section>
}
