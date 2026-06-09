'use client'
import { useState } from 'react'
import type { Page } from './types'
import { NAV } from './data/mockData'
import HomePage           from './components/HomePage'
import ArchivesPage       from './components/ArchivesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import RequestsPage       from './components/RequestsPage'
import AnnouncementsPage  from './components/AnnouncementsPage'
import ProfilePage        from './components/ProfilePage'

export default function UserDashboard() {
  const [page, setPage]           = useState<Page>('home')
  const [sidebarOpen, setSidebar] = useState(false)

  return (
    <div className="min-h-screen bg-[#f4f1eb] flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="px-6 py-6 border-b border-gold/10">
          <div className="flex items-center gap-3">
            <span className="text-gold text-xl">✝</span>
            <div>
              <p className="font-display text-gold text-[12px] tracking-wide leading-tight">Smart Parish System</p>
              <p className="font-body text-gold/40 text-[10px] tracking-widest">Maragondon, Cavite</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setPage(id); setSidebar(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 ${page === id ? 'bg-gold/15 text-gold border border-gold/25' : 'text-gold/55 border border-transparent'}`}>
              <i className={`ti ${icon} text-[17px]`} aria-hidden="true" />
              <span className="font-display text-[12px] tracking-wide">{label}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 pb-6">
          <div className="bg-gold/5 border border-gold/15 rounded-xl p-3 flex items-center gap-2">
            <i className="ti ti-eye text-gold/60 text-[15px]" aria-hidden="true" />
            <p className="font-display text-[10px] tracking-wider text-gold/50">View-only access</p>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebar(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gold/15 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1" onClick={() => setSidebar(true)} aria-label="Open sidebar">
              <i className="ti ti-menu-2 text-navy-mid text-[20px]" aria-hidden="true" />
            </button>
            <h1 className="font-display text-navy-mid text-[15px] font-semibold tracking-wide">
              {NAV.find(n => n.id === page)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 rounded-lg border border-gold/20 bg-gold/5" aria-label="Notifications">
              <i className="ti ti-bell text-gold text-[17px]" aria-hidden="true" />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-gold rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-navy border border-gold/30 flex items-center justify-center">
              <span className="font-display text-gold text-[11px] font-semibold">JD</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {page === 'home'           && <HomePage setPage={setPage} />}
          {page === 'archives'       && <ArchivesPage />}
          {page === 'transcriptions' && <TranscriptionsPage />}
          {page === 'requests'       && <RequestsPage />}
          {page === 'announcements'  && <AnnouncementsPage />}
          {page === 'profile'        && <ProfilePage />}
        </main>
      </div>
    </div>
  )
}