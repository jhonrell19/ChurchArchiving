'use client'

import { useFeedback } from '@/components/ui/FeedbackProvider'

import ParishLogo from '../components/ParishLogo'


import { useState } from 'react'
import { useRefreshOnHistoryRestore } from '@/hooks/useRefreshOnHistoryRestore'
import { ADMIN_NAV } from './data/navigation'
import type { AdminPage } from './types.ts'
import MassesPage from './components/MassesPage'
import TranscriptionsPage from './components/TranscriptionsPage'
import AnnouncementsPage from './components/AnnouncementsPage'
import SettingsPage from './components/SettingsPage'

type ExtendedAdminPage = AdminPage

const MAIN_NAV = ADMIN_NAV

export default function AdminPanel({managePolicy=false,manageWebsite=false,manageStaff=false}:{managePolicy?:boolean;manageWebsite?:boolean;manageStaff?:boolean}) {
  const { toast } = useFeedback()
  useRefreshOnHistoryRestore()
  const [page, setPage] = useState<ExtendedAdminPage>('dashboard')
  const [transcriptId, setTranscriptId] = useState<number | null>(null)
  const [sidebarOpen, setSidebar] = useState(false)
  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Could not sign out')
      // Full navigation removes the old authenticated React/router state.
      window.location.replace('/login')
    } catch {
      toast.error('Logout failed. Please try again.')
    }
  }

  const currentPageLabel =
    MAIN_NAV.find(n => n.id === page)?.label || 'Admin Panel'

  const navigate = (id: ExtendedAdminPage) => {
    setPage(id)
    setSidebar(false)
  }

  return (
    <div className="parish-shell min-h-screen bg-[#f8fafc] flex">
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
              <p className="font-body text-slate-500 text-[11px]">Super Admin</p>
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

            </button>
          ))}
          {manageStaff && <a className="parish-report-link" href="/admin/staff">Manage Church Staff Accounts</a>}
          <a href="/admin/member-approvals"
            className="mt-3 block rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-[#14264b] hover:bg-amber-100">
            Parish Membership Approvals
          </a>
          <a className="parish-report-link" href="/office-reports">Certificate reports</a>
          {process.env.NEXT_PUBLIC_PARISH_RELATIVE_CLAIMS === 'enabled' && <a className="parish-report-link" href="/claims">Relationship claims</a>}
          {manageWebsite && <a className="parish-report-link" href="/admin/site-content">Website editor</a>}
          {managePolicy && <a className="parish-report-link" href="/admin/portal-settings">Policies and request purposes</a>}
          {process.env.NEXT_PUBLIC_PARISH_APPOINTMENTS === 'enabled' && <a className="parish-report-link" href="/appointments">Office appointments</a>}
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
              aria-label="Open navigation" aria-expanded={sidebarOpen}
            >
              <i className="ti ti-menu-2 text-navy-mid text-[20px]" /><span className="ml-1">Menu</span>
            </button>
            <h1 className="font-display text-navy-mid text-[15px] font-semibold tracking-wide">
              {currentPageLabel}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {page === 'dashboard' && <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-900">Super Admin Dashboard</h2>
            <p className="text-base text-slate-600">Manage parish accounts, Mass recordings, transcription, announcements, reports and website settings. Church Staff processes archive records and document requests.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {manageStaff && <a href="/admin/staff" className="rounded-xl border bg-white p-5 text-base font-semibold text-emerald-900">Church Staff Accounts</a>}
              <a href="/admin/member-approvals" className="rounded-xl border bg-white p-5 text-base font-semibold text-emerald-900">Membership Approvals</a>
              <a href="/office-reports" className="rounded-xl border bg-white p-5 text-base font-semibold text-emerald-900">Reports and Oversight</a>
              {manageWebsite && <a href="/admin/site-content" className="rounded-xl border bg-white p-5 text-base font-semibold text-emerald-900">Website Editor</a>}
            </div>
          </section>}
          {page === 'masses' && <MassesPage initialTranscript={transcriptId} />}
          {page === 'transcriptions' && <TranscriptionsPage openMass={id => { setTranscriptId(id); setPage('masses') }} />}
          {page === 'announcements' && <AnnouncementsPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}
