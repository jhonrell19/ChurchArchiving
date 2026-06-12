'use client'

import { useEffect, useState } from 'react'
import { NAV } from './data/mockData'
import DashboardHome from './components/DashboardHome'
import ArchivesPage from './components/ArchivesPage'
import MassesPage from './components/MassesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import RequestsPage from './components/RequestsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import SettingsPage from './components/SettingsPage'
import RecycleBinPage from './components/RecycleBinPage'

type AdminPage =
  | 'dashboard'
  | 'archives'
  | 'masses'
  | 'transcriptions'
  | 'requests'
  | 'announcements'
  | 'settings'
  | 'recycle'

type CertificateRequest = {
  id: number
  status: string
}

const MAIN_NAV: {
  id: AdminPage
  label: string
  icon: string
}[] = [
  ...NAV,
  {
    id: 'recycle',
    label: 'Recycle Bin',
    icon: 'ti-trash',
  },
] as {
  id: AdminPage
  label: string
  icon: string
}[]

export default function AdminPanel() {
  const [page, setPage] = useState<AdminPage>('dashboard')
  const [sidebarOpen, setSidebar] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const loadPendingRequests = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/requests?scope=main')

      if (!res.ok) {
        throw new Error('Failed to load request count')
      }

      const data = await res.json()
      const requests: CertificateRequest[] = data.requests || []

      setPendingCount(
        requests.filter(r => r.status === 'Pending').length
      )
    } catch (err) {
      console.error('Pending request count error:', err)
      setPendingCount(0)
    }
  }

  useEffect(() => {
    loadPendingRequests()

    const interval = setInterval(loadPendingRequests, 5000)

    return () => clearInterval(interval)
  }, [])

  const currentPageLabel =
    MAIN_NAV.find(n => n.id === page)?.label || 'Admin Panel'

  return (
    <div className="min-h-screen bg-[#f4f1eb] flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy flex flex-col transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="px-6 py-6 border-b border-gold/10">
          <div className="flex items-center gap-3">
            <span className="text-gold text-xl">✝</span>
            <div>
              <p className="font-display text-gold text-[12px] tracking-wide leading-tight">
                Smart Parish System
              </p>
              <p className="font-body text-gold/40 text-[10px] tracking-widest">
                Admin Panel
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {MAIN_NAV.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => {
                setPage(id)
                setSidebar(false)

                if (id === 'requests') {
                  loadPendingRequests()
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 ${
                page === id
                  ? 'bg-gold/15 text-gold border border-gold/25'
                  : 'text-gold/55 border border-transparent hover:bg-white/5'
              }`}
            >
              <i className={`ti ${icon} text-[17px]`} aria-hidden="true" />

              <span className="font-display text-[12px] tracking-wide flex-1">
                {label}
              </span>

              {id === 'requests' && pendingCount > 0 && (
                <span className="bg-gold text-navy font-display text-[10px] px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gold/15 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1"
              onClick={() => setSidebar(true)}
              aria-label="Open sidebar"
            >
              <i className="ti ti-menu-2 text-navy-mid text-[20px]" />
            </button>

            <h1 className="font-display text-navy-mid text-[15px] font-semibold tracking-wide">
              {currentPageLabel}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {page === 'dashboard' && <DashboardHome setPage={setPage} />}
          {page === 'archives' && <ArchivesPage />}
          {page === 'masses' && <MassesPage />}
          {page === 'transcriptions' && <TranscriptionsPage />}
          {page === 'requests' && <RequestsPage />}
          {page === 'announcements' && <AnnouncementsPage />}
          {page === 'settings' && <SettingsPage />}
          {page === 'recycle' && <RecycleBinPage scope="main" />}
        </main>
      </div>
    </div>
  )
}

