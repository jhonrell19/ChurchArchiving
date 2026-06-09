'use client'
import { useState } from 'react'
import { MASSES, PRIESTS, CATEGORIES, inputCls } from '../data/mockData'
import MassCard from './MassCard'

export default function ArchivesPage() {
  const [search, setSearch]     = useState('')
  const [priest, setPriest]     = useState('All Priests')
  const [category, setCategory] = useState('All Categories')

  const filtered = MASSES.filter(m =>
    (priest   === 'All Priests'    || m.priest   === priest)   &&
    (category === 'All Categories' || m.category === category) &&
    (m.title.toLowerCase().includes(search.toLowerCase()) || m.priest.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">Mass Archives</h2>
      <p className="font-body text-[#6b8caa] text-[14px] mb-6">Browse and watch all archived masses and church services.</p>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#9ab0c4] text-[16px]" aria-hidden="true" />
          <input type="text" placeholder="Search by title or priest…" value={search} onChange={e => setSearch(e.target.value)} className={`pl-9 pr-4 py-2.5 ${inputCls}`} />
        </div>
        <select value={priest} onChange={e => setPriest(e.target.value)} className="border border-gold/20 rounded-lg px-3 py-2.5 font-body text-[13px] text-navy-mid bg-white focus:outline-none">
          {PRIESTS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} className="border border-gold/20 rounded-lg px-3 py-2.5 font-body text-[13px] text-navy-mid bg-white focus:outline-none">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {filtered.length === 0
        ? <p className="font-body text-[#9ab0c4] text-[14px] text-center py-12">No records found.</p>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{filtered.map(m => <MassCard key={m.id} m={m} />)}</div>
      }
    </div>
  )
}