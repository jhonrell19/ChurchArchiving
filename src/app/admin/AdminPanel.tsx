'use client'

import ParishLogo from '../components/ParishLogo'


import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_NAV } from './data/navigation'
import type { AdminPage } from './types.ts'
import DashboardHome from './components/DashboardHome'
import ArchivesPage from './components/ArchivesPage'
import MassesPage from './components/MassesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import RequestsPage from './components/RequestsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import SettingsPage from './components/SettingsPage'
import RecycleBinPage from './components/RecycleBinPage'

type ExtendedAdminPage = AdminPage | 'recycle'

type CertificateRequest = {
  id: number
  status: string
  isUrgent: boolean
}

const MAIN_NAV: {
  id: ExtendedAdminPage
  label: string
  icon: string
}[] = [
  ...ADMIN_NAV,
  {
    id: 'recycle',
    label: 'Recycle Bin',
    icon: 'ti-trash',
  },
]

export default function AdminPanel() {
  const router = useRouter()
  const [page, setPage] = useState<ExtendedAdminPage>('dashboard')
  const [sidebarOpen, setSidebar] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [urgentCount, setUrgentCount] = useState(0)

  const loadRequestCounts = async () => {
    try {
      const res = await fetch('/api/backend/api/requests', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load request counts')

      const data = await res.json()
      const requests: CertificateRequest[] = Array.isArray(data.requests) ? data.requests : []

      setPendingCount(
        requests.filter(r => r.status === 'Pending' && !r.isUrgent).length
      )
      setUrgentCount(
        requests.filter(r => r.status !== 'Released' && r.status !== 'Rejected' && r.isUrgent).length
      )
    } catch {
      setPendingCount(0)
      setUrgentCount(0)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadRequestCounts())
    const interval = window.setInterval(() => void loadRequestCounts(), 10000)
    return () => window.clearInterval(interval)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  const currentPageLabel =
    MAIN_NAV.find(n => n.id === page)?.label || 'Admin Panel'

  const navigate = (id: ExtendedAdminPage) => {
    setPage(id)
    setSidebar(false)
    if (id === 'requests' || id === 'urgent-requests') {
      void loadRequestCounts()
    }
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
            <ParishLogo height={48} />
            <div>
              <p className="font-display text-navy-mid text-[12px] tracking-wide leading-tight font-semibold">
                Smart Parish System
              </p>
              <p className="font-body text-slate-500 text-[11px]">Main Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {MAIN_NAV.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 border ${
                page === id
                  ? 'bg-amber-50 text-navy-mid border-amber-200'
                  : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-navy-mid'
              }`}
            >
              <i className={`ti ${icon} text-[17px] ${page === id ? 'text-gold' : ''}`} />
              <span className="font-display text-[11px] tracking-wide flex-1">{label}</span>

              {id === 'requests' && pendingCount > 0 && (
                <span className="bg-navy text-white font-display text-[9px] px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
              {id === 'urgent-requests' && urgentCount > 0 && (
                <span className="bg-orange-500 text-white font-display text-[9px] px-1.5 py-0.5 rounded-full">
                  {urgentCount}
                </span>
              )}
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
              {currentPageLabel}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {page === 'dashboard' && <DashboardHome setPage={p => setPage(p)} />}
          {page === 'archives' && <ArchivesPage />}
          {page === 'masses' && <MassesPage />}
          {page === 'transcriptions' && <TranscriptionsPage />}
          {page === 'requests' && <RequestsPage />}
          {page === 'urgent-requests' && <RequestsPage urgentOnly />}
          {page === 'announcements' && <AnnouncementsPage />}
          {page === 'settings' && <SettingsPage />}
          {page === 'recycle' && <RecycleBinPage scope="main" />}
        </main>
      </div>
    </div>
  )
}
