'use client'
import type { Page } from '../types'
import { STATS, MASSES, ANNOUNCEMENTS, TRANSCRIPTIONS } from '../data/mockData'
import MassCard from './MassCard'

export default function HomePage({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map(({ label, value, icon }) => (
          <div key={label} className="bg-white border border-gold/20 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-3">
              <i className={`ti ${icon} text-gold text-[17px]`} aria-hidden="true" />
            </div>
            <p className="font-display text-[22px] font-semibold text-navy-mid leading-none mb-1">{value}</p>
            <p className="font-body text-[12px] text-[#6b8caa] leading-tight">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-navy-mid text-[15px] font-semibold">Recent Masses</h3>
            <button onClick={() => setPage('archives')} className="font-display text-[11px] tracking-wider text-gold border border-gold/30 px-3 py-1 rounded-lg">View All</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MASSES.slice(0, 4).map(m => <MassCard key={m.id} m={m} />)}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-navy-mid text-[15px] font-semibold">Announcements</h3>
              <button onClick={() => setPage('announcements')} className="font-display text-[11px] tracking-wider text-gold">See all</button>
            </div>
            <div className="space-y-3">
              {ANNOUNCEMENTS.slice(0, 3).map(a => (
                <div key={a.id} className="bg-white border border-gold/20 rounded-xl p-4">
                  <p className="font-display text-navy-mid text-[12px] font-semibold leading-snug mb-1">{a.title}</p>
                  <p className="font-body text-[11px] text-[#9ab0c4]">{a.date}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-navy-mid text-[15px] font-semibold">Latest Transcription</h3>
              <button onClick={() => setPage('transcriptions')} className="font-display text-[11px] tracking-wider text-gold">See all</button>
            </div>
            <div className="bg-white border border-gold/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ti ti-sparkles text-gold text-[15px]" aria-hidden="true" />
                <p className="font-display text-navy-mid text-[12px] font-semibold">{TRANSCRIPTIONS[0].massTitle}</p>
              </div>
              <p className="font-body text-[12px] text-[#6b8caa] italic leading-relaxed line-clamp-3">"{TRANSCRIPTIONS[0].summary}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}