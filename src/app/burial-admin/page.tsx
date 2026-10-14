'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BurialArchivesPage from './components/BurialArchivesPage'
import RequestsPage from '../admin/components/RequestsPage'
import RecycleBinPage from '../admin/components/RecycleBinPage'

type BurialPage = 'archives' | 'requests' | 'urgent-requests' | 'recycle'

const NAV: { id: BurialPage; label: string; icon: string }[] = [
  { id: 'archives', label: 'Burial Archives', icon: 'ti-archive' },
  { id: 'requests', label: 'Requests', icon: 'ti-inbox' },
  { id: 'urgent-requests', label: 'Urgent Requests', icon: 'ti-bolt' },
  { id: 'recycle', label: 'Recycle Bin', icon: 'ti-trash' },
]

export default function BurialAdminPage() {
  const [page, setPage] = useState<BurialPage>('archives')
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
              <p className="font-body text-[11px] text-slate-500">Burial Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
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
          <h2 className="font-display text-navy-mid text-[15px] font-semibold tracking-wide">
            {currentLabel}
          </h2>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {page === 'archives' && <BurialArchivesPage />}
          {page === 'requests' && <RequestsPage office="burial" />}
          {page === 'urgent-requests' && <RequestsPage urgentOnly office="burial" />}
          {page === 'recycle' && <RecycleBinPage scope="burial" />}
        </main>
      </div>
    </div>
  )
}
