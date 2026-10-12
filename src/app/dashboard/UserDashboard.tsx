'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Page } from './types'
import { USER_NAV } from './data/navigation'
import HomePage from './components/HomePage'
import ArchivesPage from './components/ArchivesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import RequestsPage from './components/RequestsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import ProfilePage from './components/ProfilePage'

export default function UserDashboard() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('home')
  const [sidebarOpen, setSidebar] = useState(false)

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="px-6 py-6 border-b border-slate-100 bg-gradient-to-br from-amber-50 to-white">
          <div className="flex items-center gap-3">
            <span className="text-gold text-xl">✝</span>
            <div>
              <p className="font-display text-navy-mid text-[12px] tracking-wide leading-tight font-semibold">
                Smart Parish System
              </p>
              <p className="font-body text-slate-500 text-[11px]">Maragondon, Cavite</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {USER_NAV.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPage(id)
                setSidebar(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 border ${
                page === id
                  ? 'bg-amber-50 text-navy-mid border-amber-200'
                  : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-navy-mid'
              }`}
            >
              <i className={`ti ${icon} text-[17px] ${page === id ? 'text-gold' : ''}`} />
              <span className="font-display text-[11px] tracking-wide">{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left border border-red-100 text-red-600 hover:bg-red-50 transition-colors"
          >
            <i className="ti ti-logout text-[16px]" />
            <span className="font-display text-[11px] tracking-wide">Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1"
              onClick={() => setSidebar(true)}
              aria-label="Open sidebar"
            >
              <i className="ti ti-menu-2 text-navy-mid text-[20px]" />
            </button>
            <h1 className="font-display text-navy-mid text-[15px] font-semibold tracking-wide">
              {USER_NAV.find(n => n.id === page)?.label}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {page === 'home' && <HomePage setPage={setPage} />}
          {page === 'archives' && <ArchivesPage />}
          {page === 'transcriptions' && <TranscriptionsPage />}
          {page === 'requests' && <RequestsPage />}
          {page === 'announcements' && <AnnouncementsPage />}
          {page === 'profile' && <ProfilePage />}
        </main>
      </div>
    </div>
  )
}
