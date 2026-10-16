'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import RequestsPage from '../admin/components/RequestsPage'
import RecycleBinPage from '../admin/components/RecycleBinPage'
import BurialArchivesPage from './components/BurialArchivesPage'
import BurialDashboardPage from './components/BurialDashboardPage'
import BurialRecordsPage from './components/BurialRecordsPage'
import CemeterySlotsPage from './components/CemeterySlotsPage'
import PaymentsPage from './components/PaymentsPage'
import ReservationsPage from './components/ReservationsPage'

type BurialPage =
  | 'dashboard'
  | 'slots'
  | 'reservations'
  | 'payments'
  | 'burials'
  | 'requests'
  | 'archives'
  | 'recycle'

const NAV: { id: BurialPage; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ti-layout-dashboard' },
  { id: 'slots', label: 'Cemetery Slots', icon: 'ti-map-pin' },
  { id: 'reservations', label: 'Reservations', icon: 'ti-file-contract' },
  { id: 'payments', label: 'Payments', icon: 'ti-receipt' },
  { id: 'burials', label: 'Burial Records', icon: 'ti-cross' },
  { id: 'requests', label: 'Burial Requests', icon: 'ti-inbox' },
  { id: 'archives', label: 'Legacy Archives', icon: 'ti-archive' },
  { id: 'recycle', label: 'Recycle Bin', icon: 'ti-trash' },
]

export default function BurialAdminPage() {
  const [page, setPage] = useState<BurialPage>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  const currentLabel = NAV.find(item => item.id === page)?.label || 'Burial Admin'

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static`}
      >
        <div className="px-6 py-6 border-b border-slate-100 bg-gradient-to-br from-amber-50 to-white">
          <div className="flex items-center gap-3">
            <span className="text-gold text-xl">✝</span>
            <div>
              <h1 className="font-display text-navy-mid text-[12px] tracking-wide font-semibold">
                Smart Parish System
              </h1>
              <p className="font-body text-[11px] text-slate-500">Burial & Cemetery Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPage(item.id)
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 text-left px-4 py-2.5 rounded-lg font-display text-[11px] tracking-wide border transition-colors ${
                page === item.id
                  ? 'bg-amber-50 text-navy-mid border-amber-200'
                  : 'text-slate-600 border-transparent hover:bg-slate-50'
              }`}
            >
              <i className={`ti ${item.icon} text-[16px] ${page === item.id ? 'text-gold' : ''}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-display text-[11px] tracking-wide text-red-600 border border-red-100 hover:bg-red-50"
          >
            <i className="ti ti-logout text-[16px]" />
            Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 sticky top-0 z-20">
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <i className="ti ti-menu-2 text-navy-mid text-[20px]" />
          </button>
          <div>
            <h2 className="font-display text-navy-mid text-[15px] font-semibold tracking-wide">
              {currentLabel}
            </h2>
            <p className="text-[11px] text-slate-500">Philippine Independent Church Cemetery Extension</p>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {page === 'dashboard' && <BurialDashboardPage />}
          {page === 'slots' && <CemeterySlotsPage />}
          {page === 'reservations' && <ReservationsPage />}
          {page === 'payments' && <PaymentsPage />}
          {page === 'burials' && <BurialRecordsPage />}
          {page === 'requests' && <RequestsPage office="burial" />}
          {page === 'archives' && <BurialArchivesPage />}
          {page === 'recycle' && <RecycleBinPage scope="burial" />}
        </main>
      </div>
    </div>
  )
}
