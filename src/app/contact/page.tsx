import Link from 'next/link'
import Footer from '../components/Footer'
import { publishedContent } from '@/lib/publishedSiteContent'
export const dynamic = 'force-dynamic'

export default async function ContactPage() {
  const {address,hours,email,services}=await publishedContent()
  const sunday=services.filter(s=>s.day==='Sunday')
  return <><main className="parish-workspace office-contact">
    <h1>Contact the parish office</h1>
    <div className="contact-directory">
      <section><h2>Visit the parish</h2><p>{address}</p>
        <a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('Iglesia Filipina Independiente '+address)} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
        <h2>Office hours</h2><p>{hours}</p>
        {email && <><h2>Email the office</h2><a href={'mailto:'+email}>{email}</a></>}
      </section>
      <section><h2>Sunday Homily</h2>
        {sunday.length?sunday.map((s,i)=><p key={i}>{s.time} · {s.tag}</p>):<p>Contact the office for current Homily times.</p>}
        <Link href="/#parish-calendar">View parish calendar →</Link>
        <h2>Certificate requests</h2><Link href="/login">Sign in to request a certificate →</Link>
      </section>
    </div>
  </main><Footer address={address}/></>
}
