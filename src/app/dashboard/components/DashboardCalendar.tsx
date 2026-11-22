'use client'

import { useEffect, useState } from 'react'

type Notice = { id: number; title: string; body: string; date?: string | null; starts?: string | null; ends?: string | null }
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const manilaToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const isoDate = (year: number, month: number, day: number) =>
  [year, String(month + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-')
const noticesFor = (items: Notice[], date: string) => items.filter(item =>
  item.date ? item.date === date : (!!item.starts && !!item.ends && item.starts <= date && date <= item.ends)
)

export default function DashboardCalendar() {
  const [selected, setSelected] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    setSelected(manilaToday())
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/parish-calendar', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Notices unavailable')
        const result: { notices?: Notice[] } = await response.json()
        if (controller.signal.aborted) return
        setNotices(Array.isArray(result.notices) ? result.notices : [])
        setError(false)
      } catch {
        if (!controller.signal.aborted) setError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [retry])

  if (!selected) return <div className="rounded-2xl bg-white p-5 text-base">Loading parish calendar…</div>

  const [year, month] = selected.split('-').map(Number)
  const currentMonth = month - 1
  const first = new Date(Date.UTC(year, currentMonth, 1))
  const days = new Date(Date.UTC(year, currentMonth + 1, 0)).getUTCDate()
  const label = first.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const today = manilaToday()
  const matches = noticesFor(notices, selected)
  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, currentMonth + delta, 1))
    setSelected(isoDate(next.getUTCFullYear(), next.getUTCMonth(), 1))
  }

  return (
    <section aria-label="Parish dashboard calendar" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Parish calendar</h2>
        <button type="button" onClick={() => setSelected(today)} className="text-sm font-semibold text-emerald-800 underline">Today</button>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-xl">‹</button>
        <h3 className="text-base font-semibold text-slate-800" aria-live="polite">{label}</h3>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-xl">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {weekdays.map((day, i) => <div key={i} className="py-1 text-center text-xs font-semibold text-slate-600">{day}</div>)}
        {Array.from({ length: first.getUTCDay() }, (_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = isoDate(year, currentMonth, i + 1)
          const hasEvent = noticesFor(notices, date).length > 0
          return (
            <button key={date} type="button" onClick={() => setSelected(date)}
              aria-label={date + (hasEvent ? ', parish event' : '')}
              aria-pressed={date === selected}
              aria-current={date === today ? 'date' : undefined}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg text-sm font-medium focus-visible:outline-2 ${date === selected ? 'bg-emerald-800 text-white' : 'text-slate-800 hover:bg-emerald-50'}`}>
              {i + 1}
              {hasEvent && <span aria-hidden="true" className={`text-[9px] leading-none ${date === selected ? 'text-white' : 'text-emerald-700'}`}>●</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-4 border-t border-slate-200 pt-4" aria-live="polite">
        <p className="text-sm font-semibold text-slate-800">{selected}</p>
        {error ? <div className="mt-2 text-sm text-amber-800" role="status">Notices are temporarily unavailable. <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>Retry</button></div> :
          matches.length ? matches.map(item => <article key={item.id} className="mt-2 rounded-lg bg-emerald-50 p-3">
            <h4 className="text-sm font-semibold text-emerald-950">{item.title}</h4>
            <p className="mt-1 text-sm text-slate-700">{item.body}</p>
          </article>) : <p className="mt-2 text-sm text-slate-600">No special announcements scheduled for this date.</p>}
      </div>
    </section>
  )
}
