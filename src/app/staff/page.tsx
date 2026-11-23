'use client'

import { useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { useRefreshOnHistoryRestore } from '@/hooks/useRefreshOnHistoryRestore'
import ArchivesPage from '../admin/components/ArchivesPage'
import RequestsPage from '../admin/components/RequestsPage'

type Section = 'dashboard' | 'archives' | 'requests'
const links: { page: Section, label: string, icon: string }[] = [
  { page: 'dashboard', label: 'Staff Dashboard', icon: 'ti-layout-dashboard' },
  { page: 'archives', label: 'All Document Archives', icon: 'ti-archive' },
  { page: 'requests', label: 'Certificate Requests', icon: 'ti-inbox' },
]

export default function StaffPage() {
  useRefreshOnHistoryRestore()
  const { toast } = useFeedback()
  const [section, setSection] = useState<Section>('dashboard')
  async function logout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error('Logout failed')
      window.location.replace('/login')
    } catch { toast.error('Could not log out.') }
  }
  return <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
    <aside className="border-b border-slate-200 bg-white p-5 lg:min-h-screen lg:w-72 lg:border-r">
      <h1 className="mb-1 text-xl font-bold">Smart Parish System</h1>
      <p className="mb-6 text-slate-600">Church Staff · Documents</p>
      <nav className="flex flex-wrap gap-2 lg:flex-col" aria-label="Church Staff navigation">
        {links.map(link => <button key={link.page} type="button" onClick={() => setSection(link.page)}
          aria-current={section === link.page ? 'page' : undefined}
          className={`min-h-11 rounded-lg px-4 py-3 text-left text-base font-medium ${section === link.page ? 'bg-emerald-900 text-white' : 'bg-slate-100 hover:bg-emerald-50'}`}>
          <i className={`ti ${link.icon} mr-2`} aria-hidden="true"/>{link.label}
        </button>)}
      </nav>
      <button onClick={() => void logout()} className="mt-8 min-h-11 rounded-lg border border-red-200 px-4 text-red-700">Sign out</button>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-7">
      {section === 'dashboard' && <div className="space-y-5">
        <h2 className="text-2xl font-bold">Church Staff Dashboard</h2>
        <p className="text-base text-slate-600">Manage the parish's baptismal, confirmation, marriage, burial history, ownership and land agreement records through one office.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => setSection('archives')} className="min-h-32 rounded-xl border bg-white p-5 text-left text-lg font-semibold hover:border-emerald-700">Browse all archives</button>
          <button onClick={() => setSection('requests')} className="min-h-32 rounded-xl border bg-white p-5 text-left text-lg font-semibold hover:border-emerald-700">Process certificate requests</button>
        </div>
        <p className="text-sm text-slate-600">Mass transcription, announcements, staff administration, system settings and fees belong to Super Admin.</p>
      </div>}
      {section === 'archives' && <ArchivesPage />}
      {section === 'requests' && <RequestsPage />}
    </main>
  </div>
}
