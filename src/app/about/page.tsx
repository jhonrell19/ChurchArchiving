import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const TIMELINE = [
  { year: '1900',  title: 'Iglesia Católica Filipina Founded',       desc: 'Catholic Riego de Dios establishes the Iglesia Católica Filipina in Maragondon — two years before the IFI — after the Archbishop of Manila failed to act on the community\'s demands.' },
  { year: '1902',  title: 'Founding of the IFI',                     desc: 'Msgr. Gregorio Aglipay establishes the Iglesia Filipina Independiente, asserting Filipino autonomy in worship and church governance during the American colonial period.' },
  { year: '1903',  title: 'Affiliation with the IFI',                desc: 'The local Maragondon parish affiliates with the IFI, joining the growing national movement for an independent Filipino church.' },
  { year: '1961',  title: 'Full Communion with Episcopal Church',     desc: 'The IFI enters into full communion with the Episcopal Church and Old Catholic churches, broadening its ecumenical ties worldwide.' },
  { year: 'Today', title: 'Continuing the Mission',                  desc: 'Our parish continues to serve Maragondon — preserving sacred records, celebrating the sacraments, and nurturing a community of faith for future generations.' },
]

const VALUES = [
  { title: 'Faith',     desc: 'Rooted in the teachings of Christ, we proclaim the Gospel and administer the sacraments with reverence.' },
  { title: 'Tradition', desc: 'We honor over a century of Filipino Christian heritage, keeping alive the spirit of our founding fathers.' },
  { title: 'Service',   desc: 'We are called to serve — our neighbors, our community, and all those who seek comfort and belonging.' },
]

const STORY = [
  '▪ Founded in 1900 as Iglesia Católica Filipina and affiliated to the IFI in 1903.',
  '▪ Estimated family population: 500 (y2002)',
  '▪ Number of chapels / outstations: 5',
  'As a result of a rift between the influential families of Maragondon and the Archbishop of Manila during the Spanish occupation, the establishment of a Filipino-led religious group came to fruition.',
  'To this day, the IFC survives as a testimonial to the religious devotion of the Riego de Dios family and others in Maragondon.',
]

// ── Reusable style tokens ──
const S = {
  label:    { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase' as const, display: 'block', marginBottom: '12px' },
  h2:       { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 600, marginBottom: '16px' },
  body:     { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '15px', lineHeight: 1.75 },
  gold:     { color: '#d4af37' },
  navy:     { color: '#0c2a5e' },
  muted:    { color: '#8aaccf' },
  dimLabel: { color: 'rgba(12,42,94,0.45)' },
  dimGold:  { color: 'rgba(212,175,55,0.45)' },
}

function SectionLabel({ text, dark = false }: { text: string; dark?: boolean }) {
  return <span style={{ ...S.label, ...(dark ? S.dimGold : S.dimLabel) }}>{text}</span>
}

function SectionHeader({ label, title, dark = false }: { label: string; title: string; dark?: boolean }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
      <SectionLabel text={label} dark={dark} />
      <h2 style={{ ...S.h2, ...(dark ? S.gold : S.navy) }}>{title}</h2>
      <div className="gold-divider"><span /><span className="diamond" /><span /></div>
    </div>
  )
}

export default function AboutPage() {
  return (
    <>
      <Navbar />

      {/* HERO */}
      <section style={{ background: '#071630', padding: '128px 28px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
        <div className="absolute inset-0 bg-grid-gold pointer-events-none" />
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '560px', margin: '0 auto' }}>
          <SectionLabel text="Who We Are" dark />
          <div style={{ fontSize: '36px', color: '#d4af37', marginBottom: '16px' }} className="animate-pulse-cross">✝</div>
          <h1 style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 'clamp(22px,4vw,36px)', fontWeight: 600, color: '#d4af37', marginBottom: '16px' }}>About Our Church</h1>
          <p style={{ ...S.body, fontStyle: 'italic', color: '#e8d9b0', marginBottom: '24px' }}>A heritage of faith, independence, and service to the Filipino people since 1902.</p>
          <div className="gold-divider"><span /><span className="diamond" /><span /></div>
        </div>
      </section>

      {/* OUR STORY */}
      <section style={{ padding: '80px 28px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px,1fr))', gap: '52px', alignItems: 'center' }}>
          <div>
            <SectionLabel text="Our Story" />
            <h2 style={{ ...S.h2, ...S.navy, lineHeight: 1.35 }}>Did you know this parish was two years older than the Iglesia Filipina Independiente?</h2>
            {STORY.map((p, i) => <p key={i} style={{ ...S.body, color: '#3a5a7a', marginBottom: '14px' }}>{p}</p>)}
          </div>
          <img src="/images/CPhoto.jpg" alt="Church" style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.25)' }} />
        </div>
      </section>

      {/* TIMELINE */}
      <section style={{ background: '#071630', padding: '80px 28px', borderTop: '1px solid rgba(212,175,55,0.15)', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <SectionHeader label="History" title="Our Timeline" dark />
          <div style={{ position: 'relative', paddingLeft: '36px' }}>
            <div style={{ position: 'absolute', left: '10px', top: 0, bottom: 0, width: '1px', background: 'rgba(212,175,55,0.2)' }} />
            {TIMELINE.map(({ year, title, desc }, i) => (
              <div key={i} style={{ position: 'relative', marginBottom: '36px' }}>
                <div style={{ position: 'absolute', left: '-26px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: '#d4af37', border: '2px solid #071630', boxShadow: '0 0 0 3px rgba(212,175,55,0.2)' }} />
                <div style={{ ...S.label, ...S.gold, marginBottom: '4px' }}>{year}</div>
                <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', color: 'rgba(212,175,55,0.9)', marginBottom: '8px' }}>{title}</div>
                <p style={{ ...S.body, ...S.muted }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE VALUES */}
      <section style={{ padding: '80px 28px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <SectionHeader label="What We Stand For" title="Our Core Values" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: '24px' }}>
            {VALUES.map(({ title, desc }) => (
              <div key={title} style={{ background: '#fff', border: '1px solid rgba(212,175,55,0.28)', borderRadius: '12px', padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: '22px' }}>✝</div>
                <h3 style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '15px', fontWeight: 600, color: '#0c2a5e', marginBottom: '12px' }}>{title}</h3>
                <p style={{ ...S.body, color: '#4a6a8a' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}