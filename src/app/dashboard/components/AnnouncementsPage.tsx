'use client'
import { ANNOUNCEMENTS, BADGE_COLOR } from '../data/mockData'

export default function AnnouncementsPage() {
  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">Parish Announcements</h2>
      <p className="font-body text-[#6b8caa] text-[14px] mb-6">Latest updates and announcements from the parish.</p>
      <div className="space-y-4">
        {ANNOUNCEMENTS.map(a => (
          <div key={a.id} className="bg-white border border-gold/20 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-2">
              <p className="font-display text-navy-mid text-[14px] font-semibold leading-snug">{a.title}</p>
              <span className={`flex-shrink-0 font-display text-[10px] tracking-wider border px-2.5 py-0.5 rounded-full ${BADGE_COLOR[a.category] ?? ''}`}>{a.category}</span>
            </div>
            <p className="font-body text-[12px] text-[#9ab0c4] mb-3">{a.date}</p>
            <p className="font-body text-[14px] text-[#4a6a8a] leading-relaxed">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}