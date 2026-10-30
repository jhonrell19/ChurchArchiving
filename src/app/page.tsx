import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Slideshow from './components/Slideshow'

const CARDS = [
  { title: 'Worship',     desc: 'Join us in prayer and praise every Sunday morning as we lift our voices together in faith.' },
  { title: 'Scripture',   desc: 'Grounded in the living Word of God — our teachings draw from the timeless truth of the Holy Bible.' },
  { title: 'Fellowship',  desc: "A warm community that walks together — celebrating life's joys and supporting one another through trials." },
]

const SCHEDULE = [
  { day: 'Sunday',    time: '8:00 AM',  tag: 'Morning Mass'   },
  { day: 'Sunday',    time: '10:00 AM', tag: 'High Mass'      },
  { day: 'Wednesday', time: '6:00 PM',  tag: 'Bible Study'    },
  { day: 'Friday',    time: '7:00 PM',  tag: 'Prayer Service' },
]

export default function HomePage() {
  return (
    <>
      <Navbar />
      <Slideshow />

      {/* Verse Banner */}
      <div style={{ background: '#0c2a5e', borderTop: '1px solid rgba(212,175,55,0.2)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '20px 28px', textAlign: 'center' }}>
        <p className="font-body italic text-[15px] leading-relaxed" style={{ color: '#e8d9b0' }}>
          &ldquo;Come to me, all you who are weary and burdened, and I will give you rest.&rdquo; — Matthew 11:28
        </p>
      </div>

      {/* Community Cards */}
      <section style={{ padding: '80px 28px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="text-center mb-12">
            <span className="block font-display text-[11px] tracking-[3px] uppercase mb-3"
              style={{ color: 'rgba(12,42,94,0.45)' }}>
              Our Community
            </span>
            <h2 className="font-display font-semibold text-[26px] mb-4"
              style={{ color: '#0c2a5e' }}>
              Faith. Scripture. Fellowship.
            </h2>
            <div className="gold-divider"><span /><span className="diamond" /><span /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CARDS.map(({ title, desc }) => (
              <div key={title} className="bg-white rounded-xl p-9 text-center"
                style={{ border: '1px solid rgba(212,175,55,0.3)' }}>
                <h3 className="font-display font-semibold text-[16px] tracking-wide mb-3"
                  style={{ color: '#0c2a5e' }}>
                  {title}
                </h3>
                <p className="font-body text-[15px] leading-relaxed"
                  style={{ color: '#4a6a8a' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section style={{ background: '#071630', padding: '80px 28px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="text-center mb-12">
            <span className="block font-display text-[11px] tracking-[3px] uppercase mb-2"
              style={{ color: 'rgba(212,175,55,0.5)' }}>
              Schedules
            </span>
            <h2 className="font-display font-semibold text-[26px] mb-4"
              style={{ color: '#d4af37' }}>
              Service Schedule
            </h2>
            <div className="gold-divider"><span /><span className="diamond" /><span /></div>
          </div>

          <div style={{ maxWidth: '700px', margin: '0 auto', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
            {SCHEDULE.map(({ day, time, tag }, i) => (
              <div key={i} className="flex items-center justify-between px-7 py-5"
                style={{ borderBottom: i < SCHEDULE.length - 1 ? '1px solid rgba(212,175,55,0.1)' : 'none' }}>
                <span className="font-display text-sm tracking-wide w-32" style={{ color: '#d4af37' }}>{day}</span>
                <span className="font-body text-[15px] flex-1 text-center" style={{ color: '#8aaccf' }}>{time}</span>
                <span className="font-display text-[10px] tracking-widest uppercase px-4 py-1 rounded-full"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.3)' }}>
                  {tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}