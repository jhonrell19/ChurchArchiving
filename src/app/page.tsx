import Link from 'next/link'
import Image from 'next/image'
import Footer from './components/Footer'
import ParishCalendar from './components/ParishCalendar'

export default function HomePage() {
  return <>
    <main className="parish-home">
      <section className="welcome">
        <div className="welcome-copy">
          <p className="place">Maragondon, Cavite</p>
          <h1>Welcome to<br/>our parish.</h1>
          <p>Find Mass times and parish notices, or sign in to request a certificate.</p>
          <div className="welcome-actions"><Link href="/login">Log in</Link><Link href="/register">Register</Link></div>
        </div>
        <div className="welcome-photo"><Image src="/slides/slide1.jpg" alt="Iglesia Filipina Independiente parish in Maragondon" fill priority sizes="(max-width: 720px) 100vw, 48vw" /></div>
      </section>
      <ParishCalendar />
    </main>
    <Footer/>
  </>
}
