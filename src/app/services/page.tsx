import Footer from '../components/Footer'
import parishFees from '../../../config/parish_fees.json'

import {publishedContent} from '@/lib/publishedSiteContent'
export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const {services,sacraments,ministries,address}=await publishedContent()
  return (
    <>

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
            {!services.length && <p className="p-5 text-white">Contact the parish office for current service times.</p>}
            {services.map(({ day, time, tag }, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-7 py-5
                  border-b border-gold/10 last:border-b-0"
              >
                <span className="font-display text-gold text-sm tracking-wide w-32">{day}</span>
                <span className="font-body text-txt-md text-[15px] flex-1 text-center">{time}</span>
                <span className="font-display text-[10px] tracking-widest uppercase
                  bg-gold/15 text-gold border border-gold/30 px-4 py-1 rounded-full">
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
            {sacraments.map(({ title, desc }) => (
              <div
                key={title}
                className="bg-white border border-gold/30 rounded-xl p-8 text-center"
              >
                <h3 className="font-display font-semibold text-navy-mid text-sm tracking-wide mb-3">{title}</h3>
                <p className="font-body text-[15px] text-[#4a6a8a] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Published rates; this is informational, not an online checkout. */}
      <section className="bg-amber-50 px-7 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-display text-navy-mid text-2xl font-semibold mb-3">Parish Fee Schedule</h2>
          <p className="text-center text-sm text-slate-700 mb-6">Service fees and certificate copy fees are different charges. Confirm arrangements with parish staff before paying.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm text-navy-mid">
            {[
              ['Baptism service', parishFees.sacramentalServices.baptism],
              ['Burial service', parishFees.sacramentalServices.burial],
              ['Matrimony service', parishFees.sacramentalServices.matrimony],
              ['Baptismal certificate copy', parishFees.certificateCopies.baptismal],
              ['Confirmation certificate copy', parishFees.certificateCopies.confirmation],
              ['Cemetery opening permit', parishFees.cemetery.openingPermit],
              ['Perpetual cemetery dues (per year)', parishFees.cemetery.perpetualDuesPerYear],
            ].map(([label, amount]) => (
              <div key={String(label)} className="flex justify-between gap-2 rounded-lg bg-white border border-amber-100 p-3">
                <span>{label}</span><strong>₱{Number(amount).toLocaleString('en-PH')}</strong>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-600">These prices do not authorize a payment on their own. Marriage certificate copies, ownership copies and land agreement copies require separate parish confirmation.</p>
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
            {ministries.map(({ title:name, desc }) => (
              <div
                key={name}
                className="border border-gold/20 rounded-xl p-6"
              >
                <h3 className="font-display text-gold text-sm tracking-wide mb-2">{name}</h3>
                <p className="font-body text-txt-md text-[15px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer address={address}/>
    </>
  )
}