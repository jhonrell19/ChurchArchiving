import Navbar from '../Components/Navbar'
import Footer from '../Components/Footer'

const SCHEDULE = [
  { day: 'Sunday',    time: '8:00 AM',  tag: 'Morning Mass'  },
  { day: 'Sunday',    time: '10:00 AM', tag: 'High Mass'     },
  { day: 'Wednesday', time: '6:00 PM',  tag: 'Bible Study'   },
  { day: 'Friday',    time: '7:00 PM',  tag: 'Prayer Service'},
]

const SACRAMENTS = [
  { icon: '💧', title: 'Baptism',           desc: 'The sacrament of initiation into the Christian faith. Contact the parish office to schedule and learn about preparation requirements.' },
  { icon: '💍', title: 'Matrimony',          desc: 'A sacred covenant before God and the community. Couples are encouraged to inquire at least three months in advance.' },
  { icon: '🛡️', title: 'Confirmation',       desc: 'The strengthening of baptismal grace through the Holy Spirit. Classes and preparation schedules are announced annually.' },
  { icon: '✝️', title: 'Holy Eucharist',     desc: 'The central act of Christian worship. Celebrated every Sunday at our scheduled masses, open to all baptized members.' },
  { icon: '🕊️', title: 'Burial & Last Rites',desc: 'In times of loss, the Church accompanies families with prayer, comfort, and the celebration of the departed\'s life.' },
  { icon: '⭐', title: 'Special Blessings',  desc: 'House blessings, vehicle blessings, and other special rites may be arranged by contacting the parish priest directly.' },
]

const MINISTRIES = [
  { name: 'Youth Ministry',    desc: 'Empowering the next generation through fellowship, retreats, and service.' },
  { name: "Women's Guild",     desc: 'A community of women dedicated to prayer, charity works, and parish support.' },
  { name: "Men's Brotherhood", desc: 'Building brotherly bonds through faith formation and community outreach.' },
  { name: 'Choir Ministry',    desc: 'Leading the congregation in sacred song and musical worship every Sunday.' },
]

export default function ServicesPage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative bg-navy pt-32 pb-20 px-7 text-center overflow-hidden border-b border-gold/15">
        <div className="absolute inset-0 bg-grid-gold pointer-events-none" />
        <div className="relative z-10 max-w-xl mx-auto animate-fade-down">
          <span className="block font-display text-[11px] tracking-[3px] uppercase text-gold/55 mb-4">
            What We Offer
          </span>
          <div className="text-gold text-4xl mb-4 animate-pulse-cross">✝</div>
          <h1
            className="font-display font-semibold text-gold mb-4"
            style={{ fontSize: 'clamp(22px,4vw,36px)' }}
          >
            Our Services
          </h1>
          <p className="font-body italic text-txt-lt text-[16px] leading-relaxed mb-6">
            Sacraments, worship, and ministries rooted in over a century of faithful service.
          </p>
          <div className="gold-divider"><span /><span className="diamond" /><span /></div>
        </div>
      </section>

      {/* Schedule */}
      <section className="bg-navy py-20 px-7">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="block font-display text-[11px] tracking-[3px] uppercase text-gold/50 mb-2">
              When We Gather
            </span>
            <h2 className="font-display font-semibold text-gold text-2xl mb-4">Weekly Schedule</h2>
            <div className="gold-divider"><span /><span className="diamond" /><span /></div>
          </div>
          <div className="max-w-2xl mx-auto border border-gold/20 rounded-xl overflow-hidden">
            {SCHEDULE.map(({ day, time, tag }, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-7 py-5
                  border-b border-gold/10 last:border-b-0
                  hover:bg-gold/5 hover:pl-9 transition-all duration-300 group"
              >
                <span className="font-display text-gold text-sm tracking-wide w-32">{day}</span>
                <span className="font-body text-txt-md text-[15px] flex-1 text-center">{time}</span>
                <span className="font-display text-[10px] tracking-widest uppercase
                  bg-gold/15 text-gold border border-gold/30 px-4 py-1 rounded-full
                  group-hover:bg-gold group-hover:text-navy transition-all duration-300">
                  {tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sacraments */}
      <section className="py-20 px-7">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="block font-display text-[11px] tracking-[3px] uppercase text-navy-mid/45 mb-2">
              The Sacraments
            </span>
            <h2 className="font-display font-semibold text-navy-mid text-2xl mb-4">
              Sacred Rites of the Church
            </h2>
            <div className="gold-divider"><span /><span className="diamond" /><span /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SACRAMENTS.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-white border border-gold/30 rounded-xl p-8 text-center
                  hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(12,42,94,0.12)]
                  hover:border-gold transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30
                  flex items-center justify-center mx-auto mb-5 text-3xl
                  group-hover:bg-gold/20 group-hover:scale-110 group-hover:-rotate-6
                  transition-all duration-300">
                  {icon}
                </div>
                <h3 className="font-display font-semibold text-navy-mid text-sm tracking-wide mb-3">{title}</h3>
                <p className="font-body text-[15px] text-[#4a6a8a] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ministries */}
      <section className="bg-navy py-20 px-7 border-t border-gold/15">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="block font-display text-[11px] tracking-[3px] uppercase text-gold/45 mb-2">
              Get Involved
            </span>
            <h2 className="font-display font-semibold text-gold text-2xl mb-4">Parish Ministries</h2>
            <div className="gold-divider"><span /><span className="diamond" /><span /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {MINISTRIES.map(({ name, desc }) => (
              <div
                key={name}
                className="border border-gold/20 rounded-xl p-6
                  hover:bg-gold/5 hover:border-gold/40 transition-all duration-200"
              >
                <h3 className="font-display text-gold text-sm tracking-wide mb-2">{name}</h3>
                <p className="font-body text-txt-md text-[15px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}