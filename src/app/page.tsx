import Link from 'next/link'
import Image from 'next/image'
import Footer from './components/Footer'
import ParishCalendar from './components/ParishCalendar'

import {publishedContent} from '@/lib/publishedSiteContent'
export const dynamic = 'force-dynamic'
export default async function HomePage() {
  const content=await publishedContent()
  return <>
    <main className="parish-home">
      <section className="welcome">
        <div className="welcome-copy">
          <p className="place">IFI · Maragondon, Cavite</p>
          <h1>{content.title}</h1>
          <p>{content.introduction}</p>
          <div className="welcome-actions"><Link href="/login">Log in</Link><Link href="/register">Register</Link></div>
        </div>
        <div className="welcome-photo"><Image src={content.photo} alt="Iglesia Filipina Independiente parish in Maragondon" fill priority sizes="(max-width: 720px) 100vw, 48vw" /></div>
      </section>
      <nav className="parish-directory" aria-label="Parish directory"><a href="#parish-calendar">Mass times and notices <span>↓</span></a><Link href="/services">Sacraments and fees <span>→</span></Link><Link href="/contact">Parish office <span>→</span></Link></nav>
      <div id="parish-calendar"><ParishCalendar services={content.services}/></div>
    </main>
    <Footer address={content.address}/>
  </>
}
